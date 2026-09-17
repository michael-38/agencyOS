// Judge-input filtering: strip legal boilerplate from page markdown before the vision judge sees it, and
// (candidate pages only) strip link targets / image markup and drop blocks the home page already showed.
// Raw markdown on disk is never modified; the text actually sent is persisted alongside as judge.md.
import { stripSiteHost } from '../urls.js';

const LEGAL_HEADING = /\b(privacy|terms|legal|cookie|cookies|disclaimer|gdpr|ccpa|copyright)\b/i;
const COOKIE_LINE =
  /(we use cookies|this (web)?site uses cookies|uses cookies to|accept all( cookies)?|reject all|cookie settings|manage (cookie )?preferences|cookie consent|cookie policy|by (continuing|clicking).*cookies)/i;
const FOOTER_LEGAL =
  /((©|\(c\)|copyright)\s*\d{4}|all rights reserved|privacy policy\s*[|·•\-–]\s*terms|terms\s*(of|&|and)\s*(service|use|conditions)|site (by|design by)|powered by)/i;
const LEGAL_KEYWORDS = [
  'privacy policy',
  'terms of service',
  'terms and conditions',
  'terms of use',
  'personal data',
  'personal information',
  'liability',
  'governing law',
  'arbitration',
  'third-party cookies',
  'third party cookies',
  'data controller',
  'gdpr',
  'ccpa',
  'opt-out',
  'indemnif',
  'warranties',
  'disclaim',
];

export interface FilterResult {
  text: string;
  removedChars: number;
  truncated: boolean;
  removedBlocks: number;
}

export interface LegalResult {
  text: string;
  removedChars: number;
  removedBlocks: number;
}

