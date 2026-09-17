// Stage B: harvest the audited site's own imagery, optimise it, and record where each file came from.
//
// The business owns its photography, so reusing it is what makes a rebuild look like the same business
// rather than a stock-photo mockup. Anything hosted off the audited domain is downloaded but flagged
// verify_license, because the client's licence may not cover republication. Nothing is generated and
// nothing is sourced from elsewhere: a slot with no source image renders as a labelled placeholder.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { loadHtml } from '../checks/html.js';
import { stripSiteHost } from '../urls.js';
import type { RunCache } from '../cache.js';
import type { Progress } from '../progress.js';
import type { Report } from '../report/schema.js';
import type { AssetManifest, AssetRecord, AssetRole } from './types.js';

/** Long-edge budget and webp quality per role. */
const ROLE_BUDGET: Record<AssetRole, { edge: number; quality: number }> = {
  hero: { edge: 2000, quality: 78 },
  gallery: { edge: 1400, quality: 74 },
  team: { edge: 900, quality: 78 },
  logo: { edge: 480, quality: 86 },
  icon: { edge: 240, quality: 86 },
};

/**
 * Only one logo is ever placed, and a partner-logo strip is not the brand, so logos must not eat the
 * budget that exists for photographs of the work.
 */
const ROLE_CAP: Partial<Record<AssetRole, number>> = { logo: 2, team: 6 };

const MIN_EDGE = 200;
/** Below this height an image is a badge, a strip, or a seal — never a photograph of the work. */
const MIN_PHOTO_HEIGHT = 300;
/** A very wide, short image is a banner or a partner-logo strip, whatever its filename says. */
const MAX_PHOTO_ASPECT = 3.5;
const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;

// Substring, not word-bounded: real filenames look like "OLogoMain_clr.png" and "logos3.png".
const LOGO_RE = /logo/i;
const PORTRAIT_RE = /\b(team|staff|portrait|headshot|founder|owner|profile|avatar|bio)\b/i;
const CHROME_RE = /\b(sprite|icon|favicon|badge|pixel|spacer|blank|placeholder|loading|arrow|chevron|bullet)\b/i;
/** Stock-library filenames survive the download, so the report can say which photos are not the client's own. */
export const STOCK_RE = /(istock|shutterstock|gettyimages|getty-images|adobestock|adobe-stock|depositphotos|dreamstime|unsplash|pexels|pixabay|freepik|stock-photo|stockphoto)/i;

interface Harvested {
  url: string;
  alt: string;
  /** Document order across the whole corpus; lower is earlier and more likely to be the hero. */
  order: number;
  fromHome: boolean;
  inHeader: boolean;
  isOgImage: boolean;
  hintedRole: AssetRole | null;
}

