// Copy identity and provenance. Every sentence the site renders gets a stable id here, before any
// markup exists, so copy_map.json is derived from the plan rather than scraped back out of the HTML.
//
// A quote that cannot be found in the scraped source loses its credit: the block is treated as a
// placeholder for the rest of the build, which forces the fabrication gate to demand that it carry no
// specific claim, raises the placeholder ratio, and keeps the unverified-copy notice on the page.
import crypto from 'node:crypto';
import type { SourceCorpus } from './corpus.js';
import type { CopyMap, CopyMapEntry, Entities, Provenance } from './types.js';

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

export interface PageCopy {
  path: string;
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

/** Every quote the build is willing to vouch for, for the fabrication gate to check claims against. */
export function verifiedQuoteCorpus(index: CopyIndex): string {
  return [...index.slots.filter((s) => s.verified && s.source.quote).map((s) => s.source.quote as string), ...index.entityQuotes].join('\n');
}

// ---------------------------------------------------------------------------------------------
// The templated build
// ---------------------------------------------------------------------------------------------

/**
 * One rendered string from the fill, before its quote has been checked.
 *
 * `source.kind: 'source'` with no quote means the value came from `report.facts` — the audit's own
 * deterministic extraction — which is verified by construction and needs no span to back it.
 */
export interface FilledCopyInput {
  copyId: string;
  kind: string;
  text: string;
  source: Provenance;
}

/**
 * Index the strings a fill actually rendered, checking every declared quote the same way the
 * multi-page plan is checked. Provenance is the load-bearing part: a quote that cannot be found in
 * the scraped source loses its credit, which forces the fabrication gate to demand the sentence
 * carry no specific claim, raises the placeholder ratio, and keeps the notice on the page.
 */
export function indexFilledCopy(inputs: FilledCopyInput[], entities: Entities, corpus: SourceCorpus): CopyIndex {
  const slots: CopySlot[] = [];
  const issues: string[] = [];
  const placeholderIds = new Set<string>();

  for (const input of inputs) {
    // A fact needs no quote: the audit extracted it from the page itself.
    const isFact = input.source.kind === 'source' && !input.source.quote;
    const v = isFact ? { verified: true, correctedUrl: null, issue: null } : verify(input.source, corpus);
    if (v.issue) issues.push(`${input.copyId}: ${v.issue}`);
    const slot: CopySlot = {
      copyId: input.copyId,
      pagePath: '/',
      kind: input.kind,
      text: input.text,
      source: input.source,
      verified: v.verified,
      correctedUrl: v.correctedUrl,
    };
    if (!v.verified) placeholderIds.add(input.copyId);
    slots.push(slot);
  }

  const entityQuotes: string[] = [];
  const groups: [string, { name: string; source: Provenance }[]][] = [
    ['service', entities.services],
    ['area', entities.areas],
    ['credential', entities.credentials],
    ['price', entities.price_statements],
    ['rating', entities.rating ? [{ name: `${entities.rating.value} from ${entities.rating.count}`, source: entities.rating.source }] : []],
  ];
  for (const [kind, list] of groups) {
    for (const e of list) {
      const v = verify(e.source, corpus);
      if (v.issue) issues.push(`${kind} "${e.name}": ${v.issue}`);
      if (v.verified && e.source.quote) entityQuotes.push(e.source.quote);
    }
  }

  const byPath = new Map<string, PageCopy>([['/', { path: '/' }]]);
  return { slots, byPath, issues, placeholderIds, entityQuotes };
}

/**
 * copy_map.json for a templated page. The third source kind matters: `'template'` is text checked
 * into the page rather than written by a model, and the fabrication gate holds it to the same
 * fact-only standard as a placeholder.
 */
export function buildFilledCopyMap(index: CopyIndex): CopyMap {
  const paragraphs: CopyMapEntry[] = index.slots.map((s) => ({
    copy_id: s.copyId,
    page_path: '/',
    text_sha256: sha256Text(s.text),
    source:
      s.verified && s.source.quote
        ? { url: s.correctedUrl ?? s.source.page_url ?? '', quote: s.source.quote }
        : s.verified
          ? 'template'
          : 'placeholder',
  }));
  const unsourced = paragraphs.filter((p) => p.source === 'placeholder').length;
  return { paragraphs, placeholder_ratio: paragraphs.length ? unsourced / paragraphs.length : 0 };
}
