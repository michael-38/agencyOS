import { ScrapedPage } from './scrape.js';
import { headTail } from '../utils/excerpt.js';

export interface CorpusOptions {
  maxChars?: number;        // total cap; default 100_000
  perPageMaxChars?: number; // outlier-page cap; default 12_000
  preferredServices?: string[]; // bias tier-2 selection toward these
  homepageMaxChars?: number;    // hard abort if homepage exceeds this; default 40_000
}

const DEFAULT_MAX_CHARS = 100_000;
const DEFAULT_PER_PAGE_MAX = 12_000;
const DEFAULT_HOMEPAGE_MAX = 60_000;

const TIER_1_PATTERNS: RegExp[] = [
  /^\/?$/,                                                              // homepage path "/"
  /\/services?(\/|$)/i,
  /\/treatments?(\/|$)/i,
  /\/menu(\/|$)/i,
  /\/about(-us)?(\/|$)/i,
  /\/team(\/|$)/i,
  /\/our-team(\/|$)/i,
  /\/staff(\/|$)/i,
  /\/providers?(\/|$)/i,
  /\/pricing(\/|$)/i,
  /\/prices(\/|$)/i,
  /\/membership(\/|$)/i,
  /\/faq(s)?(\/|$)/i,
  /\/contact(\/|$)/i,
  /\/book(ing)?(\/|$)/i,
  /\/consultation(\/|$)/i,
  /\/locations?(\/|$)/i,
  /\/policies(\/|$)/i, // some clinics list hours under /policies
  /\/safety(\/|$)/i,
];

const TIER_3_DROP: RegExp[] = [
  /\/privacy/i,
  /\/terms/i,
  /\/cookie/i,
  /\/shipping/i,
  /\/careers/i,
  /\/jobs/i,
  /\/legal/i,
  /\/(tag|category|author|page)\//i,
  /\/wp-/i,
  /\/(login|signin|signup|account)/i,
];

const TIER_3_OPTIONAL: RegExp[] = [
  /\/blog/i,
  /\/news/i,
  /\/press/i,
  /\/articles?/i,
];

export type Tier = 1 | 2 | 3;

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

export function classifyPage(url: string, preferredServices: string[] = []): Tier | null {
  const pathname = pathOf(url);

  if (TIER_3_DROP.some((re) => re.test(pathname))) return null;
  if (TIER_1_PATTERNS.some((re) => re.test(pathname))) return 1;

  // Individual treatment pages: /services/<slug> or /treatments/<slug>
  if (/^\/(services?|treatments?|menu)\/.+/i.test(pathname)) {
    if (preferredServices.length === 0) return 2;
    const slug = pathname.toLowerCase();
    const matches = preferredServices.some((svc) =>
      slug.includes(svc.toLowerCase().replace(/\s+/g, '-'))
    );
    return matches ? 2 : 3;
  }

  if (TIER_3_OPTIONAL.some((re) => re.test(pathname))) return 3;

  // Unknown — default to tier 3 (kept only if budget allows)
  return 3;
}

// Strips low-signal noise from inner-page markdown:
//   - Inline image lines: lines that are just a markdown image or a markdown link
//     wrapping an image, often CDN-hosted asset URLs (~3–5K chars per page).
//   - Bare CDN/asset URL lines (lines that are only a URL with query params for
//     image variants).
//   - Repeated nav-block patterns (the same site nav prepended on every page).
//   - Cookie / accessibility tool boilerplate (Userway, Accessibe, "We use cookies").
//
// Conservative — anything we're unsure about, leave in. The homepage bypasses
// this entirely so footer content with hours/address/financing stays intact.
export function cleanPageMarkdown(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const out: string[] = [];

  const COOKIE_RX = /(we use cookies|accept cookies|cookie consent|cookie policy|cookie settings|cookie preferences)/i;
  const ACCESS_RX = /(accessibility statement|userway|accessibe|powered by accessibe|adjust the (?:text|font) size|increase text|decrease text)/i;
  const PURE_IMAGE_LINE_RX = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;
  const LINK_WRAPPING_IMAGE_RX = /^\s*\[\s*!\[[^\]]*\]\([^)]*\)\s*\]\([^)]*\)\s*$/;
  const BARE_CDN_URL_RX = /^\s*\(?\s*https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s)]*)?\s*\)?\s*$/i;

  let skipUntilBlank = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (skipUntilBlank) {
      if (line.trim() === '') skipUntilBlank = false;
      continue;
    }

    if (COOKIE_RX.test(line) || ACCESS_RX.test(line)) {
      skipUntilBlank = true;
      continue;
    }

    if (PURE_IMAGE_LINE_RX.test(line)) continue;
    if (LINK_WRAPPING_IMAGE_RX.test(line)) continue;
    if (BARE_CDN_URL_RX.test(line)) continue;

    out.push(line);
  }

  // Collapse 3+ consecutive blank lines to 2
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isHomepage(url: string): boolean {
  return pathOf(url) === '/' || pathOf(url) === '';
}

