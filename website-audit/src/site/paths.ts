// Path and link helpers shared by the render, SEO, and validation stages.
//
// The mockup profile is opened straight off disk over file://, so every link must be a relative path
// to a real index.html. The production profile is served from a host, so links are root-absolute and
// canonical/OG URLs are built from --base-url.
import path from 'node:path';
import type { BuildProfile } from './types.js';

/** '/' → 0, '/faq/' → 1, '/services/lawn/' → 2. */
export function depthOf(sitePath: string): number {
  return sitePath.split('/').filter(Boolean).length;
}

/** Site path → the file it is written to, relative to the site dir. */
export function fileForPath(sitePath: string): string {
  if (sitePath === '/') return 'index.html';
  return `${sitePath.replace(/^\/+/, '')}index.html`;
}

/** Site path → the markdown mirror used by llms.txt. */
export function markdownForPath(sitePath: string): string {
  return fileForPath(sitePath).replace(/index\.html$/, 'index.md');
}

/** Normalise a planned path to the '/a/b/' shape. Returns null when it cannot be made safe. */
export function normalizeSitePath(raw: string): string | null {
  let p = raw.trim();
  if (!p) return null;
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p === '/') return '/';
  p = p.replace(/index\.html$/i, '');
  if (!p.endsWith('/')) p = `${p}/`;
  if (p.includes('..') || /[^a-z0-9/-]/.test(p)) return null;
  return p;
}

/** A link from one page to another, in the form the profile requires. */
export function hrefBetween(fromPath: string, toPath: string, profile: BuildProfile): string {
  if (profile === 'production') return toPath;
  const up = '../'.repeat(depthOf(fromPath));
  return `${up}${fileForPath(toPath)}`;
}

/** A link from a page to a file under the site root (a stylesheet, an image). */
export function assetHref(fromPath: string, assetPath: string, profile: BuildProfile): string {
  const clean = assetPath.replace(/^\/+/, '');
  if (profile === 'production') return `/${clean}`;
  return `${'../'.repeat(depthOf(fromPath))}${clean}`;
}

/** Absolute URL for canonical, OG, JSON-LD @id, and the sitemap. */
export function absoluteUrl(baseUrl: string, sitePath: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return sitePath === '/' ? `${base}/` : `${base}${sitePath}`;
}

/** Where a generated file lands on disk. */
export function outputFile(siteDir: string, sitePath: string): string {
  return path.join(siteDir, fileForPath(sitePath));
}
