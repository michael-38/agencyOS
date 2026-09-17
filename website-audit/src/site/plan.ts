// Stage A, in two passes.
//
// Pass 1 decides the architecture: which pages exist, what question each answers, what sections it
// has, and which facts the site is entitled to state. Pass 2 writes the copy for each page, in
// parallel, one call per page. Splitting them keeps each structured-output schema shallow enough for
// the API's grammar compiler, keeps each response well inside the token budget, and lets the copy
// pass concentrate on one page at a time instead of a dozen.
//
// The model decides architecture and wording. It does not get to decide whether a path is safe,
// whether a page budget holds, or whether an audit id exists — that is all bounded here.
import { SITE_LIMITS, SITE_MODELS } from '../config.js';
import type { LlmParser } from '../llm/client.js';
import {
  pageContentSystem,
  pageContentUser,
  siteArchitectureSystem,
  siteArchitectureUser,
  sourceCorpusBlock,
  type PlanGap,
  type PlanGuidance,
  type PlanPersona,
} from '../llm/prompts/site-plan.js';
import type { Report } from '../report/schema.js';
import { corpusToPrompt, factsToPrompt, type SourceCorpus } from './corpus.js';
import { normalizeSitePath } from './paths.js';
import {
  PageContentSchema,
  SiteArchitectureSchema,
  toSitePlan,
  type PageContent,
  type PlanPage,
  type SiteArchitecture,
  type SitePlan,
} from './types.js';

export interface PlanStageOptions {
  llm: LlmParser;
  model: string;
  persona: PlanPersona;
  guidance: PlanGuidance;
  report: Report;
  corpus: SourceCorpus;
  availableImageRoles: string[];
  profile: 'mockup' | 'production';
  maxPages: number;
}

export interface PlanStageResult {
  plan: SitePlan;
  /** Normalisation changes, reported rather than hidden. */
  adjustments: string[];
  usd: number;
}

function gapsFrom(report: Report): PlanGap[] {
  return report.items
    .filter((i) => i.verdict !== 'pass')
    .map((i) => ({ id: i.id, criterion: i.criterion, verdict: i.verdict, weight: i.weight, scope: i.scope, note: i.note }));
}

