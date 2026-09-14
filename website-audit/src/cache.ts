// Content-addressed, read-through cache for every external call (resolve, map, scrape, screenshot, llm).
// Keys are stable across runs and directories. --from-cache <runDir> consults a source run first;
// hits are hard-linked (fallback: copied) into the new run; --offline turns misses into errors.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type CacheKind = 'resolve' | 'map' | 'scrape' | 'screenshot' | 'llm';

interface IndexEntry {
  kind: CacheKind;
  path: string; // value JSON, relative to run dir
  files: { path: string; sha256: string }[]; // referenced binary files, relative to run dir
  created_at: string;
}
interface Index {
  version: 1;
  entries: Record<string, IndexEntry>;
}

export class OfflineMissError extends Error {
  constructor(kind: CacheKind, key: string) {
    super(`--offline: cache miss for ${kind} ${key.slice(0, 12)}…`);
    this.name = 'OfflineMissError';
  }
}

export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      if (obj[k] === undefined) continue;
      out[k] = norm(obj[k]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function sha256OfFile(p: string): string {
  return sha256(fs.readFileSync(p));
}

export class RunCache {
  private index: Index;
  private sourceIndex: Index | null = null;
  readonly stats = { hits: 0, misses: 0, sourceHits: 0 };

  constructor(
    readonly runDir: string,
    readonly sourceDir: string | null,
    readonly offline: boolean,
  ) {
    fs.mkdirSync(path.join(runDir, 'cache'), { recursive: true });
    this.index = this.readIndex(runDir) ?? { version: 1, entries: {} };
    if (sourceDir) {
      const src = path.resolve(sourceDir);
      if (!fs.existsSync(path.join(src, 'cache', 'index.json'))) {
        throw new Error(`--from-cache: ${src} has no cache/index.json`);
      }
      this.sourceIndex = this.readIndex(src);
    }
  }

  private readIndex(dir: string): Index | null {
    const p = path.join(dir, 'cache', 'index.json');
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as Index;
    } catch {
      return null;
    }
  }

  private writeIndex(): void {
    fs.writeFileSync(path.join(this.runDir, 'cache', 'index.json'), JSON.stringify(this.index, null, 2));
  }

  key(kind: CacheKind, request: unknown): string {
    return sha256(`${kind}\n${canonicalJson(request)}`);
  }

  private validEntry(baseDir: string, entry: IndexEntry): boolean {
    const valuePath = path.join(baseDir, entry.path);
    if (!fs.existsSync(valuePath)) return false;
    try {
      JSON.parse(fs.readFileSync(valuePath, 'utf8'));
    } catch {
      return false;
    }
    for (const f of entry.files) {
      const fp = path.join(baseDir, f.path);
      if (!fs.existsSync(fp)) return false;
      if (sha256OfFile(fp) !== f.sha256) return false;
    }
    return true;
  }

  private linkOrCopy(src: string, dest: string): void {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) return;
    try {
      fs.linkSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
    }
  }

  /** Look up a key in this run, then in the source run (importing files into this run on hit). */
  get<T>(kind: CacheKind, key: string): { value: T; source: 'run' | 'source' } | null {
    const own = this.index.entries[key];
    if (own && own.kind === kind && this.validEntry(this.runDir, own)) {
      return { value: JSON.parse(fs.readFileSync(path.join(this.runDir, own.path), 'utf8')) as T, source: 'run' };
    }
    if (this.sourceIndex && this.sourceDir) {
      const src = path.resolve(this.sourceDir);
      const ent = this.sourceIndex.entries[key];
      if (ent && ent.kind === kind && this.validEntry(src, ent)) {
        this.linkOrCopy(path.join(src, ent.path), path.join(this.runDir, ent.path));
        for (const f of ent.files) this.linkOrCopy(path.join(src, f.path), path.join(this.runDir, f.path));
        this.index.entries[key] = { ...ent };
        this.writeIndex();
        return { value: JSON.parse(fs.readFileSync(path.join(this.runDir, ent.path), 'utf8')) as T, source: 'source' };
      }
    }
    return null;
  }

  /** Store a value (and register referenced files, which the caller has already written under runDir). */
  put(kind: CacheKind, key: string, value: unknown, files: string[] = []): void {
    const rel = path.join('cache', kind, `${key}.json`);
    const abs = path.join(this.runDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(value, null, 2));
    this.index.entries[key] = {
      kind,
      path: rel,
      files: files.map((f) => ({ path: path.relative(this.runDir, path.resolve(this.runDir, f)), sha256: sha256OfFile(path.resolve(this.runDir, f)) })),
      created_at: new Date().toISOString(),
    };
    this.writeIndex();
  }

  /**
   * Read-through helper. `fn` performs the external call and returns the value plus any files it wrote
   * (paths relative to runDir or absolute under runDir).
   */
  async cached<T>(
    kind: CacheKind,
    request: unknown,
    fn: () => Promise<{ value: T; files?: string[] }>,
  ): Promise<{ value: T; hit: boolean; source: 'run' | 'source' | null; key: string }> {
    const key = this.key(kind, request);
    const hit = this.get<T>(kind, key);
    if (hit) {
      this.stats.hits++;
      if (hit.source === 'source') this.stats.sourceHits++;
      return { value: hit.value, hit: true, source: hit.source, key };
    }
    if (this.offline) throw new OfflineMissError(kind, key);
    this.stats.misses++;
    const res = await fn();
    this.put(kind, key, res.value, res.files ?? []);
    return { value: res.value, hit: false, source: null, key };
  }
}