function absolutize(src: string, pageUrl: string): string | null {
  const s = src.trim();
  if (!s || s.startsWith('data:') || s.startsWith('#')) return null;
  try {
    const u = new URL(s, pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Pick the largest candidate out of a srcset value. */
function widestFromSrcset(srcset: string): string | null {
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(',')) {
    const bits = part.trim().split(/\s+/);
    if (!bits[0]) continue;
    const m = /^(\d+)w$/.exec(bits[1] ?? '');
    const w = m ? parseInt(m[1], 10) : 0;
    if (!best || w > best.w) best = { url: bits[0], w };
  }
  return best ? best.url : null;
}

function hintRole(url: string, alt: string, inHeader: boolean): AssetRole | null {
  const hay = `${url} ${alt}`;
  if (LOGO_RE.test(hay) || (inHeader && /\.svg(\?|$)/i.test(url))) return 'logo';
  if (PORTRAIT_RE.test(hay)) return 'team';
  if (CHROME_RE.test(hay)) return 'icon';
  return null;
}

/** Read every page's saved HTML and collect candidate image URLs in document order. */
export function harvestImageUrls(report: Report, runDir: string): Harvested[] {
  const out: Harvested[] = [];
  const seen = new Set<string>();
  let order = 0;
  const pages = [...report.pages].sort((a, b) => (a.role === 'home' ? -1 : b.role === 'home' ? 1 : 0));
  for (const page of pages) {
    if (!page.html_path) continue;
    const abs = path.join(runDir, page.html_path);
    if (!fs.existsSync(abs)) continue;
    const $ = loadHtml(fs.readFileSync(abs, 'utf8'));
    const fromHome = page.role === 'home';

    const push = (raw: string | undefined, alt: string, inHeader: boolean, isOgImage: boolean) => {
      if (!raw) return;
      const url = absolutize(raw, page.url);
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, alt: alt.trim(), order: order++, fromHome, inHeader, isOgImage, hintedRole: hintRole(url, alt, inHeader) });
    };

    push($('meta[property="og:image"]').attr('content'), $('meta[property="og:image:alt"]').attr('content') ?? '', false, true);
    $('img').each((_, el) => {
      const $el = $(el);
      const inHeader = $el.parents('header, nav').length > 0;
      const srcset = $el.attr('srcset') ?? $el.attr('data-srcset');
      const best = srcset ? widestFromSrcset(srcset) : null;
      push(best ?? $el.attr('src') ?? $el.attr('data-src'), $el.attr('alt') ?? '', inHeader, false);
    });
    $('source[srcset]').each((_, el) => {
      const best = widestFromSrcset($(el).attr('srcset') ?? '');
      push(best ?? undefined, '', $(el).parents('header, nav').length > 0, false);
    });
  }
  return out;
}

