#!/usr/bin/env node
// Local web UI for the website-audit CLI. Zero dependencies beyond Node built-ins + yaml.
//
//   npm run ui                 → http://127.0.0.1:8790/   (PORT env overrides the port)
//
// The server never runs the pipeline in-process: it spawns `node --import tsx src/index.ts audit …
// --json-progress` as a child, buffers the child's JSON-lines progress per run id, and streams it to
// the page over Server-Sent Events. Only one audit runs at a time.
//
// createServer(opts) returns an http.Server WITHOUT listening so the test can bind port 0.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { MODULES, defaultModules, isModuleId } from '../src/modules.js';
import { packageRoot as defaultPackageRoot, repoRoot as defaultRepoRoot } from '../src/config.js';

export interface ServerOptions {
  /** Where config/ and personas/ live. Default: the agencyos repo root (website-audit/..). */
  repoRoot?: string;
  /** Where src/index.ts lives; cwd for the spawned CLI. Default: website-audit/. */
  packageRoot?: string;
  /** Where run directories are created and scanned. Default: <repoRoot>/runs. */
  runsDir?: string;
  /** Directory containing index.html. Default: this file's directory. */
  uiDir?: string;
  /** Environment for the spawned CLI. Default: process.env. Tests blank the API keys here. */
  childEnv?: NodeJS.ProcessEnv;
}

export interface ResolvedOptions {
  repoRoot: string;
  packageRoot: string;
  runsDir: string;
  uiDir: string;
  childEnv: NodeJS.ProcessEnv;
}

export type RunStatus = 'done' | 'partial' | 'error' | 'running';

export interface RunSummary {
  id: string;
  host: string;
  timestamp: string;
  started: string | null;
  input_url: string | null;
  industry: string | null;
  verdict: string | null;
  modules: Record<string, boolean> | null;
  credits_used: number | null;
  anthropic_usd: number | null;
  status: RunStatus;
  error: string | null;
}

interface CliConfig {
  industry?: string;
  modules: Record<string, boolean>;
  exclude_items: string[];
  judge_model?: string;
  tiles?: number;
  max_candidate_pages?: number;
  lenient?: boolean;
}

interface RunState {
  id: string;
  dir: string;
  child: ChildProcess;
  /** Every complete stdout line the child has written (JSON progress events). */
  lines: string[];
  stderr: string;
  status: 'running' | 'done' | 'error';
  code: number | null;
  message: string | null;
  listeners: Set<http.ServerResponse>;
}

// Shapes we read back from disk (loosely typed on purpose: files may be partial or stale).
interface ReportLike {
  input_url?: string;
  industry?: { slug?: string };
  summary?: { verdict?: string };
  run_meta?: { modules?: Record<string, boolean>; credits_used?: number; anthropic_usd?: number; timestamps?: { started?: string } };
}
interface InputLike {
  input_url?: string;
  started?: string;
  modules?: Record<string, boolean>;
  industry_override?: string | null;
}
interface ErrorLike {
  message?: string;
}

export const RUN_ID_RE = /^[a-z0-9.-]+\/[0-9TZ-]+$/;
const HOST_RE = /^[a-z0-9.-]+$/;
const TS_RE = /^[0-9TZ-]+$/;
const MAX_BODY = 64 * 1024;
const STDERR_TAIL = 4000;
const SSE_PING_MS = 15_000;

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