function titleCase(slug: string): string {
  return slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * The visible trail and the BreadcrumbList are both built from this, and both index it against the
 * path's segments, so it must have exactly one crumb per segment. Models commonly include "Home",
 * which the renderer adds itself; a leading crumb that duplicates it is dropped.
 */
export function normalizeBreadcrumb(path: string, crumbs: string[]): string[] {
  const segments = path.split('/').filter(Boolean);
  let out = crumbs.map((c) => c.trim()).filter(Boolean);
  // The renderer always prepends Home, so a "Home" crumb here is a duplicate whose JSON-LD item
  // would point at the wrong path. Drop it and let the path supply the level it displaced.
  while (out.length && /^home$/i.test(out[0])) out = out.slice(1);
  if (out.length > segments.length) out = out.slice(out.length - segments.length);
  // Supplied crumbs describe the deepest levels, so missing ones are filled in from the front.
  while (out.length < segments.length) out.unshift(titleCase(segments[segments.length - out.length - 1]));
  return segments.map((seg, i) => out[i] ?? titleCase(seg));
}

/** Cut to a word boundary at or before `max`, with an ellipsis when anything was lost. */
export function clampToWords(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.\u2014-]+$/, '')}…`;
}

/** Section ids the build itself emits; a model section that claims one would duplicate an element id. */
const RESERVED_SECTION_IDS = new Set(['faq', 'related', 'main', 'top']);

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
}

/** Bound pass 1 before any copy is paid for: unusable paths and over-budget pages are cheaper to drop here. */
export function normalizeArchitecture(raw: SiteArchitecture, report: Report, maxPages: number): { arch: SiteArchitecture; adjustments: string[] } {
  const adjustments: string[] = [];
  const knownIds = new Set(report.items.map((i) => i.id));
  const seenPaths = new Set<string>();
  const pages: SiteArchitecture['pages'] = [];

  for (const p of raw.pages) {
    const path = p.kind === 'home' ? '/' : normalizeSitePath(p.path);
    if (!path) {
      adjustments.push(`dropped page with unusable path "${p.path}"`);
      continue;
    }
    if (seenPaths.has(path)) {
      adjustments.push(`dropped duplicate page "${path}"`);
      continue;
    }
    if (pages.length >= maxPages) {
      adjustments.push(`dropped page "${path}" — the ${maxPages}-page budget was already full`);
      continue;
    }
    seenPaths.add(path);

    const sectionIds = new Set<string>();
    const sections = p.sections.map((s, i) => {
      let id = slugify(s.id);
      if (RESERVED_SECTION_IDS.has(id)) {
        id = `${id}-section`;
        adjustments.push(`page "${path}": section id "${s.id}" is reserved by the build; renamed to "${id}"`);
      }
      while (sectionIds.has(id)) id = `${id}-${i + 1}`;
      sectionIds.add(id);
      const unknown = s.checklist_ids.filter((c) => !knownIds.has(c));
      if (unknown.length) adjustments.push(`page "${path}" section "${id}": dropped checklist id(s) not in the audit: ${unknown.join(', ')}`);
      return { ...s, id, checklist_ids: s.checklist_ids.filter((c) => knownIds.has(c)) };
    });

    // A title or description the copy pass made too long is deterministically fixable, and leaving it
    // to a render repair pass cannot work — the markup stage does not own the head.
    let title = p.title.trim();
    if (title.length > SITE_LIMITS.titleMaxChars) {
      title = clampToWords(title, SITE_LIMITS.titleMaxChars);
      adjustments.push(`page "${path}": <title> was ${p.title.trim().length} characters; cut to "${title}"`);
    }
    let meta_description = p.meta_description.trim();
    if (meta_description.length > SITE_LIMITS.descriptionMaxChars) {
      meta_description = clampToWords(meta_description, SITE_LIMITS.descriptionMaxChars);
      adjustments.push(`page "${path}": meta description was ${p.meta_description.trim().length} characters; cut to ${meta_description.length}`);
    }
    const breadcrumb = path === '/' ? [] : normalizeBreadcrumb(path, p.breadcrumb);
    if (path !== '/' && breadcrumb.join('|') !== p.breadcrumb.join('|')) {
      adjustments.push(`page "${path}": breadcrumb ${JSON.stringify(p.breadcrumb)} did not match the path's depth; using ${JSON.stringify(breadcrumb)}`);
    }
    pages.push({ ...p, path, sections, title, meta_description, breadcrumb });
  }

  if (!pages.some((p) => p.path === '/')) {
    if (!pages.length) throw new Error('the architecture contains no usable pages');
    adjustments.push(`no page claimed "/" — promoted "${pages[0].path}" to the home page`);
    pages[0] = { ...pages[0], path: '/', kind: 'home', breadcrumb: [] };
  }
  pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));

  const validPaths = new Set(pages.map((p) => p.path));
  const internal_links = raw.internal_links
    .map((l) => ({ ...l, from_path: normalizeSitePath(l.from_path) ?? '', to_path: normalizeSitePath(l.to_path) ?? '' }))
    .filter((l) => validPaths.has(l.from_path) && validPaths.has(l.to_path) && l.from_path !== l.to_path);
  if (internal_links.length !== raw.internal_links.length) {
    adjustments.push(`dropped ${raw.internal_links.length - internal_links.length} internal link(s) pointing at pages that were not generated`);
  }

  // Every non-pass audit item must be someone's responsibility, so unclaimed ids fall to the home page.
  const claimed = new Set(pages.flatMap((p) => p.sections.flatMap((s) => s.checklist_ids)));
  const unclaimed = report.items.filter((i) => i.verdict !== 'pass' && !claimed.has(i.id)).map((i) => i.id);
  if (unclaimed.length) {
    const home = pages.find((p) => p.path === '/')!;
    if (home.sections.length) {
      home.sections[home.sections.length - 1].checklist_ids.push(...unclaimed);
      adjustments.push(`the architecture left ${unclaimed.length} audit id(s) unassigned; attached them to the home page's last section: ${unclaimed.join(', ')}`);
    }
  }

  return { arch: { ...raw, pages, internal_links }, adjustments };
}

/** The summary is rendered as a one-line JSON-LD description and an llms.txt blockquote. */
const SUMMARY_MAX_CHARS = 280;

