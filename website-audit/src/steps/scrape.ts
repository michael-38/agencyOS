// Step 4: scrape one page (mobile primary with probe + full-page screenshot; desktop secondary screenshot),
// persist raw artifacts, and cut the mobile screenshot into judge-readable tiles.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LIMITS, VIEWPORTS } from '../config.js';
import type { FirecrawlService, PageRole, ScrapedDoc } from '../firecrawl.js';
import type { ProbeResult } from '../checks/registry.js';
import type { Progress } from '../progress.js';

export interface PageFiles {
  mobile: string | null;
  desktop: string | null;
  mobileFold: string | null;
  desktopFold: string | null;
  tiles: string[];
}

export interface PageRecord {
  key: string;
  url: string;
  finalUrl: string | null;
  role: PageRole;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  markdown: string;
  rawHtml: string;
  links: string[];
  probe: ProbeResult | null;
  probeError: string | null;
  files: PageFiles;
  markdownPath: string | null;
  htmlPath: string | null;
  judgeTextPath: string | null;
  dpr: number | null;
  imageSize: { width: number; height: number } | null;
  tilesTotal: number;
  creditsUsed: number;
  cacheHits: number;
  error: string | null;
}

const MAX_TILES_PERSISTED = 12;

function parseProbe(raw: string | null): { probe: ProbeResult | null; error: string | null } {
  if (!raw) return { probe: null, error: 'probe returned nothing' };
  try {
    let v: unknown = JSON.parse(raw);
    if (typeof v === 'string') v = JSON.parse(v); // double-encoded
    const p = v as ProbeResult;
    if (p && typeof p === 'object' && 'probe_version' in p) return p.error ? { probe: p, error: p.error } : { probe: p, error: null };
    return { probe: null, error: 'probe returned an unexpected shape' };
  } catch (e) {
    return { probe: null, error: `probe JSON parse failed: ${(e as Error).message}` };
  }
}

async function cutTiles(runDir: string, mobileRel: string, key: string): Promise<{ fold: string | null; tiles: string[]; dpr: number | null; size: { width: number; height: number } | null; tilesTotal: number }> {
  const abs = path.join(runDir, mobileRel);
  const meta = await sharp(abs).metadata();
  if (!meta.width || !meta.height) return { fold: null, tiles: [], dpr: null, size: null, tilesTotal: 0 };
  const dpr = meta.width / VIEWPORTS.mobile.width;
  const foldH = Math.min(meta.height, Math.round(VIEWPORTS.mobile.height * dpr));
  const dir = path.join('raw', 'pages', key);
  fs.mkdirSync(path.join(runDir, dir, 'mobile.tiles'), { recursive: true });
  const foldRel = path.join(dir, 'mobile.fold.png');
  await sharp(abs).extract({ left: 0, top: 0, width: meta.width, height: foldH }).png().toFile(path.join(runDir, foldRel));
  const tileH = Math.max(VIEWPORTS.mobile.height, Math.min(LIMITS.maxTileEdgePx, Math.floor(LIMITS.maxTileEdgePx / dpr) * Math.max(1, Math.round(dpr))));
  const effectiveTileH = Math.min(tileH, LIMITS.maxTileEdgePx);
  const tilesTotal = Math.ceil(meta.height / effectiveTileH);
  const tiles: string[] = [];
  for (let i = 0; i < Math.min(tilesTotal, MAX_TILES_PERSISTED); i++) {
    const top = i * effectiveTileH;
    const h = Math.min(effectiveTileH, meta.height - top);
    if (h <= 0) break;
    const rel = path.join(dir, 'mobile.tiles', `${String(i + 1).padStart(2, '0')}.png`);
    await sharp(abs).extract({ left: 0, top, width: meta.width, height: h }).png().toFile(path.join(runDir, rel));
    tiles.push(rel);
  }
  return { fold: foldRel, tiles, dpr, size: { width: meta.width, height: meta.height }, tilesTotal };
}

async function cutDesktopFold(runDir: string, desktopRel: string, key: string): Promise<string | null> {
  const abs = path.join(runDir, desktopRel);
  const meta = await sharp(abs).metadata();
  if (!meta.width || !meta.height) return null;
  const dpr = meta.width / VIEWPORTS.desktop.width;
  const foldH = Math.min(meta.height, Math.round(VIEWPORTS.desktop.height * dpr));
  const rel = path.join('raw', 'pages', key, 'desktop.fold.png');
  await sharp(abs).extract({ left: 0, top: 0, width: meta.width, height: foldH }).png().toFile(path.join(runDir, rel));
  return rel;
}

