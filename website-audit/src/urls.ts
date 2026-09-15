// URL normalization, dedupe, and same-site partitioning. Shared by the map step, the
// evaluator, and the eval runner so human-written and pipeline URLs compare equal.

export interface NormalizedLink {
  url: string;          // normalized form
  original: string;     // shortest original spelling seen
  title?: string;
  description?: string;
  depth: number;        // path segment count
}
export interface DroppedLink { url: string; reason: string }
export interface NormalizedMap {
  same_origin: NormalizedLink[];
  subdomain: NormalizedLink[];
  dropped: DroppedLink[];
  subdomain_share: number;
  total_input: number;
}

const ASSET_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|css|js|mjs|xml|json|txt|zip|mp4|mp3|webm|ico|woff2?|ttf|eot)$/i;
const NOISE_PATH = /(^|\/)(wp-json|wp-admin|wp-content|wp-includes|feed|xmlrpc\.php|cdn-cgi|tag|category|author|search)(\/|$)/i;
const PAGINATION = /(^|\/)page\/\d+(\/|$)|(^|\/)p\d+(\/|$)/i;
const LEGAL_SEGMENT = /^(privacy|privacy-policy|privacy_policy|terms|terms-of-service|terms-and-conditions|terms-of-use|terms_of_service|tos|legal|cookie|cookies|cookie-policy|disclaimer|accessibility|accessibility-statement|gdpr|ccpa|refund-policy|return-policy|sitemap)$/i;
const JUNK_SUBDOMAIN = /^(mail|cpanel|webmail|autodiscover|autoconfig|ftp|smtp|imap|pop|ns\d*|mx\d*|cdn|static|assets|calendar|owa)\./i;

export function stripSiteHost(host: string): string {
  return host.toLowerCase().replace(/^(www|m)\./, '');
}

export function sameSite(a: string, b: string): boolean {
  return stripSiteHost(a) === stripSiteHost(b);
}

/** Normalize a raw input string into a URL: trims, adds https://, lowercases host, drops fragment. */
export function normalizeInput(input: string): { url: URL; schemeAdded: boolean } {
  let s = input.trim();
  let schemeAdded = false;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = `https://${s}`;
    schemeAdded = true;
  }
  const url = new URL(s);
  if (!/^https?:$/.test(url.protocol)) throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  return { url, schemeAdded };
}

/** Canonical form for dedupe. Returns null for non-http(s) or unparsable URLs. */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  u.hash = '';
  u.search = '';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  let p = u.pathname.replace(/\/{2,}/g, '/');
  p = p.replace(/\/index\.(html?|php)$/i, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep as-is */
  }
  u.pathname = p;
  return u.toString();
}

export function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 99;
  }
}

export function lastSegment(url: string): string {
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean);
    return segs[segs.length - 1] ?? '';
  } catch {
    return '';
  }
}

export type UrlClass =
  | { kind: 'same_origin' }
  | { kind: 'subdomain' }
  | { kind: 'dropped'; reason: string };

/** Classify one normalized URL relative to the resolved origin. */
export function classifyUrl(normalized: string, originHost: string): UrlClass {
  const u = new URL(normalized);
  const host = u.hostname;
  const site = stripSiteHost(originHost);
  const hostSite = stripSiteHost(host);
  const isSame = hostSite === site;
  const isSub = !isSame && hostSite.endsWith(`.${site}`);
  if (!isSame && !isSub) return { kind: 'dropped', reason: 'external' };
  if (isSub && JUNK_SUBDOMAIN.test(host)) return { kind: 'dropped', reason: 'junk-subdomain' };
  const p = u.pathname;
  if (ASSET_EXT.test(p)) return { kind: 'dropped', reason: 'asset' };
  if (NOISE_PATH.test(p)) return { kind: 'dropped', reason: 'noise' };
  if (PAGINATION.test(p)) return { kind: 'dropped', reason: 'pagination' };
  if (LEGAL_SEGMENT.test(lastSegment(normalized))) return { kind: 'dropped', reason: 'legal' };
  return isSame ? { kind: 'same_origin' } : { kind: 'subdomain' };
}

export interface RawLink { url: string; title?: string; description?: string }

/** Normalize + dedupe a map result. Keeps the shortest original spelling per normalized key; https wins over http. */
export function normalizeMap(links: RawLink[], origin: string): NormalizedMap {
  const originHost = new URL(origin).hostname;
  const originSite = stripSiteHost(originHost);
  const dropped: DroppedLink[] = [];
  const byKey = new Map<string, NormalizedLink & { cls: 'same_origin' | 'subdomain' }>();

  for (const link of links) {
    const norm = normalizeUrl(link.url);
    if (!norm) {
      dropped.push({ url: link.url, reason: 'unparsable' });
      continue;
    }
    const cls = classifyUrl(norm, originHost);
    if (cls.kind === 'dropped') {
      dropped.push({ url: link.url, reason: cls.reason });
      continue;
    }
    // Fold www./m./bare variants of the site host onto the origin's host form.
    const u = new URL(norm);
    if (cls.kind === 'same_origin' && stripSiteHost(u.hostname) === originSite) u.hostname = originHost;
    if (u.protocol === 'http:') u.protocol = 'https:';
    const key = u.toString();
    const existing = byKey.get(key);
    if (existing) {
      if (link.url.length < existing.original.length) existing.original = link.url;
      existing.title ||= link.title;
      existing.description ||= link.description;
      continue;
    }
    byKey.set(key, {
      url: key,
      original: link.url,
      title: link.title,
      description: link.description,
      depth: pathDepth(key),
      cls: cls.kind,
    });
  }

  const sortFn = (a: NormalizedLink, b: NormalizedLink) => a.depth - b.depth || a.url.length - b.url.length || a.url.localeCompare(b.url);
  const same_origin = [...byKey.values()].filter((l) => l.cls === 'same_origin').map(({ cls: _c, ...l }) => l).sort(sortFn);
  const subdomain = [...byKey.values()].filter((l) => l.cls === 'subdomain').map(({ cls: _c, ...l }) => l).sort(sortFn);
  const subdomainInput = links.filter((l) => {
    const n = normalizeUrl(l.url);
    if (!n) return false;
    const h = new URL(n).hostname;
    return stripSiteHost(h) !== originSite && stripSiteHost(h).endsWith(`.${originSite}`);
  }).length;
  return {
    same_origin,
    subdomain,
    dropped,
    subdomain_share: links.length ? subdomainInput / links.length : 0,
    total_input: links.length,
  };
}

/** Path slugs for the classifier: "/services/lawn-care" → "services lawn-care". */
export function pathSlugs(urls: string[], limit: number): string[] {
  const out: string[] = [];
  for (const u of urls) {
    try {
      const url = new URL(u);
      const segs = url.pathname.split('/').filter(Boolean);
      const host = stripSiteHost(url.hostname);
      const slug = segs.length ? segs.join(' ') : '/';
      out.push(host ? `${host}: ${slug}` : slug);
    } catch {
      /* skip */
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Compare two URLs for eval purposes (human-written vs pipeline). */
export function urlsEqual(a: string, b: string): boolean {
  const na = normalizeUrl(a), nb = normalizeUrl(b);
  if (!na || !nb) return false;
  const ua = new URL(na), ub = new URL(nb);
  return sameSite(ua.hostname, ub.hostname) && ua.pathname === ub.pathname;
}
