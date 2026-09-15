// Firecrawl v2 SDK wrapper: map + scrape only (never crawl). Every call goes through the run cache.
// Screenshot URLs expire in 24h, so they are downloaded immediately and persisted under raw/pages/<key>/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Firecrawl, type Document, type MapData, type MapOptions, type ScrapeOptions } from 'firecrawl';
import { LIMITS, PROBE_VERSION, VIEWPORTS } from './config.js';
import type { RunCache } from './cache.js';
import type { Progress } from './progress.js';
import { normalizeUrl } from './urls.js';

export type PageRole = 'root' | 'home' | 'candidate';
export type ViewportName = keyof typeof VIEWPORTS;

export interface ScrapeRequest {
  url: string;
  role: PageRole;
  viewport: ViewportName;
  /** Text formats to request (desktop shots request none). */
  formats: ('markdown' | 'rawHtml' | 'links')[];
  screenshot: boolean;
  /** Probe script to run via executeJavascript (mobile only). */
  probe?: string;
}

export interface ScrapedDoc {
  requestedUrl: string;
  normalizedUrl: string;
  pageKey: string;
  role: PageRole;
  viewport: ViewportName;
  finalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  markdown: string;
  rawHtml: string;
  links: string[];
  screenshotPath: string | null; // relative to run dir
  screenshotSourceUrl: string | null;
  probeRaw: string | null;
  creditsUsed: number;
  cacheState: string | null;
  error: string | null;
  warning: string | null;
}

export function pageKeyFor(url: string): string {
  const norm = normalizeUrl(url) ?? url;
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
}

export function loadProbeScript(): string {
  const p = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'checks', 'probe.js');
  return fs.readFileSync(p, 'utf8').replace(/__PROBE_VERSION__/g, String(PROBE_VERSION)).replace(/__FOLD_HEIGHT__/g, String(VIEWPORTS.mobile.height));
}

function extFromContentType(ct: string | null, fallbackUrl: string): string {
  const c = (ct || '').toLowerCase();
  if (c.includes('png')) return 'png';
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('webp')) return 'webp';
  const m = /\.(png|jpe?g|webp)(\?|$)/i.exec(fallbackUrl);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

function javascriptReturn(doc: Document): string | null {
  const actions = doc.actions as { javascriptReturns?: unknown[] } | undefined;
  const ret = actions?.javascriptReturns?.[0];
  if (ret == null) return null;
  if (typeof ret === 'string') return ret;
  if (typeof ret === 'object' && ret && 'value' in ret) {
    const v = (ret as { value: unknown }).value;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  return JSON.stringify(ret);
}

export class FirecrawlService {
  private readonly client: Firecrawl;
  creditsUsed = 0;
  mapCalls = 0;
  scrapeCalls = 0;

  constructor(
    apiKey: string,
    private readonly cache: RunCache,
    private readonly runDir: string,
    private readonly progress: Progress,
  ) {
    this.client = new Firecrawl({ apiKey, maxRetries: LIMITS.firecrawlMaxRetries, backoffFactor: 1.8, timeoutMs: LIMITS.scrapeTimeoutMs + 30_000 });
  }

  async map(origin: string, opts: MapOptions): Promise<{ data: MapData; hit: boolean }> {
    const res = await this.cache.cached<MapData>('map', { origin, opts }, async () => {
      this.progress.log(`firecrawl.map ${origin} ${JSON.stringify(opts)}`);
      const data = await this.client.map(origin, opts);
      return { value: data };
    });
    if (!res.hit) {
      this.creditsUsed += 1;
      this.mapCalls += 1;
    }
    return { data: res.value, hit: res.hit };
  }

  async scrape(req: ScrapeRequest): Promise<{ doc: ScrapedDoc; hit: boolean }> {
    const normalizedUrl = normalizeUrl(req.url) ?? req.url;
    const pageKey = pageKeyFor(req.url);
    const vp = VIEWPORTS[req.viewport];
    const cacheRequest = {
      url: normalizedUrl,
      viewport: req.viewport,
      mobile: req.viewport === 'mobile',
      formats: req.formats,
      screenshot: req.screenshot ? { fullPage: true, viewport: vp } : null,
      probe_version: req.probe ? PROBE_VERSION : null,
    };
    const res = await this.cache.cached<ScrapedDoc>('scrape', cacheRequest, async () => {
      const formats: ScrapeOptions['formats'] = [...req.formats];
      if (req.screenshot) formats.push({ type: 'screenshot', fullPage: true, viewport: { width: vp.width, height: vp.height } });
      const options: ScrapeOptions = {
        formats,
        mobile: req.viewport === 'mobile',
        onlyMainContent: false,
        waitFor: LIMITS.scrapeWaitForMs,
        timeout: LIMITS.scrapeTimeoutMs,
        maxAge: 0,
      };
      if (req.probe) options.actions = [{ type: 'wait', milliseconds: 1000 }, { type: 'executeJavascript', script: req.probe }];
      this.progress.log(`firecrawl.scrape ${req.url} [${req.viewport}${req.screenshot ? '+shot' : ''}${req.probe ? '+probe' : ''}]`);
      const d = await this.client.scrape(req.url, options);
      const files: string[] = [];
      let screenshotPath: string | null = null;
      if (d.screenshot) {
        try {
          const r = await fetch(d.screenshot, { signal: AbortSignal.timeout(60_000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          const ext = extFromContentType(r.headers.get('content-type'), d.screenshot);
          const rel = path.join('raw', 'pages', pageKey, `${req.viewport}.${ext}`);
          fs.mkdirSync(path.join(this.runDir, path.dirname(rel)), { recursive: true });
          fs.writeFileSync(path.join(this.runDir, rel), buf);
          screenshotPath = rel;
          files.push(rel);
        } catch (e) {
          this.progress.info(`screenshot download failed for ${req.url}: ${(e as Error).message}`);
        }
      }
      const doc: ScrapedDoc = {
        requestedUrl: req.url,
        normalizedUrl,
        pageKey,
        role: req.role,
        viewport: req.viewport,
        finalUrl: d.metadata?.url ?? d.metadata?.sourceURL ?? null,
        statusCode: d.metadata?.statusCode ?? null,
        title: d.metadata?.title ?? null,
        description: d.metadata?.description ?? null,
        markdown: d.markdown ?? '',
        rawHtml: d.rawHtml ?? d.html ?? '',
        links: d.links ?? [],
        screenshotPath,
        screenshotSourceUrl: d.screenshot ?? null,
        probeRaw: req.probe ? javascriptReturn(d) : null,
        creditsUsed: d.metadata?.creditsUsed ?? 1,
        cacheState: d.metadata?.cacheState ?? null,
        error: d.metadata?.error ?? null,
        warning: d.warning ?? null,
      };
      return { value: doc, files };
    });
    if (!res.hit) {
      this.creditsUsed += res.value.creditsUsed;
      this.scrapeCalls += 1;
    }
    return { doc: res.value, hit: res.hit };
  }
}
