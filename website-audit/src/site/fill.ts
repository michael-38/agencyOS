// Stage C: the fill. Pure, deterministic, free, and the only thing that ever writes the page.
//
// The template is the document — its shell, its stylesheet, its nav, its FAQ markup and its
// illustrated stand-ins are all checked in. This stage does four things to it: expands each repeat
// to the number of items the source actually supports, writes slot values in, removes every region
// the source cannot fill, and strips its own scaffolding attributes on the way out.
//
// It never emits a slot's demo text. A value comes from the content pack, from report.facts, or the
// node goes. That is what lets checkResidue assert afterwards that no mock business survived.
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { loadHtml } from '../checks/html.js';
import type { Facts } from '../checks/facts.js';
import { FACT_PREFIX, type SlotDef, type TemplateManifest } from './template.js';
import { clampToWords, normalizeCopy, parseSlotId, provenanceOfSlot, type ContentPack, type SlotValue } from './content.js';
import type { AssetRecord, Provenance } from './types.js';

export const NOTICE_TEXT =
  'Preview: every sentence marked as unverified is placeholder copy and must be confirmed with the business before this page goes live.';

/** Attributes that are scaffolding for this stage and must never reach the rendered page. */
const SCAFFOLD_ATTR_RE = /^(data-slot|data-slot-.*|data-repeat|data-repeat-item|data-repeat-min|data-repeat-max|data-omit-if-empty|data-image-slot|data-image-role|data-mock-tokens)$/;

export interface FilledCopy {
  slotId: string;
  copyId: string;
  kind: string;
  text: string;
  source: Provenance;
}

export interface FillOptions {
  manifest: TemplateManifest;
  templateHtml: string;
  pack: ContentPack;
  facts: Facts | null;
  /** Harvested client photographs, for `[data-image-slot]`. Empty unless `--assets reuse`. */
  assets?: AssetRecord[];
  /** `:root` overrides to append to the template's stylesheet, from the brand stage. */
  brandCss?: string | null;
}

export interface FillResult {
  html: string;
  /** Every rendered string, in document order, for indexCopy and the fabrication gate. */
  copy: FilledCopy[];
  omittedRegions: string[];
  /** Repeat groups the source could not fill to `data-repeat-min`. */
  emptyGroups: string[];
  /** Optional slots with no value, whose nodes were removed. */
  droppedSlots: string[];
  /** Pack entries naming a slot this template does not declare. */
  unknownSlots: string[];
  placeholderCount: number;
  notes: string[];
}

export class FillError extends Error {
  constructor(readonly problems: string[]) {
    super(`the content pack cannot fill this template (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n` + problems.map((p) => `  ${p}`).join('\n'));
    this.name = 'FillError';
  }
}

const attrsOf = (el: Element): Record<string, string> => el.attribs ?? {};

/** Every `data-slot*` declaration on one element, as [attribute-or-null, slot id] pairs. */
function declarationsOn(el: Element): { attr: string | null; id: string }[] {
  const out: { attr: string | null; id: string }[] = [];
  for (const [name, value] of Object.entries(attrsOf(el))) {
    if (name === 'data-slot') out.push({ attr: null, id: value.trim() });
    else if (name.startsWith('data-slot-') && !/^data-slot-(kind|max|intent|optional|fallback|mirror)$/.test(name)) {
      out.push({ attr: name.slice('data-slot-'.length), id: value.trim() });
    }
  }
  return out;
}