export interface ScrapePageOptions {
  desktop: boolean;
  probeScript: string;
  runDir: string;
  progress: Progress;
}

function persistDoc(runDir: string, doc: ScrapedDoc, name: string): void {
  const dir = path.join(runDir, 'raw', 'pages', doc.pageKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(doc, null, 2));
}

export async function scrapePage(fc: FirecrawlService, url: string, role: PageRole, opts: ScrapePageOptions): Promise<PageRecord> {
  const { runDir, progress } = opts;
  const mobile = await fc.scrape({ url, role, viewport: 'mobile', formats: ['markdown', 'rawHtml', 'links'], screenshot: true, probe: opts.probeScript });
  const doc = mobile.doc;
  persistDoc(runDir, doc, 'mobile');
  const dir = path.join('raw', 'pages', doc.pageKey);
  const markdownPath = path.join(dir, 'page.md');
  const htmlPath = path.join(dir, 'page.html');
  fs.writeFileSync(path.join(runDir, markdownPath), doc.markdown);
  fs.writeFileSync(path.join(runDir, htmlPath), doc.rawHtml);
  const { probe, error: probeError } = parseProbe(doc.probeRaw);
  fs.writeFileSync(path.join(runDir, dir, 'probe.json'), JSON.stringify(probe ?? { error: probeError }, null, 2));
  if (probeError) progress.info(`probe unavailable for ${url}: ${probeError} (layout checks fall back, capped at partial)`);

  const files: PageFiles = { mobile: doc.screenshotPath, desktop: null, mobileFold: null, desktopFold: null, tiles: [] };
  let dpr: number | null = null;
  let imageSize: PageRecord['imageSize'] = null;
  let tilesTotal = 0;
  if (doc.screenshotPath) {
    try {
      const cut = await cutTiles(runDir, doc.screenshotPath, doc.pageKey);
      files.mobileFold = cut.fold;
      files.tiles = cut.tiles;
      dpr = cut.dpr;
      imageSize = cut.size;
      tilesTotal = cut.tilesTotal;
      progress.log(`tiles: ${cut.tiles.length}/${cut.tilesTotal} (image ${cut.size?.width}x${cut.size?.height}, dpr ${cut.dpr?.toFixed(2)})`);
    } catch (e) {
      progress.info(`tiling failed for ${url}: ${(e as Error).message}`);
    }
  }
  let creditsUsed = mobile.hit ? 0 : doc.creditsUsed;
  let cacheHits = mobile.hit ? 1 : 0;
  if (opts.desktop) {
    try {
      const desktop = await fc.scrape({ url, role, viewport: 'desktop', formats: [], screenshot: true });
      persistDoc(runDir, desktop.doc, 'desktop');
      files.desktop = desktop.doc.screenshotPath;
      if (desktop.doc.screenshotPath) files.desktopFold = await cutDesktopFold(runDir, desktop.doc.screenshotPath, doc.pageKey);
      if (!desktop.hit) creditsUsed += desktop.doc.creditsUsed;
      else cacheHits++;
    } catch (e) {
      progress.info(`desktop scrape failed for ${url}: ${(e as Error).message}`);
    }
  }
  return {
    key: doc.pageKey,
    url,
    finalUrl: doc.finalUrl,
    role,
    statusCode: doc.statusCode,
    title: doc.title,
    description: doc.description,
    markdown: doc.markdown,
    rawHtml: doc.rawHtml,
    links: doc.links,
    probe: probe && !probeError ? probe : null,
    probeError,
    files,
    markdownPath,
    htmlPath,
    judgeTextPath: null,
    dpr,
    imageSize,
    tilesTotal,
    creditsUsed,
    cacheHits,
    error: doc.error,
  };
}

/** Desktop screenshot only (the mobile scrape already happened); fills files.desktop/desktopFold on the record. */
export async function addDesktopShot(fc: FirecrawlService, page: PageRecord, runDir: string, progress: Progress): Promise<void> {
  try {
    const desktop = await fc.scrape({ url: page.url, role: page.role, viewport: 'desktop', formats: [], screenshot: true });
    persistDoc(runDir, desktop.doc, 'desktop');
    page.files.desktop = desktop.doc.screenshotPath;
    if (desktop.doc.screenshotPath) page.files.desktopFold = await cutDesktopFold(runDir, desktop.doc.screenshotPath, page.key);
    if (!desktop.hit) page.creditsUsed += desktop.doc.creditsUsed;
    else page.cacheHits++;
  } catch (e) {
    progress.info(`desktop scrape failed for ${page.url}: ${(e as Error).message}`);
  }
}
