// Candidate pool for subpath items: the top-level pages linked from the home page, in document order.
// Deterministic (no LLM). The audit measures what a visitor who lands on the home page can reach in one
// tap, so blog posts and deep pages that only the sitemap knows about are out of scope by design.
import { classifyUrl, normalizeUrl, stripSiteHost } from '../urls.js';

export interface CandidatePool {
  rule: 'home-links-top-level';
  /** Path depth relative to the home page's path that was used (1 = direct children of the home path). */
  relative_depth: number;
  /** Pages to judge, in the order they first appear on the home page (header nav before footer). */
  urls: string[];
  /** Pages at the chosen depth dropped by the cap, in order. */
  capped: string[];
  cap: number;
  /** Distinct same-origin links on the home page (any depth) after normalization, excluding home itself. */
  considered: number;
}

function segments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/**
 * Build the pool from the home page's own links. Relative depth 1 is preferred; when fewer than two such
 * links exist (e.g. a CMS that nests every page under /pages/), the shallowest depth with at least two
 * links is used instead. The cap keeps the first N in document order and records the rest as `capped`.
 */
export function buildCandidatePool(home: { url: string; links: string[] }, cap: number): CandidatePool {
  const safeCap = Math.max(0, Math.floor(Number.isFinite(cap) ? cap : 0));
  const homeNorm = normalizeUrl(home.url);
  const empty: CandidatePool = { rule: 'home-links-top-level', relative_depth: 1, urls: [], capped: [], cap: safeCap, considered: 0 };
  if (!homeNorm) return empty;
  const homeUrl = new URL(homeNorm);
  const originHost = homeUrl.hostname;
  const homeSegs = segments(homeUrl.pathname);
  const seen = new Set<string>();
  const byDepth = new Map<number, string[]>();
  let considered = 0;

  for (const raw of home.links) {
    const norm = normalizeUrl(raw);
    if (!norm) continue;
    if (classifyUrl(norm, originHost).kind !== 'same_origin') continue;
    const u = new URL(norm);
    if (stripSiteHost(u.hostname) === stripSiteHost(originHost)) u.hostname = originHost;
    if (u.protocol === 'http:') u.protocol = 'https:';
    const key = u.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === homeNorm) continue;
    considered++;
    const segs = segments(u.pathname);
    if (homeSegs.some((s, i) => segs[i] !== s)) continue; // not under the home path
    const depth = segs.length - homeSegs.length;
    if (depth < 1) continue;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)!.push(key);
  }

  let chosen = 1;
  if ((byDepth.get(1)?.length ?? 0) < 2) {
    const alt = [...byDepth.keys()].sort((a, b) => a - b).find((d) => (byDepth.get(d)?.length ?? 0) >= 2);
    if (alt !== undefined) chosen = alt;
  }
  const all = byDepth.get(chosen) ?? [];
  return { rule: 'home-links-top-level', relative_depth: chosen, urls: all.slice(0, safeCap), capped: all.slice(safeCap), cap: safeCap, considered };
}
