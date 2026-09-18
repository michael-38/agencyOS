// The template contract, read out of the template itself.
//
// A template is a finished, standalone HTML page — it opens in a browser, scores in Lighthouse and
// passes axe as-is — annotated with inert `data-*` attributes that say which of its text is the mock
// business's and therefore must be replaced. Nothing about the contract is declared twice: the slot
// list, the repeat cardinalities, the section ids and the checklist coverage are all derived from the
// markup, so a template edit cannot drift from a schema file.
//
// One manifest feeds four consumers: the content prompt, the filler, the residue gate, and
// seo-report.md.
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { loadHtml } from '../checks/html.js';
import { findClaims } from './validate.js';

export const SLOT_KINDS = ['heading', 'paragraph', 'bullet', 'price', 'url', 'phone', 'quote'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/** Slot ids under this prefix are filled by code from `report.facts`, never by the model. */
export const FACT_PREFIX = 'fact.';

/** Demo strings at least this long are distinctive enough for the residue gate to match on. */
export const RESIDUE_MIN_CHARS = 24;

export interface SlotDef {
  /** `hero.lede` · `services[].name` · `fact.phone`. Unique within the template. */
  id: string;
  kind: SlotKind;
  /** The attribute this slot sets, or null to set the element's text. */
  attr: string | null;
  /** The repeat group this slot belongs to, or null for a singleton. */
  group: string | null;
  max: number | null;
  optional: boolean;
  fallback: string | null;
  /** One sentence telling the model what this slot must accomplish. Required unless `fact.*`. */
  intent: string;
  /** Audit item ids the nearest `[data-checklist]` ancestor claims. */
  checklistIds: string[];
  /** True when this slot is (or sits inside) the section's `[data-answer-first]` opener. */
  answerFirst: boolean;
  /**
   * A second place the same value belongs — a section heading echoed in the footer, the hero's
   * primary action repeated in the sticky bar. Mirrors are filled from the canonical declaration's
   * value, are never asked of the model, and are how the page guarantees one label per intent
   * rather than hoping for it.
   */
  mirror: boolean;
  /** The mock business's text, as checked in. Never emitted — it seeds the residue lexicon. */
  demoText: string;
}

export interface RepeatDef {
  group: string;
  min: number;
  max: number;
  /**
   * How many `[data-repeat-item]` children the container ships. Item `i` renders from prototype
   * `min(i, prototypes - 1)`, so a first cell styled as a feature stays a feature and every later
   * item reuses the last prototype. The demo's full set of items can therefore stay in the file,
   * which is what keeps the template previewable and lintable as a finished page.
   */
  prototypes: number;
  slotIds: string[];
  /** The `id` of the section that owns this group, when it has one. */
  sectionId: string | null;
}

export interface SectionDef {
  id: string;
  /**
   * What must be empty for this section to be removed, from `data-omit-if-empty`: either a repeat
   * group that came back with too few items, or a single slot the source could not fill.
   */
  omitGroup: string | null;
  checklistIds: string[];
}

export interface TemplateManifest {
  slug: string;
  /** Repo-relative path, as given in industries.yaml. */
  file: string;
  sha256: string;
  slots: SlotDef[];
  repeats: RepeatDef[];
  sections: SectionDef[];
  /** Every `data-checklist` id the template carries, so coverage can be two-tier. */
  coveredChecklistIds: string[];
  /** Identity strings of the mock business, which must never survive a fill. */
  mockTokens: string[];
  /**
   * Demo prose distinctive enough to identify the mock business. A phrase with no number, no claim
   * and no mock token in it is generic boilerplate — "Frequently asked questions" is the template's
   * demo text and also what a real client's page says — so matching on it would fail honest builds
   * without catching anything. The gate's job is the mock business, not common phrasing.
   */
  demoLexicon: string[];
}

export class TemplateError extends Error {
  constructor(readonly file: string, readonly problems: string[]) {
    super(`${file} is not a valid template (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n` + problems.map((p) => `  ${p}`).join('\n'));
    this.name = 'TemplateError';
  }
}

const REPEAT_ID_RE = /^([a-z0-9_-]+)\[\]\.([a-z0-9_-]+)$/;
const PLAIN_ID_RE = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/;

const attrList = (v: string | undefined): string[] => (v ?? '').split(/\s+/).filter(Boolean);

/** Nearest `[data-checklist]` ancestor-or-self, so a slot inherits the ids its section claims. */
function inheritedChecklist($: CheerioAPI, el: Cheerio<Element>): string[] {
  const owner = el.closest('[data-checklist]');
  return owner.length ? attrList(owner.attr('data-checklist')) : [];
}

function slotKindOf(id: string, raw: string | undefined, mirror: boolean, problems: string[]): SlotKind {
  if (raw) {
    if ((SLOT_KINDS as readonly string[]).includes(raw)) return raw as SlotKind;
    problems.push(`slot "${id}": data-slot-kind "${raw}" is not one of ${SLOT_KINDS.join('|')}`);
    return 'paragraph';
  }
  // A fact slot's kind is implied by its name; everything else must say.
  if (id === `${FACT_PREFIX}phone` || id === `${FACT_PREFIX}phone_href`) return 'phone';
  if (id.startsWith(FACT_PREFIX)) return 'paragraph';
  // A mirror is not prompted, so it has no kind of its own; it takes the canonical's below.
  if (mirror) return 'paragraph';
  problems.push(`slot "${id}": data-slot-kind is required`);
  return 'paragraph';
}

/** The `data-slot*` attributes on one element, as zero or more slot definitions. */
function slotsOn($: CheerioAPI, el: Cheerio<Element>, problems: string[]): SlotDef[] {
  const out: SlotDef[] = [];
  const attribs = (el.get(0) as Element).attribs ?? {};
  const kindRaw = attribs['data-slot-kind'];
  const maxRaw = attribs['data-slot-max'];
  const intent = (attribs['data-slot-intent'] ?? '').trim();
  const optional = 'data-slot-optional' in attribs;
  const mirror = 'data-slot-mirror' in attribs;
  const fallback = attribs['data-slot-fallback'] ?? null;
  const checklistIds = inheritedChecklist($, el);
  const answerFirst = el.closest('[data-answer-first]').length > 0;

  const repeatOwner = el.closest('[data-repeat]');
  const group = repeatOwner.length ? repeatOwner.attr('data-repeat') ?? null : null;

  let max: number | null = null;
  if (maxRaw !== undefined) {
    const n = Number.parseInt(maxRaw, 10);
    if (!Number.isFinite(n) || n <= 0) problems.push(`data-slot-max "${maxRaw}" is not a positive integer`);
    else max = n;
  }

  for (const [attrName, value] of Object.entries(attribs)) {
    if (attrName !== 'data-slot' && !attrName.startsWith('data-slot-')) continue;
    // Modifiers, not slot declarations.
    if (['data-slot-kind', 'data-slot-max', 'data-slot-intent', 'data-slot-optional', 'data-slot-fallback', 'data-slot-mirror'].includes(attrName)) continue;
    const id = value.trim();
    const targetAttr = attrName === 'data-slot' ? null : attrName.slice('data-slot-'.length);
    if (!id) {
      problems.push(`${attrName} is empty`);
      continue;
    }
    const m = REPEAT_ID_RE.exec(id);
    if (m) {
      if (!group) problems.push(`slot "${id}" uses the repeat form but has no [data-repeat] ancestor`);
      else if (m[1] !== group) problems.push(`slot "${id}" is inside [data-repeat="${group}"], so its id must start "${group}[]."`);
    } else {
      if (group) problems.push(`slot "${id}" is inside [data-repeat="${group}"], so its id must be "${group}[].<field>"`);
      if (!PLAIN_ID_RE.test(id)) problems.push(`slot id "${id}" must be lower-kebab dot-separated`);
    }
    if (!id.startsWith(FACT_PREFIX) && !mirror && !intent) problems.push(`slot "${id}": data-slot-intent is required (it is the prompt)`);
    out.push({
      id,
      kind: slotKindOf(id, kindRaw, mirror, problems),
      attr: targetAttr,
      group,
      max,
      optional,
      fallback,
      intent,
      checklistIds,
      answerFirst,
      mirror,
      demoText: targetAttr ? (attribs[targetAttr] ?? '') : el.text().replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

export function readTemplate(absFile: string, slug: string, repoRelFile = absFile): TemplateManifest {
  const html = fs.readFileSync(absFile, 'utf8');
  const $ = loadHtml(html);
  const problems: string[] = [];

  // ---- slots -----------------------------------------------------------------------------------
  const slots: SlotDef[] = [];
  $('*').each((_, el) => {
    const attribs = (el as Element).attribs ?? {};
    if (!Object.keys(attribs).some((a) => a === 'data-slot' || a.startsWith('data-slot-'))) return;
    slots.push(...slotsOn($, $(el as Element), problems));
  });

  const byId = new Map<string, SlotDef[]>();
  for (const s of slots) {
    if (!byId.has(s.id)) byId.set(s.id, []);
    byId.get(s.id)!.push(s);
  }
  for (const [id, defs] of byId) {
    // Two elements claiming one id would make the fill ambiguous, with two exceptions: repeat
    // prototypes legitimately declare every field of their group, and a `fact.*` value is one
    // atomic string that belongs in several places at once (the phone sits in the header, the
    // contact block, the footer and the sticky bar).
    const canonical = defs.filter((d) => !d.mirror);
    if (defs.length > 1 && !defs[0].group && !id.startsWith(FACT_PREFIX) && canonical.length > 1) {
      problems.push(`slot "${id}" is declared ${canonical.length} times without [data-slot-mirror]`);
    }
    // A mirror with nothing to mirror would render empty; it is a typo, not a variant.
    if (!canonical.length) problems.push(`slot "${id}" is only ever a [data-slot-mirror]; one declaration must be canonical`);
    // Mirrors carry the canonical's kind, budget and intent, so every consumer sees one contract.
    for (const d of defs) {
      if (!d.mirror || !canonical.length) continue;
      d.kind = canonical[0].kind;
      d.max = canonical[0].max;
      d.intent = canonical[0].intent;
      d.optional = canonical[0].optional;
    }
  }

  // ---- repeats ---------------------------------------------------------------------------------
  const repeats: RepeatDef[] = [];
  const seenGroups = new Set<string>();
  $('[data-repeat]').each((_, el) => {
    const $el = $(el as Element);
    const group = ($el.attr('data-repeat') ?? '').trim();
    if (!group) {
      problems.push('a [data-repeat] container has an empty group name');
      return;
    }
    if (seenGroups.has(group)) problems.push(`repeat group "${group}" is declared on more than one container`);
    seenGroups.add(group);
    const prototypes = $el.children('[data-repeat-item]').length;
    if (prototypes < 1) problems.push(`repeat group "${group}" has no [data-repeat-item] prototype`);
    const min = Number.parseInt($el.attr('data-repeat-min') ?? '1', 10);
    const max = Number.parseInt($el.attr('data-repeat-max') ?? '0', 10);
    if (!Number.isFinite(max) || max < 1) problems.push(`repeat group "${group}": data-repeat-max is required and must be >= 1`);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) problems.push(`repeat group "${group}": min ${min} exceeds max ${max}`);
    const slotIds = [...new Set(slots.filter((s) => s.group === group).map((s) => s.id))];
    if (!slotIds.length) problems.push(`repeat group "${group}" contains no slots`);
    repeats.push({ group, min: Number.isFinite(min) ? min : 1, max: Number.isFinite(max) ? max : 1, prototypes, slotIds, sectionId: $el.closest('section[id]').attr('id') ?? null });
  });

  // ---- sections --------------------------------------------------------------------------------
  const sections: SectionDef[] = [];
  $('main section').each((_, el) => {
    const $el = $(el as Element);
    const id = $el.attr('id');
    if (!id) return;
    const omitGroup = ($el.attr('data-omit-if-empty') ?? '').trim() || null;
    sections.push({ id, omitGroup, checklistIds: attrList($el.attr('data-checklist')) });
  });
  const slotIds = new Set(slots.map((s2) => s2.id));
  $('[data-omit-if-empty]').each((_, el) => {
    const $el = $(el as Element);
    const target = ($el.attr('data-omit-if-empty') ?? '').trim();
    if (!target) {
      problems.push('a [data-omit-if-empty] is empty');
      return;
    }
    if (!seenGroups.has(target) && !slotIds.has(target)) {
      problems.push(`[data-omit-if-empty="${target}"] names neither a [data-repeat] group nor a slot`);
    }
  });

  // ---- checklist coverage ----------------------------------------------------------------------
  const covered = new Set<string>();
  $('[data-checklist]').each((_, el) => {
    for (const id of attrList($(el as Element).attr('data-checklist'))) covered.add(id);
  });

  // ---- residue lexicon -------------------------------------------------------------------------
  const mockTokens = [...new Set(attrList($('html').attr('data-mock-tokens')).map(decodeURIComponent))];
  const identifying = (t: string): boolean => {
    const claims = findClaims(t);
    if (claims.numbers.length || claims.hard.length) return true;
    return mockTokens.some((tok) => tok.length >= 4 && t.includes(tok));
  };
  const demoLexicon = [...new Set(slots.map((s) => s.demoText.trim()).filter((t) => t.length >= RESIDUE_MIN_CHARS && identifying(t)))];

  if (problems.length) throw new TemplateError(repoRelFile, problems);

  return {
    slug,
    file: repoRelFile,
    sha256: crypto.createHash('sha256').update(html).digest('hex'),
    slots,
    repeats,
    sections,
    coveredChecklistIds: [...covered].sort(),
    mockTokens,
    demoLexicon,
  };
}