/** Facts the template may ask for by name. Atomic values only — never prose, never a claim. */
function factValues(facts: Facts | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!facts) return out;
  const phone = facts.phones[0];
  if (facts.business_name) out.set(`${FACT_PREFIX}business_name`, facts.business_name);
  if (phone) {
    out.set(`${FACT_PREFIX}phone`, phone);
    out.set(`${FACT_PREFIX}phone_href`, `tel:${phone.replace(/[^+\d]/g, '')}`);
  }
  const email = facts.emails[0];
  if (email) {
    out.set(`${FACT_PREFIX}email`, email);
    out.set(`${FACT_PREFIX}email_href`, `mailto:${email}`);
  }
  if (facts.address) {
    const text = typeof facts.address === 'string' ? facts.address : Object.values(facts.address).filter((v) => typeof v === 'string').join(', ');
    if (text.trim()) {
      out.set(`${FACT_PREFIX}address`, text.trim());
      out.set(`${FACT_PREFIX}address_line`, text.trim());
    }
  }
  if (facts.hours) {
    const text = typeof facts.hours === 'string' ? facts.hours : JSON.stringify(facts.hours);
    if (text.trim()) out.set(`${FACT_PREFIX}hours`, text.trim());
  }
  return out;
}

export function fill(o: FillOptions): FillResult {
  const { manifest, pack, facts } = o;
  const $ = loadHtml(o.templateHtml);
  const problems: string[] = [];
  const notes: string[] = [];
  const unknownSlots: string[] = [];
  const droppedSlots: string[] = [];
  const omittedRegions: string[] = [];

  const declared = new Map(manifest.slots.map((s) => [s.id, s]));
  const facts_ = factValues(facts);

  // ---- index the pack ---------------------------------------------------------------------------
  /** Singleton slot id → value. */
  const singles = new Map<string, SlotValue>();
  /** Repeat group → the index the model used → field → value. Sparse and unordered as given. */
  const groups = new Map<string, Map<number, Map<string, SlotValue>>>();
  for (const v of pack.slots) {
    const p = parseSlotId(v.slot);
    if (!declared.has(p.canonical)) {
      unknownSlots.push(v.slot);
      continue;
    }
    if (p.group === null) {
      singles.set(p.canonical, v);
      continue;
    }
    if (!groups.has(p.group)) groups.set(p.group, new Map());
    const byIndex = groups.get(p.group)!;
    if (!byIndex.has(p.index!)) byIndex.set(p.index!, new Map());
    byIndex.get(p.index!)!.set(p.field!, v);
  }
  if (unknownSlots.length) notes.push(`${unknownSlots.length} pack value(s) named a slot this template does not declare and were dropped: ${unknownSlots.slice(0, 8).join(', ')}`);

  // ---- expand repeats ---------------------------------------------------------------------------
  // Item i renders from prototype min(i, prototypes - 1), so a first cell styled as a feature stays
  // a feature and every later item reuses the last prototype.
  const emptyGroups: string[] = [];
  /**
   * Group → its items by rendered position. The model is free to return indices that are sparse or
   * out of order; sorting and compacting them here means a gap in the pack becomes a shorter list
   * rather than an empty card, and every later lookup can go by position.
   */
  const dense = new Map<string, Map<string, SlotValue>[]>();
  for (const r of manifest.repeats) {
    const items = [...(groups.get(r.group)?.entries() ?? [])].sort((a, b) => a[0] - b[0]).map(([, fields]) => fields);
    const kept = items.slice(0, r.max);
    dense.set(r.group, kept);
    if (kept.length < r.min) {
      // Nothing can fill these prototypes, so they go now rather than being asked for below. The
      // region that owns the group follows in the omission pass; where no region declares
      // data-omit-if-empty the container alone goes, and that gap is worth saying out loud.
      emptyGroups.push(r.group);
      dense.set(r.group, []);
      const container = $(`[data-repeat="${r.group}"]`);
      const owner = $(`[data-omit-if-empty="${r.group}"]`);
      container.remove();
      if (!owner.length) {
        notes.push(`repeat group "${r.group}" came back with ${items.length} item(s), below its minimum of ${r.min}, and no region declares data-omit-if-empty="${r.group}" — only the list itself was removed`);
      }
      continue;
    }
    const container = $(`[data-repeat="${r.group}"]`);
    const prototypes = container.children('[data-repeat-item]').toArray() as Element[];
    const rendered: Element[] = [];
    for (let i = 0; i < kept.length; i++) {
      const proto = prototypes[Math.min(i, prototypes.length - 1)];
      const clone = $(proto).clone().get(0) as Element;
      // Stamp the item index onto every slot declaration inside the clone, so the fill below can
      // find its value without re-deriving which item it belongs to.
      $(clone).find('*').addBack().each((_, el) => {
        for (const [name, value] of Object.entries(attrsOf(el as Element))) {
          if (name !== 'data-slot' && !name.startsWith('data-slot-')) continue;
          if (/^data-slot-(kind|max|intent|optional|fallback|mirror)$/.test(name)) continue;
          (el as Element).attribs[name] = value.replace('[]', `[${i}]`);
        }
      });
      rendered.push(clone);
    }
    for (const p of prototypes) $(p).remove();
    container.append(...rendered.map((el) => $(el)));
  }

  // ---- fill every declaration -------------------------------------------------------------------
  const copy: FilledCopy[] = [];
  let copyN = 0;
  const nextCopyId = () => `p${String(++copyN).padStart(3, '0')}`;

  const valueFor = (id: string): { text: string; source: Provenance } | null => {
    if (id.startsWith(FACT_PREFIX)) {
      const v = facts_.get(id);
      // A fact is the audit's own extraction, not the model's, so it is its own provenance.
      return v ? { text: v, source: { kind: 'source', page_url: null, quote: null } } : null;
    }
    const p = parseSlotId(id);
    const v = p.group === null ? singles.get(p.canonical) : dense.get(p.group)?.[p.index!]?.get(p.field!);
    if (!v) return null;
    return { text: v.text, source: provenanceOfSlot(v) };
  };

  // Deepest-last document order, so a parent's text is written before a child's is read.
  const targets = ($('[data-slot], [data-slot-href], [data-slot-alt], [data-slot-src], [data-slot-content], [data-slot-placeholder], [data-slot-aria-label], [data-slot-title]').toArray() as Element[]);
  for (const el of targets) {
    const $el = $(el);
    const attribs = attrsOf(el);
    const optional = 'data-slot-optional' in attribs;
    const fallback = attribs['data-slot-fallback'] ?? null;
    for (const d of declarationsOn(el)) {
      const canonical = parseSlotId(d.id).canonical;
      const def = declared.get(canonical);
      const got = valueFor(d.id);
      if (!got) {
        if (fallback !== null) {
          applyValue($, $el, d.attr, fallback);
          continue;
        }
        if (optional || def?.optional) {
          $el.remove();
          droppedSlots.push(d.id);
          break;
        }
        problems.push(`required slot "${d.id}" has no value and no data-slot-fallback`);
        continue;
      }
      const text = d.attr === 'href' || d.attr === 'src' ? got.text.trim() : clampToWords(normalizeCopy(got.text), def?.max ?? null);
      applyValue($, $el, d.attr, text);
      // Only visible text is copy; an attribute carries no sentence the fabrication gate can check.
      if (d.attr === null) {
        copy.push({ slotId: d.id, copyId: nextCopyId(), kind: def?.kind ?? 'paragraph', text, source: got.source });
        $el.attr('data-copy-id', copy[copy.length - 1].copyId);
        if (got.source.kind !== 'source') $el.attr('data-copy', 'placeholder');
      }
    }
  }

  // ---- remove regions the source could not fill --------------------------------------------------
  const emptyTargets = new Set<string>([
    ...emptyGroups,
    ...pack.omit_sections,
    // A singleton slot counts as empty when it was optional and never filled.
    ...droppedSlots.map((id) => parseSlotId(id).canonical),
  ]);
  $('[data-omit-if-empty]').each((_, el) => {
    const $el = $(el as Element);
    const target = ($el.attr('data-omit-if-empty') ?? '').trim();
    if (!emptyTargets.has(target)) return;
    const id = $el.attr('id') ?? $el.closest('[id]').attr('id') ?? target;
    omittedRegions.push(`${id} (nothing to fill "${target}")`);
    $el.remove();
  });
  for (const sectionId of pack.omit_sections) {
    const $sec = $(`#${cssEscape(sectionId)}`);
    if ($sec.length) {
      omittedRegions.push(`${sectionId} (the source gives it nothing)`);
      $sec.remove();
    }
  }

  // An omitted region takes its anchors with it, or the page ships links to nothing.
  const liveIds = new Set<string>();
  $('[id]').each((_, el) => {
    liveIds.add($(el as Element).attr('id') as string);
  });
  $('a[href^="#"]').each((_, el) => {
    const $a = $(el as Element);
    const target = ($a.attr('href') ?? '').slice(1);
    if (!target || liveIds.has(target)) return;
    notes.push(`removed a link to #${target}, whose section the source could not fill`);
    // A nav item is only its link; a button in a CTA row is too. Drop the smallest thing that works.
    if ($a.parent().is('li')) $a.parent().remove();
    else $a.remove();
  });

  // ---- images ------------------------------------------------------------------------------------
  placeImages($, o.assets ?? []);

  // ---- unverified-copy notice --------------------------------------------------------------------
  const placeholderCount = $('[data-copy="placeholder"]').length;
  if (placeholderCount > 0) {
    $('body').prepend(`<div class="notice" role="status" data-placeholder-notice>${NOTICE_TEXT}</div>`);
  }

  // ---- brand override ----------------------------------------------------------------------------
  if (o.brandCss) {
    const style = $('style').first();
    if (style.length) style.append(`\n/* brand override */\n${o.brandCss}\n`);
  }

  // ---- strip the scaffolding ---------------------------------------------------------------------
  $('*').each((_, el) => {
    for (const name of Object.keys(attrsOf(el as Element))) {
      if (SCAFFOLD_ATTR_RE.test(name)) delete (el as Element).attribs[name];
    }
  });

  if (problems.length) throw new FillError(problems);
  return { html: $.html(), copy, omittedRegions, emptyGroups, droppedSlots, unknownSlots, placeholderCount, notes };
}