/** Repair the copy pass: FAQ headings become questions, and sections the model skipped are reported. */
export function normalizePlan(plan: SitePlan): { plan: SitePlan; adjustments: string[] } {
  const adjustments: string[] = [];
  let site_summary = plan.site_summary.trim();
  if (site_summary.length > SUMMARY_MAX_CHARS) {
    // Cutting at the first "." lands inside abbreviations like "St. George", so clamp to words.
    site_summary = clampToWords(site_summary, SUMMARY_MAX_CHARS);
    adjustments.push(`site_summary was ${plan.site_summary.trim().length} characters; it is rendered as a one-line description, so it was cut to "${site_summary}"`);
  }
  // The copy pass runs once per page, so the same observation about the source arrives many times.
  const seenNotes = new Set<string>();
  const notes = plan.notes.map((n) => n.trim()).filter((n) => n && !seenNotes.has(n.toLowerCase()) && seenNotes.add(n.toLowerCase()) !== undefined);
  const pages: PlanPage[] = plan.pages.map((p) => {
    const faq = p.faq.map((f) => ({ ...f, q: f.q.trim().endsWith('?') ? f.q.trim() : `${f.q.trim()}?` }));
    if (faq.some((f, i) => f.q !== p.faq[i].q.trim())) adjustments.push(`page "${p.path}": added a question mark to FAQ heading(s)`);
    if (!p.sections.length) adjustments.push(`page "${p.path}": the copy pass returned no sections`);
    return { ...p, faq };
  });
  const usable = pages.filter((p) => p.sections.length > 0);
  for (const dropped of pages.filter((p) => p.sections.length === 0)) {
    adjustments.push(`dropped page "${dropped.path}" — it has no copy`);
  }
  if (!usable.length) throw new Error('no page came back with any copy');
  const paths = new Set(usable.map((p) => p.path));
  return {
    plan: { ...plan, site_summary, notes, pages: usable, internal_links: plan.internal_links.filter((l) => paths.has(l.from_path) && paths.has(l.to_path)) },
    adjustments,
  };
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function runPlanStage(o: PlanStageOptions): Promise<PlanStageResult> {
  // One block, built once, sent first on every call in this stage: identical bytes and a stable
  // position are what make it a prompt-cache hit rather than seven full-price copies.
  const corpusBlock = sourceCorpusBlock(corpusToPrompt(o.corpus));
  const facts = factsToPrompt(o.corpus.facts);
  const adjustments: string[] = [];
  let usd = 0;

  const archRes = await o.llm.parse({
    step: 'site-arch',
    label: 'architecture',
    model: o.model,
    system: siteArchitectureSystem(o.persona),
    content: [
      { type: 'text', text: corpusBlock, cacheable: true },
      {
        type: 'text',
        text: siteArchitectureUser({
          facts,
          guidance: o.guidance,
          gaps: gapsFrom(o.report),
          constraints: { maxPages: o.maxPages, availableImageRoles: o.availableImageRoles, profile: o.profile },
        }),
      },
    ],
    schema: SiteArchitectureSchema,
    maxTokens: SITE_LIMITS.architectureMaxTokens,
    thinking: { effort: 'medium' },
    fallbacks: true,
  });
  usd += archRes.usd;
  const { arch, adjustments: archAdjustments } = normalizeArchitecture(archRes.parsed, o.report, o.maxPages);
  adjustments.push(...archAdjustments);

  const guidance = [o.guidance.archetype, o.guidance.industry].filter(Boolean).join('\n\n');
  const contents = new Map<string, PageContent>();
  const results = await pool(arch.pages, SITE_LIMITS.contentConcurrency, async (page) => {
    const res = await o.llm.parse({
      step: 'site-copy',
      label: page.path === '/' ? 'home' : page.path.replace(/\//g, '_').replace(/^_|_$/g, ''),
      model: o.model,
      system: pageContentSystem(o.persona),
      content: [
        { type: 'text', text: corpusBlock, cacheable: true },
        {
          type: 'text',
          text: pageContentUser({
            path: page.path,
            kind: page.kind,
            h1: page.h1,
            title: page.title,
            primaryQuery: page.primary_query,
            sections: page.sections.map((s) => ({ id: s.id, h2: s.h2, intent: s.intent, imageSlot: s.image_slot })),
            wantsFaq: page.kind === 'faq' || page.path === '/',
            facts,
            guidance,
            siblingPages: arch.pages.filter((p) => p.path !== page.path).map((p) => ({ path: p.path, title: p.title })),
          }),
        },
      ],
      schema: PageContentSchema,
      maxTokens: SITE_LIMITS.contentMaxTokens,
      thinking: { effort: 'low' },
      fallbacks: true,
    });
    return { path: page.path, content: res.parsed, usd: res.usd };
  });
  for (const r of results) {
    contents.set(r.path, r.content);
    usd += r.usd;
  }

  const stitched = toSitePlan(arch, contents);
  const { plan, adjustments: planAdjustments } = normalizePlan(stitched);
  adjustments.push(...planAdjustments);
  return { plan, adjustments, usd };
}

export const DEFAULT_PLAN_MODEL = SITE_MODELS.plan;