export interface CorpusResult {
  text: string;
  includedPages: { url: string; tier: Tier; chars: number }[];
  droppedPages: { url: string; reason: 'tier-3-drop' | 'over-budget' | 'tier-2-low-priority' }[];
  totalChars: number;
}

export function buildCorpus(pages: ScrapedPage[], options: CorpusOptions = {}): CorpusResult {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const perPageMax = options.perPageMaxChars ?? DEFAULT_PER_PAGE_MAX;
  const homepageMax = options.homepageMaxChars ?? DEFAULT_HOMEPAGE_MAX;
  const preferredServices = options.preferredServices ?? [];

  // Homepage hard guard — abort before any LLM spend.
  const homepage = pages.find((p) => isHomepage(p.url)) ?? pages[0];
  if (homepage && homepage.markdown.length > homepageMax) {
    throw new Error(
      `Homepage markdown is ${homepage.markdown.length.toLocaleString()} chars ` +
      `(over ${homepageMax.toLocaleString()} limit). Aborting audit for ${homepage.url}. ` +
      `Raise the limit if you really want to send this much to Claude — but the model ` +
      `will get a less focused signal from a 40K+ char homepage.`
    );
  }

  const classified: { page: ScrapedPage; tier: Tier }[] = [];
  const droppedPages: CorpusResult['droppedPages'] = [];

  for (const page of pages) {
    const tier = classifyPage(page.url, preferredServices);
    if (tier === null) {
      droppedPages.push({ url: page.url, reason: 'tier-3-drop' });
      continue;
    }
    classified.push({ page, tier });
  }

  // Sort: tier asc, then homepage first, then alphabetical
  classified.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (isHomepage(a.page.url)) return -1;
    if (isHomepage(b.page.url)) return 1;
    return a.page.url.localeCompare(b.page.url);
  });

  // Cap tier-2 to top 5 (the highest-priority service pages)
  const tier2Indices = classified.map((c, i) => (c.tier === 2 ? i : -1)).filter((i) => i >= 0);
  if (tier2Indices.length > 5) {
    for (const idx of tier2Indices.slice(5)) {
      droppedPages.push({ url: classified[idx].page.url, reason: 'tier-2-low-priority' });
      classified[idx] = null as any;
    }
  }
  const kept = classified.filter(Boolean) as { page: ScrapedPage; tier: Tier }[];

  // Per-page cleaning + trim:
  //   - homepage → full markdown, untouched
  //   - inner pages → cleanPageMarkdown then head+tail if still too long
  const includedPages: CorpusResult['includedPages'] = [];
  const sections: string[] = [];
  let totalChars = 0;

  for (const { page, tier } of kept) {
    let body: string;
    if (isHomepage(page.url)) {
      body = page.markdown; // verbatim — preserves nav + footer (hours, address, financing)
    } else {
      const cleaned = cleanPageMarkdown(page.markdown);
      body = cleaned.length > perPageMax
        ? headTail(cleaned, Math.floor(perPageMax * 0.7), Math.floor(perPageMax * 0.3))
        : cleaned;
    }
    const section = `# ${page.url}\n\n${body}\n`;
    if (totalChars + section.length > maxChars) {
      droppedPages.push({ url: page.url, reason: 'over-budget' });
      continue;
    }
    sections.push(section);
    includedPages.push({ url: page.url, tier, chars: section.length });
    totalChars += section.length;
  }

  return {
    text: sections.join('\n---\n\n'),
    includedPages,
    droppedPages,
    totalChars,
  };
}
