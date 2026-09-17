// Copy identity and provenance. Every sentence the site renders gets a stable id here, before any
// markup exists, so copy_map.json is derived from the plan rather than scraped back out of the HTML.
//
// A quote that cannot be found in the scraped source loses its credit: the block is treated as a
// placeholder for the rest of the build, which forces the fabrication gate to demand that it carry no
// specific claim, raises the placeholder ratio, and keeps the unverified-copy notice on the page.
import crypto from 'node:crypto';
import type { SourceCorpus } from './corpus.js';
import type { CopyMap, CopyMapEntry, Provenance, SitePlan } from './types.js';

export interface CopySlot {
  copyId: string;
  pagePath: string;
  kind: string;
  text: string;
  source: Provenance;
  /** False when the declared quote could not be located in the scraped source. */
  verified: boolean;
  /** Set when the quote was found, but on a different page than the model attributed it to. */
  correctedUrl: string | null;
}

export interface SectionCopy {
  sectionId: string;
  opener: CopySlot;
  blocks: CopySlot[];
}

export interface PageCopy {
  path: string;
  sections: SectionCopy[];
  faq: CopySlot[];
}

export interface CopyIndex {
  slots: CopySlot[];
  byPath: Map<string, PageCopy>;
  issues: string[];
  /** Slots whose text has no verified source and must therefore make no specific claim. */
  placeholderIds: Set<string>;
  /**
   * Verified quotes behind the plan's entities (services, areas, credentials, rating, prices). They
   * never render as their own paragraph, but they are things the source site says, so copy and
   * structured data built from them are entitled to say them too.
   */
  entityQuotes: string[];
}

const MIN_QUOTE_CHARS = 12;

/**
 * Whitespace, quote style, and markdown emphasis differ between the scraped markdown and a quote the
 * model retyped, so matching is done on a normalised form. Case is folded too: requiring byte equality
 * produced false failures often enough that it pushed honest copy into the placeholder bucket.
 */
export function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sha256Text(s: string): string {
  return crypto.createHash('sha256').update(s.trim()).digest('hex');
}

function verify(source: Provenance, corpus: SourceCorpus): { verified: boolean; correctedUrl: string | null; issue: string | null } {
  if (source.kind !== 'source') return { verified: false, correctedUrl: null, issue: null };
  const quote = (source.quote ?? '').trim();
  if (quote.length < MIN_QUOTE_CHARS) {
    return { verified: false, correctedUrl: null, issue: `quote is too short to verify: "${quote}"` };
  }
  const needle = normalizeForMatch(quote);
  const named = corpus.pages.find((p) => p.url === source.page_url);
  if (named && normalizeForMatch(named.text).includes(needle)) return { verified: true, correctedUrl: null, issue: null };
  const elsewhere = corpus.pages.find((p) => normalizeForMatch(p.text).includes(needle));
  if (elsewhere) {
    return { verified: true, correctedUrl: elsewhere.url, issue: `quote attributed to ${source.page_url ?? '(none)'} was actually found on ${elsewhere.url}` };
  }
  return { verified: false, correctedUrl: null, issue: `quote not found in any scraped page: "${quote.slice(0, 120)}"` };
}

/** Walk the plan in render order, assigning ids and checking every declared quote. */
export function indexCopy(plan: SitePlan, corpus: SourceCorpus): CopyIndex {
  const slots: CopySlot[] = [];
  const byPath = new Map<string, PageCopy>();
  const issues: string[] = [];
  const placeholderIds = new Set<string>();
  let n = 0;

  const make = (pagePath: string, kind: string, text: string, source: Provenance): CopySlot => {
    n++;
    const copyId = `p${String(n).padStart(3, '0')}`;
    const v = verify(source, corpus);
    if (v.issue) issues.push(`${copyId} (${pagePath}): ${v.issue}`);
    const slot: CopySlot = { copyId, pagePath, kind, text, source, verified: v.verified, correctedUrl: v.correctedUrl };
    if (!v.verified) placeholderIds.add(copyId);
    slots.push(slot);
    return slot;
  };

  const entityQuotes: string[] = [];
  const entityGroups: [string, { name: string; source: Provenance }[]][] = [
    ['service', plan.entities.services],
    ['area', plan.entities.areas],
    ['credential', plan.entities.credentials],
    ['price', plan.entities.price_statements],
    ['rating', plan.entities.rating ? [{ name: `${plan.entities.rating.value} from ${plan.entities.rating.count}`, source: plan.entities.rating.source }] : []],
  ];
  for (const [kind, list] of entityGroups) {
    for (const e of list) {
      const v = verify(e.source, corpus);
      if (v.issue) issues.push(`${kind} "${e.name}": ${v.issue}`);
      if (v.verified && e.source.quote) entityQuotes.push(e.source.quote);
    }
  }

  for (const page of plan.pages) {
    const sections: SectionCopy[] = page.sections.map((s) => ({
      sectionId: s.id,
      opener: make(page.path, 'opener', s.answer_first_opener.text, s.answer_first_opener.source),
      blocks: s.blocks.map((b) => make(page.path, b.kind, b.text, b.source)),
    }));
    const faq = page.faq.map((f) => make(page.path, 'faq', f.a, f.source));
    byPath.set(page.path, { path: page.path, sections, faq });
  }
  return { slots, byPath, issues, placeholderIds, entityQuotes };
}

export function buildCopyMap(index: CopyIndex): CopyMap {
  const paragraphs: CopyMapEntry[] = index.slots.map((s) => ({
    copy_id: s.copyId,
    page_path: s.pagePath,
    text_sha256: sha256Text(s.text),
    source:
      s.verified && s.source.quote
        ? { url: s.correctedUrl ?? s.source.page_url ?? '', quote: s.source.quote }
        : 'placeholder',
  }));
  const placeholders = paragraphs.filter((p) => p.source === 'placeholder').length;
  return { paragraphs, placeholder_ratio: paragraphs.length ? placeholders / paragraphs.length : 0 };
}

/** Every quote the build is willing to vouch for, for the fabrication gate to check claims against. */
export function verifiedQuoteCorpus(index: CopyIndex): string {
  return [...index.slots.filter((s) => s.verified && s.source.quote).map((s) => s.source.quote as string), ...index.entityQuotes].join('\n');
}