function headingLevel(line: string): number | null {
  const m = /^(#{1,6})\s+\S/.exec(line);
  return m ? m[1].length : null;
}

/** Drop legal sections, cookie banners, footer legal lines, and legal-keyword-dense paragraphs. No cap. */
export function stripLegal(markdown: string): LegalResult {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];
  let skipUntilLevel: number | null = null;
  let removedBlocks = 0;

  // Pass 1: drop whole legal sections (heading + content until a heading of same/higher level).
  for (const line of lines) {
    const lvl = headingLevel(line);
    if (lvl !== null) {
      if (skipUntilLevel !== null && lvl <= skipUntilLevel) skipUntilLevel = null;
      if (skipUntilLevel === null && LEGAL_HEADING.test(line.replace(/^#+\s*/, ''))) {
        skipUntilLevel = lvl;
        removedBlocks++;
        continue;
      }
    }
    if (skipUntilLevel !== null) continue;
    kept.push(line);
  }

  // Pass 2: drop cookie-consent blocks, footer legal lines, and legal-keyword-dense paragraphs.
  const blocks = kept.join('\n').split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    if (b.length < 600 && COOKIE_LINE.test(b)) {
      removedBlocks++;
      continue;
    }
    if (b.length < 400 && FOOTER_LEGAL.test(b)) {
      removedBlocks++;
      continue;
    }
    const lower = b.toLowerCase();
    const hits = LEGAL_KEYWORDS.filter((k) => lower.includes(k)).length;
    if (hits >= 2) {
      removedBlocks++;
      continue;
    }
    out.push(b);
  }

  const text = out.join('\n\n');
  return { text, removedChars: Math.max(0, markdown.length - text.length), removedBlocks };
}

/** Cap length with a visible marker. */
export function capText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, maxChars)}\n\n[… truncated at ${maxChars} characters …]`, truncated: true };
}

/** Strip legal boilerplate then cap length (the home-page judge text). */
export function filterForJudge(markdown: string, maxChars: number): FilterResult {
  const legal = stripLegal(markdown);
  const capped = capText(legal.text, maxChars);
  return { text: capped.text, removedChars: legal.removedChars, truncated: capped.truncated, removedBlocks: legal.removedBlocks };
}

export interface StripResult {
  text: string;
  linksStripped: number;
  imagesStripped: number;
}

// Images first so a linked image `[![alt](img)](href)` collapses to `![alt]` before links are handled.
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
// Link text may span lines (Firecrawl emits `\`-continued text) and may contain one already-stripped image.
const LINK_RE = /\[((?:[^[\]]|!\[[^\]]*\])*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
const KEEP_SCHEME = /^(tel|mailto|sms):/i;

function hostOf(href: string): string | null {
  try {
    if (/^https?:\/\//i.test(href)) return new URL(href).hostname;
    if (href.startsWith('//')) return new URL(`https:${href}`).hostname;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Keep link text, drop link targets. Same-site and relative targets become `[text]`; off-site targets keep
 * only their hostname (`[Get a Quote](clienthub.getjobber.com)`) so vendor evidence survives; tel:/mailto:
 * links are untouched. Images keep their alt text (`![alt]`) or disappear when the alt is empty.
 */
export function stripLinkTargets(markdown: string, siteHost: string): StripResult {
  const site = stripSiteHost(siteHost);
  let imagesStripped = 0;
  let linksStripped = 0;
  let text = markdown.replace(IMAGE_RE, (_m, alt: string) => {
    imagesStripped++;
    const a = alt.trim();
    return a ? `![${a}]` : '';
  });
  text = text.replace(LINK_RE, (m, label: string, href: string) => {
    const h = href.trim();
    if (KEEP_SCHEME.test(h)) return m;
    linksStripped++;
    const trimmed = label.trim();
    if (!trimmed) return '';
    if (/^!\[[^\]]*\]$/.test(trimmed)) return trimmed;
    const host = hostOf(h);
    if (host && stripSiteHost(host) !== site) return `[${label}](${stripSiteHost(host)})`;
    return `[${label}]`;
  });
  return { text, linksStripped, imagesStripped };
}

const HEADING_ONLY = /^#{1,6}\s+[^\n]*$/;
const HR_ONLY = /^(\* \* \*|\*\*\*|---|___)$/;

/** Drop paragraph blocks that appear verbatim in the home page's judge text (nav, footer, repeated CTAs). */
export function dropHomeDuplicateBlocks(text: string, homeText: string, minChars = 60): { text: string; removedBlocks: number; removedChars: number } {
  const eligible = (b: string) => b.length >= minChars && !HEADING_ONLY.test(b) && !HR_ONLY.test(b);
  const homeBlocks = new Set(
    homeText
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(eligible),
  );
  const out: string[] = [];
  let removedBlocks = 0;
  let removedChars = 0;
  for (const block of text.split(/\n{2,}/)) {
    const b = block.trim();
    if (!b) continue;
    if (homeBlocks.has(b)) {
      removedBlocks++;
      removedChars += b.length;
      continue;
    }
    out.push(b);
  }
  return { text: out.join('\n\n'), removedBlocks, removedChars };
}

export type JudgeTextMode = 'full' | 'lean';

export interface JudgeTextStats {
  mode: JudgeTextMode;
  chars_raw: number;
  chars_sent: number;
  truncated: boolean;
  legal_blocks_removed: number;
  links_stripped: number;
  images_stripped: number;
  home_dup_blocks_removed: number;
}

export interface JudgeTextOptions {
  maxChars: number;
  mode: JudgeTextMode;
  siteHost: string;
  /** The home page's lean text, used only for verbatim-block matching (never sent). */
  homeLeanText: string | null;
}

/** The home page's text in lean form, for matching candidate-page blocks against it. */
export function homeLeanText(markdown: string, siteHost: string): string {
  return stripLinkTargets(stripLegal(markdown).text, siteHost).text;
}

/**
 * Judge text for one page. `full` = legal strip + cap (identical to filterForJudge). `lean` = legal strip,
 * then link/image stripping, then dropping blocks the home page already showed, then the cap. Stripping runs
 * before the dedup so page-specific anchor targets no longer defeat verbatim matching; the cap runs last so
 * the budget goes to real content.
 */
export function prepareJudgeText(markdown: string, opts: JudgeTextOptions): { text: string; stats: JudgeTextStats } {
  const legal = stripLegal(markdown);
  let text = legal.text;
  let links = 0;
  let images = 0;
  let dup = 0;
  if (opts.mode === 'lean') {
    const s = stripLinkTargets(text, opts.siteHost);
    text = s.text;
    links = s.linksStripped;
    images = s.imagesStripped;
    if (opts.homeLeanText != null) {
      const d = dropHomeDuplicateBlocks(text, opts.homeLeanText);
      text = d.text;
      dup = d.removedBlocks;
    }
  }
  const capped = capText(text, opts.maxChars);
  return {
    text: capped.text,
    stats: {
      mode: opts.mode,
      chars_raw: markdown.length,
      chars_sent: capped.text.length,
      truncated: capped.truncated,
      legal_blocks_removed: legal.removedBlocks,
      links_stripped: links,
      images_stripped: images,
      home_dup_blocks_removed: dup,
    },
  };
}