export function resolveOptions(opts: ServerOptions = {}): ResolvedOptions {
  const repoRoot = path.resolve(opts.repoRoot ?? defaultRepoRoot());
  return {
    repoRoot,
    packageRoot: path.resolve(opts.packageRoot ?? defaultPackageRoot()),
    runsDir: path.resolve(opts.runsDir ?? path.join(repoRoot, 'runs')),
    uiDir: path.resolve(opts.uiDir ?? path.dirname(fileURLToPath(import.meta.url))),
    childEnv: opts.childEnv ?? process.env,
  };
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('request body must be a JSON object'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error('request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function readJsonFile<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readdirSafe(p: string): string[] {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/** Same rule as the pipeline: scheme optional, hostname lower-cased. */
export function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Same format as the pipeline's run-dir timestamp: 2026-09-14T15-04-22Z. */
export function timestampSlug(d = new Date()): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function stepTag(status: string): string {
  return { start: '▶', done: '✓', skip: '–', error: '✗' }[status] ?? '·';
}

// ---------------------------------------------------------------------------------------------
// request parsing
// ---------------------------------------------------------------------------------------------

type ParsedAudit = { ok: true; url: string; config: CliConfig; fromCache: string | null; dryRun: boolean } | { ok: false; error: string };

function parseAuditRequest(body: Record<string, unknown>, slugs: string[], runsDir: string): ParsedAudit {
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return { ok: false, error: 'url is required' };

  const config: CliConfig = { modules: {}, exclude_items: [] };

  const industry = typeof body.industry === 'string' ? body.industry.trim() : '';
  if (industry && industry !== 'auto') {
    if (!slugs.includes(industry)) return { ok: false, error: `unknown industry "${industry}"; valid: ${slugs.join(', ')}` };
    config.industry = industry;
  }

  if (body.modules !== undefined) {
    if (!body.modules || typeof body.modules !== 'object' || Array.isArray(body.modules)) return { ok: false, error: 'modules must be an object of {id: boolean}' };
    for (const [id, on] of Object.entries(body.modules as Record<string, unknown>)) {
      if (!isModuleId(id)) return { ok: false, error: `unknown module "${id}"; valid: ${MODULES.map((m) => m.id).join(', ')}` };
      const def = MODULES.find((m) => m.id === id)!;
      if (on && !def.built) return { ok: false, error: `module "${id}" is not built yet` };
      config.modules[id] = !!on;
    }
  }
  const effective = { ...defaultModules(), ...config.modules };
  if (!effective.classify && !config.industry) return { ok: false, error: 'the classify module is off, so an industry must be chosen (not Auto-detect)' };

  let exclude: string[] = [];
  if (Array.isArray(body.exclude_items)) exclude = body.exclude_items.map((s) => String(s));
  else if (typeof body.exclude_items === 'string') exclude = body.exclude_items.split(',');
  else if (body.exclude_items !== undefined && body.exclude_items !== null) return { ok: false, error: 'exclude_items must be an array of item ids' };
  config.exclude_items = exclude.map((s) => s.trim()).filter(Boolean);

  if (body.judge_model !== undefined && body.judge_model !== null && body.judge_model !== '') {
    if (typeof body.judge_model !== 'string' || !/^[a-z0-9.-]+$/i.test(body.judge_model)) return { ok: false, error: 'judge_model must be a model id' };
    config.judge_model = body.judge_model;
  }
  if (body.tiles !== undefined && body.tiles !== null && body.tiles !== '') {
    const n = Number(body.tiles);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, error: 'tiles must be an integer between 1 and 20' };
    config.tiles = n;
  }
  if (body.max_candidate_pages !== undefined && body.max_candidate_pages !== null && body.max_candidate_pages !== '') {
    const n = Number(body.max_candidate_pages);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'max_candidate_pages must be a whole number (blank = no cap)' };
    config.max_candidate_pages = n;
  }
  if (body.lenient !== undefined && body.lenient !== null) {
    if (typeof body.lenient !== 'boolean') return { ok: false, error: 'lenient must be a boolean' };
    config.lenient = body.lenient;
  }

  let fromCache: string | null = null;
  if (typeof body.from_cache === 'string' && body.from_cache.trim()) {
    const cid = body.from_cache.trim();
    if (!RUN_ID_RE.test(cid)) return { ok: false, error: 'from_cache must be a run id of the form <host>/<timestamp>' };
    const cdir = path.join(runsDir, ...cid.split('/'));
    if (!isDir(cdir)) return { ok: false, error: `cache run "${cid}" was not found under ${runsDir}` };
    fromCache = cdir;
  }

  return { ok: true, url, config, fromCache, dryRun: body.dry_run === true };
}

// ---------------------------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------------------------

export function createServer(opts: ServerOptions = {}): http.Server {
  const { repoRoot, packageRoot, runsDir, uiDir, childEnv } = resolveOptions(opts);
  const runs = new Map<string, RunState>();
  let active: RunState | null = null;

  // ---- data sources ----

  function loadIndustries(): { slug: string; display_name: string }[] {
    const file = path.join(repoRoot, 'config', 'industries.yaml');
    const raw = parseYaml(fs.readFileSync(file, 'utf8')) as { industries?: { slug?: unknown; display_name?: unknown }[] } | null;
    const list = Array.isArray(raw?.industries) ? raw.industries : [];
    return list
      .filter((i) => i && typeof i.slug === 'string')
      .map((i) => ({ slug: String(i.slug), display_name: typeof i.display_name === 'string' ? i.display_name : String(i.slug) }));
  }

  function summarizeRun(host: string, ts: string, dir: string): RunSummary {
    const id = `${host}/${ts}`;
    const report = readJsonFile<ReportLike>(path.join(dir, 'report.json'));
    const partial = report ? null : readJsonFile<ReportLike>(path.join(dir, 'report.partial.json'));
    const errorJson = readJsonFile<ErrorLike>(path.join(dir, 'error.json'));
    const input = readJsonFile<InputLike>(path.join(dir, 'input.json'));
    const live = runs.get(id) ?? null;
    const r = report ?? partial;

    let status: RunStatus;
    if (report) status = 'done';
    else if (partial) status = 'partial';
    else if (live && live.status === 'running') status = 'running';
    else status = 'error';

    let error: string | null = null;
    if (status === 'partial' || status === 'error') {
      error = errorJson?.message ?? live?.message ?? (status === 'error' ? 'incomplete run (no report written)' : null);
    }

    return {
      id,
      host,
      timestamp: ts,
      started: r?.run_meta?.timestamps?.started ?? input?.started ?? null,
      input_url: r?.input_url ?? input?.input_url ?? null,
      industry: r?.industry?.slug ?? input?.industry_override ?? null,
      verdict: r?.summary?.verdict ?? null,
      modules: r?.run_meta?.modules ?? input?.modules ?? null,
      credits_used: r?.run_meta?.credits_used ?? null,
      anthropic_usd: r?.run_meta?.anthropic_usd ?? null,
      status,
      error,
    };
  }

  function scanRuns(): RunSummary[] {
    const out: RunSummary[] = [];
    for (const host of readdirSafe(runsDir)) {
      if (!HOST_RE.test(host)) continue;
      const hostDir = path.join(runsDir, host);
      if (!isDir(hostDir)) continue;
      for (const ts of readdirSafe(hostDir)) {
        if (!TS_RE.test(ts)) continue;
        const dir = path.join(hostDir, ts);
        if (!isDir(dir)) continue;
        out.push(summarizeRun(host, ts, dir));
      }
    }
    out.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.host.localeCompare(b.host));
    return out;
  }

  // ---- child process wiring ----

  function cliArgs(rest: string[]): string[] {
    return ['--import', 'tsx', 'src/index.ts', ...rest];
  }

  function runCli(rest: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, cliArgs(rest), { cwd: packageRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString('utf8')));
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  }

  function sseLine(index: number, line: string): string {
    return `id: ${index}\ndata: ${line}\n\n`;
  }

  function terminalFrame(run: RunState): string {
    if (run.status === 'done') return `event: done\ndata: ${JSON.stringify({ run_id: run.id, run_dir: run.dir, code: 0 })}\n\n`;
    return `event: error\ndata: ${JSON.stringify({ run_id: run.id, run_dir: run.dir, code: run.code, message: run.message, stderr: run.stderr })}\n\n`;
  }

  function pushLine(run: RunState, line: string): void {
    const index = run.lines.push(line) - 1;
    const frame = sseLine(index, line);
    for (const res of run.listeners) res.write(frame);
  }

  function finishRun(run: RunState, code: number | null, spawnError?: Error): void {
    if (run.status !== 'running') return;
    run.code = code;
    if (code === 0 && !spawnError) {
      run.status = 'done';
    } else {
      run.status = 'error';
      // Prefer the pipeline's own error event, then the last stderr line, then the exit code.
      let msg: string | null = spawnError?.message ?? null;
      for (let i = run.lines.length - 1; i >= 0 && !msg; i--) {
        try {
          const ev = JSON.parse(run.lines[i]) as { event?: string; message?: string };
          if (ev.event === 'error' && ev.message) msg = ev.message;
        } catch {
          /* not JSON */
        }
      }
      if (!msg) {
        const tail = run.stderr.trim().split('\n').filter(Boolean);
        msg = tail.length ? tail[tail.length - 1] : `audit exited with code ${code}`;
      }
      run.message = msg;
    }
    const frame = terminalFrame(run);
    for (const res of run.listeners) {
      res.write(frame);
      res.end();
    }
    run.listeners.clear();
    if (active === run) active = null;
  }

  function startRun(id: string, dir: string, url: string, configJson: string, fromCache: string | null): RunState {
    const rest = ['audit', url, '--config-json', configJson, '--json-progress', '--run-dir', dir, '--launched-from', 'ui', '--repo-root', repoRoot];
    if (fromCache) rest.push('--from-cache', fromCache);
    const child = spawn(process.execPath, cliArgs(rest), { cwd: packageRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    const run: RunState = { id, dir, child, lines: [], stderr: '', status: 'running', code: null, message: null, listeners: new Set() };

    let buf = '';
    child.stdout.on('data', (c: Buffer) => {
      buf += c.toString('utf8');
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trimEnd();
        buf = buf.slice(nl + 1);
        if (line) pushLine(run, line);
      }
    });
    child.stdout.on('end', () => {
      if (buf.trim()) pushLine(run, buf.trim());
      buf = '';
    });
    child.stderr.on('data', (c: Buffer) => {
      run.stderr = (run.stderr + c.toString('utf8')).slice(-STDERR_TAIL);
    });
    child.on('error', (e) => finishRun(run, null, e));
    child.on('close', (code) => finishRun(run, code));
    return run;
  }

  // ---- route handlers ----

  function serveIndex(res: http.ServerResponse): void {
    const file = path.join(uiDir, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        sendJson(res, 500, { error: `index.html not found at ${file}` });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
  }

  function serveRunFile(rawPath: string, res: http.ServerResponse): void {
    const forbid = () => sendJson(res, 403, { error: 'forbidden' });
    // Reject traversal before and after decoding: literal or encoded dots, encoded slashes, NULs, backslashes.
    if (/%2e|%2f|%5c|%00|\.\.|\\/i.test(rawPath)) return forbid();
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      sendJson(res, 400, { error: 'bad path encoding' });
      return;
    }
    if (decoded.includes('..') || decoded.includes('\0') || decoded.includes('\\')) return forbid();
    const rel = decoded.slice('/runs/'.length);
    if (!rel || rel.startsWith('/') || path.isAbsolute(rel)) return forbid();
    const abs = path.resolve(runsDir, rel);
    if (abs !== runsDir && !abs.startsWith(runsDir + path.sep)) return forbid();

    fs.stat(abs, (err, st) => {
      if (err || !st.isFile()) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      const type = TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(abs).pipe(res);
    });
  }

  async function handleAudit(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      sendJson(res, 400, { error: (e as Error).message });
      return;
    }
    let slugs: string[];
    try {
      slugs = loadIndustries().map((i) => i.slug);
    } catch (e) {
      sendJson(res, 500, { error: `could not read config/industries.yaml: ${(e as Error).message}` });
      return;
    }
    const parsed = parseAuditRequest(body, slugs, runsDir);
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return;
    }
    const { url, config, fromCache, dryRun } = parsed;
    const configJson = JSON.stringify(config);

    if (dryRun) {
      const r = await runCli(['audit', url, '--config-json', configJson, '--dry-run', '--repo-root', repoRoot]);
      if (r.code !== 0) {
        sendJson(res, 400, { error: r.stderr.trim() || `dry run exited with code ${r.code}` });
        return;
      }
      try {
        sendJson(res, 200, JSON.parse(r.stdout));
      } catch {
        sendJson(res, 500, { error: 'dry run did not print JSON', stdout: r.stdout.slice(-2000), stderr: r.stderr.slice(-2000) });
      }
      return;
    }

    if (active && active.status === 'running') {
      sendJson(res, 409, { error: `An audit is already running (${active.id}). Wait for it to finish before starting another.`, run_id: active.id });
      return;
    }
    const host = hostFromUrl(url);
    if (!host || !HOST_RE.test(host)) {
      sendJson(res, 400, { error: `could not derive a hostname from "${url}"` });
      return;
    }
    const ts = timestampSlug();
    let dir = path.join(runsDir, host, ts);
    for (let n = 2; fs.existsSync(dir); n++) dir = path.join(runsDir, host, `${ts}-${n}`);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      sendJson(res, 500, { error: `could not create run dir ${dir}: ${(e as Error).message}` });
      return;
    }
    const id = `${host}/${path.basename(dir)}`;
    const run = startRun(id, dir, url, configJson, fromCache);
    runs.set(id, run);
    active = run;
    sendJson(res, 200, { run_id: id, run_dir: dir });
  }

  function handleEvents(req: http.IncomingMessage, res: http.ServerResponse, id: string): void {
    const run = runs.get(id) ?? null;
    const dir = path.join(runsDir, ...id.split('/'));
    if (!run && !isDir(dir)) {
      sendJson(res, 404, { error: `run "${id}" not found` });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');

    if (!run) {
      // Finished before this server started (or launched from the CLI): report the outcome from disk.
      if (fs.existsSync(path.join(dir, 'report.json'))) {
        res.write(`event: done\ndata: ${JSON.stringify({ run_id: id, run_dir: dir, code: 0, replayed: false })}\n\n`);
      } else {
        const err = readJsonFile<ErrorLike>(path.join(dir, 'error.json'));
        res.write(`event: error\ndata: ${JSON.stringify({ run_id: id, run_dir: dir, code: null, message: err?.message ?? 'run is not in memory and has no report.json', stderr: '' })}\n\n`);
      }
      res.end();
      return;
    }

    // Replay from Last-Event-ID (browser reconnects) or from the start.
    const lastHeader = req.headers['last-event-id'];
    const last = Number.parseInt(Array.isArray(lastHeader) ? lastHeader[0] : (lastHeader ?? ''), 10);
    const start = Number.isFinite(last) ? last + 1 : 0;
    for (let i = start; i < run.lines.length; i++) res.write(sseLine(i, run.lines[i]));
    if (run.status !== 'running') {
      res.write(terminalFrame(run));
      res.end();
      return;
    }
    run.listeners.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), SSE_PING_MS);
    req.on('close', () => {
      clearInterval(ping);
      run.listeners.delete(res);
    });
  }

  function handleReport(res: http.ServerResponse, id: string): void {
    const dir = path.join(runsDir, ...id.split('/'));
    const send = (file: string, status: 'done' | 'partial') => {
      fs.readFile(file, (err, data) => {
        if (err) {
          sendJson(res, 500, { error: `could not read ${file}` });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Audit-Status': status });
        res.end(data);
      });
    };
    if (fs.existsSync(path.join(dir, 'report.json'))) return send(path.join(dir, 'report.json'), 'done');
    if (fs.existsSync(path.join(dir, 'report.partial.json'))) return send(path.join(dir, 'report.partial.json'), 'partial');
    const live = runs.get(id);
    if (live && live.status === 'running') {
      sendJson(res, 404, { status: 'running', error: 'audit is still running' });
      return;
    }
    if (!live && !isDir(dir)) {
      sendJson(res, 404, { status: 'error', error: `run "${id}" not found` });
      return;
    }
    const err = readJsonFile<ErrorLike>(path.join(dir, 'error.json'));
    sendJson(res, 404, { status: 'error', error: err?.message ?? live?.message ?? 'no report.json (run did not finish)' });
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const q = rawUrl.indexOf('?');
    const rawPath = q >= 0 ? rawUrl.slice(0, q) : rawUrl;

    if (method === 'GET' && (rawPath === '/' || rawPath === '/index.html')) return serveIndex(res);
    if (method === 'GET' && rawPath === '/api/industries') {
      try {
        return sendJson(res, 200, loadIndustries());
      } catch (e) {
        return sendJson(res, 500, { error: `could not read config/industries.yaml: ${(e as Error).message}` });
      }
    }
    if (method === 'GET' && rawPath === '/api/modules') return sendJson(res, 200, MODULES);
    if (method === 'GET' && rawPath === '/api/runs') return sendJson(res, 200, scanRuns());
    if (method === 'POST' && rawPath === '/api/audit') return handleAudit(req, res);

    const m = rawPath.match(/^\/api\/runs\/(.+)\/(events|report)$/);
    if (m && method === 'GET') {
      const id = m[1];
      if (!RUN_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid run id (expected <host>/<timestamp>)' });
      return m[2] === 'events' ? handleEvents(req, res, id) : handleReport(res, id);
    }
    if (method === 'GET' && rawPath.startsWith('/runs/')) return serveRunFile(rawPath, res);
    sendJson(res, 404, { error: 'not found' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      if (!res.headersSent) sendJson(res, 500, { error: (e as Error).message });
      else res.end();
    });
  });
  server.on('close', () => {
    for (const run of runs.values()) {
      if (run.status === 'running') run.child.kill('SIGTERM');
    }
  });
  return server;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

const isMain = (() => {
  try {
    return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? '', 10) || 8790;
  const resolved = resolveOptions();
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`website-audit UI · http://127.0.0.1:${port}/`);
    console.log(`  runs: ${resolved.runsDir}`);
  });
}