async function download(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { accept: 'image/*,*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`${buf.length} bytes exceeds the download cap`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function slugForFile(url: string, role: AssetRole, index: number): string {
  const base = path.basename(new URL(url).pathname).replace(/\.[a-z0-9]+$/i, '');
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return `${role}-${String(index).padStart(2, '0')}${clean ? `-${clean}` : ''}.webp`;
}

export interface HarvestOptions {
  report: Report;
  runDir: string;
  /** Absolute path to the site directory; images land in <siteDir>/assets/img. */
  siteDir: string;
  cache: RunCache;
  progress: Progress;
  /** Hard cap on downloaded files, newest-first by usefulness. */
  maxAssets: number;
}

/**
 * Download, re-encode, and classify the source site's images. Roles are assigned after decoding, when
 * the real dimensions are known: the hint from the filename only decides between logo/team/icon, and
 * the first large image seen on the home page becomes the hero.
 */
export async function harvestAssets(o: HarvestOptions): Promise<AssetManifest> {
  const imgDir = path.join(o.siteDir, 'assets', 'img');
  fs.mkdirSync(imgDir, { recursive: true });
  const host = stripSiteHost(new URL(o.report.home_url).hostname);
  const candidates = harvestImageUrls(o.report, o.runDir);
  const manifest: AssetManifest = { assets: [], skipped: [], harvested: candidates.length, downloaded: 0 };
  let heroTaken = false;
  let index = 0;

  const countByRole = () => {
    const n: Partial<Record<AssetRole, number>> = {};
    for (const a of manifest.assets) n[a.role] = (n[a.role] ?? 0) + 1;
    return n;
  };
  for (const c of candidates) {
    const counts = countByRole();
    const photos = (counts.hero ?? 0) + (counts.gallery ?? 0);
    if (photos >= o.maxAssets) {
      manifest.skipped.push({ url: c.url, reason: `photo cap of ${o.maxAssets} reached` });
      continue;
    }
    if (c.hintedRole && ROLE_CAP[c.hintedRole] !== undefined && (counts[c.hintedRole] ?? 0) >= ROLE_CAP[c.hintedRole]!) {
      manifest.skipped.push({ url: c.url, reason: `already have ${ROLE_CAP[c.hintedRole]} ${c.hintedRole} image(s)` });
      continue;
    }
    if (c.hintedRole === 'icon') {
      manifest.skipped.push({ url: c.url, reason: 'looks like interface chrome, not content' });
      continue;
    }
    try {
      const cached = await o.cache.cached<{ file: string; width: number; height: number; bytes: number; role: AssetRole }>(
        'asset',
        { url: c.url, hintedRole: c.hintedRole, heroTaken, index },
        async () => {
          const buf = await download(c.url);
          const meta = await sharp(buf).metadata();
          const w = meta.width ?? 0;
          const h = meta.height ?? 0;
          if (w < MIN_EDGE && h < MIN_EDGE && c.hintedRole !== 'logo') {
            throw new Error(`too small (${w}x${h})`);
          }
          const aspect = h > 0 ? w / h : 0;
          const usableAsPhoto = h >= MIN_PHOTO_HEIGHT && aspect <= MAX_PHOTO_ASPECT;
          if (c.hintedRole !== 'logo' && !usableAsPhoto) {
            throw new Error(`not usable as photography (${w}x${h})`);
          }
          const role: AssetRole =
            c.hintedRole === 'logo' ? 'logo' : c.hintedRole === 'team' ? 'team' : !heroTaken && (c.fromHome || c.isOgImage) && w >= 900 ? 'hero' : 'gallery';
          const budget = ROLE_BUDGET[role];
          const pipeline = sharp(buf).rotate();
          const resized = w > budget.edge || h > budget.edge ? pipeline.resize({ width: budget.edge, height: budget.edge, fit: 'inside', withoutEnlargement: true }) : pipeline;
          const outBuf = await resized.webp({ quality: budget.quality }).toBuffer();
          const outMeta = await sharp(outBuf).metadata();
          const file = slugForFile(c.url, role, index);
          fs.writeFileSync(path.join(imgDir, file), outBuf);
          return {
            value: { file, width: outMeta.width ?? 0, height: outMeta.height ?? 0, bytes: outBuf.length, role },
            files: [path.join(imgDir, file)],
          };
        },
      );
      index++;
      if (cached.value.role === 'hero') heroTaken = true;
      const sameHost = stripSiteHost(new URL(c.url).hostname) === host;
      const rec: AssetRecord = {
        file: path.posix.join('assets', 'img', cached.value.file),
        source_url: c.url,
        alt_from_source: c.alt,
        bytes: cached.value.bytes,
        width: cached.value.width,
        height: cached.value.height,
        role: cached.value.role,
        same_host: sameHost,
        verify_license: !sameHost,
        likely_stock: STOCK_RE.test(c.url),
      };
      manifest.assets.push(rec);
      manifest.downloaded++;
      o.progress.log(
        `asset ${rec.role} ${rec.width}x${rec.height} ${rec.file}${rec.verify_license ? ' (off-host — verify licence)' : ''}${rec.likely_stock ? ' (looks like stock)' : ''}`,
      );
    } catch (e) {
      manifest.skipped.push({ url: c.url, reason: (e as Error).message });
    }
  }
  return manifest;
}

/** Prompt-facing summary of what imagery exists, for the design stage. */
export function assetsToPrompt(m: AssetManifest): string {
  if (!m.assets.length) return 'No usable imagery was recovered from the source site. Design for a page that has no photography at all.';
  const byRole = new Map<string, AssetRecord[]>();
  for (const a of m.assets) {
    if (!byRole.has(a.role)) byRole.set(a.role, []);
    byRole.get(a.role)!.push(a);
  }
  const lines = [...byRole.entries()].map(([role, list]) => {
    const dims = list.map((a) => `${a.width}x${a.height}`).join(', ');
    const alts = list.map((a) => a.alt_from_source).filter(Boolean).slice(0, 3);
    return `- ${role}: ${list.length} image(s) at ${dims}${alts.length ? `; the source describes them as ${alts.map((a) => `"${a}"`).join(', ')}` : ''}`;
  });
  return `These are the business's own photographs, recovered from its current site:\n${lines.join('\n')}`;
}

export function availableRoles(m: AssetManifest): string[] {
  return [...new Set(m.assets.map((a) => a.role))];
}