function applyValue($: CheerioAPI, $el: Cheerio<Element>, attr: string | null, text: string): void {
  if (attr === null) $el.text(text);
  else $el.attr(attr, text);
}

/**
 * Hand a harvested photograph to each `[data-image-slot]` that has one. An image the client does not
 * demonstrably own is never placed: the figure keeps its labelled illustrated stand-in, which is
 * honest, and seo-report.md lists what was skipped for a human to clear.
 */
function placeImages($: CheerioAPI, assets: AssetRecord[]): void {
  if (!assets.length) return;
  const usable = assets.filter((a) => a.same_host && !a.likely_stock && a.width && a.height);
  const byRole = new Map<string, AssetRecord[]>();
  for (const a of usable) {
    if (!byRole.has(a.role)) byRole.set(a.role, []);
    byRole.get(a.role)!.push(a);
  }
  let first = true;
  $('[data-image-slot]').each((_, el) => {
    const $fig = $(el as Element);
    const role = $fig.attr('data-image-role') ?? 'gallery';
    const pool = byRole.get(role);
    const asset = pool?.shift();
    if (!asset) return;
    const svg = $fig.find('svg').first();
    const alt = svg.attr('aria-label') ?? asset.alt_from_source ?? '';
    const priority = first ? ' fetchpriority="high"' : ' loading="lazy"';
    first = false;
    svg.replaceWith(
      `<img src="${asset.file}" alt="${escapeAttr(alt)}" width="${asset.width}" height="${asset.height}" decoding="async"${priority}>`,
    );
  });
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** Section ids come from a model, so they get escaped before they reach a selector. */
const cssEscape = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
