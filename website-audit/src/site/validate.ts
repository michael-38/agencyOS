// The gate. A generated site is only as trustworthy as what can be proved about it offline, so every
// invariant the build promises is checked here and every failure is attributed to a page so the
// repair pass can be told exactly what to fix.
//
// Three gates sit on top of the structural checks:
//   SEO         — the things that silently cost rankings (titles, canonicals, orphans, image sizing)
//   AEO         — the things that decide whether an assistant can quote the page at all
//   fabrication — every number and every credential in the rendered text traces to a source quote
import fs from 'node:fs';
import path from 'node:path';
import { SITE_LIMITS } from '../config.js';
import { extractJsonLd, hasType, loadHtml, typesOf } from '../checks/html.js';
import type { CheerioAPI } from 'cheerio';
import type { Report } from '../report/schema.js';
import { runSelfTest, type SelfTestResult } from './check-html.js';
import { normalizeForMatch, sha256Text, type CopyIndex } from './copy.js';
import { fileForPath } from './paths.js';
import type { BuildProfile, CopyMap, PlanPage, SitePlan } from './types.js';

export interface Finding {
  page: string;
  level: 'error' | 'warning';
  gate: 'structure' | 'seo' | 'aeo' | 'fabrication' | 'coverage';
  message: string;
}

export interface SiteValidation {
  ok: boolean;
  findings: Finding[];
  placeholder: { placeholder: number; total: number };
  selfTest: Record<string, SelfTestResult>;
  coverage: { tagged: string[]; missing: string[] };
}

export interface ValidateOptions {
  siteDir: string;
  repo: string;
  slug: string;
  profile: BuildProfile;
  plan: SitePlan;
  copyMap: CopyMap;
  copyIndex: CopyIndex;
  report: Report | null;
  /** Font files installed under the site dir; referencing anything else is an error. */
  installedFonts: string[];
  /** schema.org type for the industry's archetype, from config/industries.yaml. */
  jsonldType: string;
}

// ---------------------------------------------------------------------------------------------
// Claim detection (fabrication gate)
// ---------------------------------------------------------------------------------------------

/** Numbers that carry meaning. Bare single digits are skipped so "Step 1" is not a claim. */
const NUMBER_RE = /(?:\$\s?\d[\d,.]*|\d[\d,.]*\s?%|\b\d[\d,.]*[.,]\d+\b|\b\d{2,}\b)/g;
/** Assertions a business is not entitled to make unless its own site already made them. */
const HARD_CLAIM_RE = /\b(licen[cs]ed|insured|bonded|certified|accredited|board[-\s]certified|warrant(?:y|ies)|guarantee[ds]?|award[-\s]winning|awards?|voted|rated|no\.\s?1)\b|#\s?1/gi;
/** Superlatives, which are unverifiable by nature; a warning when the source did not say them. */
const SOFT_CLAIM_RE = /\b(best|leading|premier|top[-\s]rated|number one|most trusted|unrivall?ed|unmatched)\b/gi;

export interface ClaimCheck {
  hard: string[];
  soft: string[];
  numbers: string[];
}

/** Trailing sentence punctuation is part of the match but never part of the claim. */
const trimClaim = (s: string) => s.replace(/[.,;:!?]+$/, '').trim();

export function findClaims(text: string): ClaimCheck {
  return {
    numbers: [...text.matchAll(NUMBER_RE)].map((m) => trimClaim(m[0])),
    hard: [...text.matchAll(HARD_CLAIM_RE)].map((m) => trimClaim(m[0])),
    soft: [...text.matchAll(SOFT_CLAIM_RE)].map((m) => trimClaim(m[0])),
  };
}

/** Numbers compare on digits only, so "1,200" in the source supports "1200" in the rewrite. */
function digitsOf(s: string): string {
  return s.replace(/[^\d]/g, '');
}

export interface AllowedClaims {
  /** Everything the source says, verbatim: verified quotes plus the audit's extracted facts. */
  text: string;
  digits: Set<string>;
  /**
   * The audit's extracted facts only. These are atomic values — the phone number, the address, the
   * hours — so copy with no verified quote behind it may still state them. A quote, by contrast, is
   * context-bound: its numbers belong to the sentence they came from.
   */
  factText: string;
  factDigits: Set<string>;
}

function indexClaims(parts: string[]): { text: string; digits: Set<string> } {
  const joined = parts.join('\n');
  const digits = new Set<string>();
  for (const m of joined.matchAll(/\d[\d,.]*/g)) {
    const d = digitsOf(m[0]);
    if (d) digits.add(d);
  }
  return { text: normalizeForMatch(joined), digits };
}

export function buildAllowedClaims(copyIndex: CopyIndex, report: Report | null): AllowedClaims {
  const factParts: string[] = [];
  const f = report?.facts;
  if (f) {
    if (f.business_name) factParts.push(f.business_name);
    factParts.push(...f.phones);
    if (f.address) factParts.push(typeof f.address === 'string' ? f.address : JSON.stringify(f.address));
    if (f.hours) factParts.push(typeof f.hours === 'string' ? f.hours : JSON.stringify(f.hours));
    factParts.push(...f.services);
  }
  const quoteParts = [...copyIndex.entityQuotes, ...copyIndex.slots.filter((s) => s.verified && s.source.quote).map((s) => s.source.quote as string)];
  const all = indexClaims([...factParts, ...quoteParts]);
  const facts = indexClaims(factParts);
  return { text: all.text, digits: all.digits, factText: facts.text, factDigits: facts.digits };
}

// ---------------------------------------------------------------------------------------------
// Per-page checks
// ---------------------------------------------------------------------------------------------

const REMOTE_ATTR_RE = /^(https?:)?\/\//i;

interface PageCtx {
  page: PlanPage;
  file: string;
  html: string;
  $: CheerioAPI;
  push: (level: Finding['level'], gate: Finding['gate'], message: string) => void;
  /** True when a local href/src from this page resolves to a file that exists. */
  resolves: (target: string) => boolean;
}

/** Every local href/src/action on the page, minus anchors, schemes, and remote URLs. */
function localTargets($: CheerioAPI): string[] {
  const out = new Set<string>();
  $('a[href], img[src], link[href], source[src], video[src], audio[src], script[src]').each((_, el) => {
    const $el = $(el);
    const raw = ($el.attr('href') ?? $el.attr('src') ?? '').split('#')[0].trim();
    if (!raw || REMOTE_ATTR_RE.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return;
    out.add(raw);
  });
  return [...out];
}

function checkStructure(c: PageCtx, installedFonts: string[]): void {
  const { $, html, push } = c;
  if (!/^\s*<!doctype html>/i.test(html)) push('error', 'structure', 'missing <!doctype html>');
  if ($('html').length !== 1) push('error', 'structure', `expected exactly one <html>, found ${$('html').length}`);
  if (!$('html').attr('lang')) push('error', 'structure', '<html> has no lang attribute');
  for (const lm of ['header', 'main', 'footer']) if (!$(lm).length) push('error', 'structure', `landmark <${lm}> missing`);
  if (!$('header nav, footer nav').length) push('error', 'structure', 'no <nav> inside the header or footer');
  if ($('main section').length === 0) push('error', 'structure', 'no <section> inside <main>');
  if (!$('a.skip-link').length) push('error', 'structure', 'skip link missing');
  if ($('script').not('[type="application/ld+json"]').length) push('error', 'structure', 'page contains executable <script>');
  if ($('iframe').length) push('error', 'structure', 'page contains an <iframe>');
  if ($('[style]').length) push('warning', 'structure', `${$('[style]').length} element(s) carry an inline style attribute instead of a class`);

  $('main section').each((_, el) => {
    const id = $(el).attr('id') ?? '?';
    if (!$(el).find('h1, h2').length) push('warning', 'structure', `section#${id} has no heading`);
    if (!$(el).attr('aria-labelledby') && id !== '?') push('warning', 'structure', `section#${id} has no aria-labelledby`);
  });

  // Zero external requests, in either profile: assets are local and relative.
  const allowedLocal = new Set(installedFonts);
  $('script[src], link[href], img[src], source[src], source[srcset], video[src], audio[src], form[action], iframe[src]').each((_, el) => {
    const $el = $(el);
    const v = $el.attr('src') || $el.attr('href') || $el.attr('action') || $el.attr('srcset') || '';
    const tag = (el as unknown as { tagName: string }).tagName;
    if (REMOTE_ATTR_RE.test(v)) push('error', 'structure', `external request: <${tag} … ${v.slice(0, 80)}>`);
  });
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (REMOTE_ATTR_RE.test(href)) push('error', 'structure', `off-site link <a href="${href.slice(0, 80)}"> — generated pages link only within the site`);
  });
  for (const target of localTargets($)) {
    if (!c.resolves(target)) push('error', 'structure', `dead link: ${target} does not exist`);
  }
  if (allowedLocal.size === 0 && /@font-face/i.test(html)) push('warning', 'structure', 'page declares @font-face but no font files were installed');
}

function headingOutline($: CheerioAPI): number[] {
  const levels: number[] = [];
  $('main').find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    levels.push(parseInt((el as unknown as { tagName: string }).tagName.slice(1), 10));
  });
  return levels;
}

function checkSeo(c: PageCtx, profile: BuildProfile, titleIndex: Map<string, string[]>, descIndex: Map<string, string[]>): void {
  const { $, push, page } = c;
  const title = $('title').text().trim();
  const desc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  if (!title) push('error', 'seo', '<title> is missing or empty');
  else if (title.length < SITE_LIMITS.titleMinChars || title.length > SITE_LIMITS.titleMaxChars) {
    push('error', 'seo', `<title> is ${title.length} characters; it must be ${SITE_LIMITS.titleMinChars}–${SITE_LIMITS.titleMaxChars}: "${title}"`);
  }
  if (!desc) push('error', 'seo', 'meta description is missing');
  else if (desc.length < SITE_LIMITS.descriptionMinChars || desc.length > SITE_LIMITS.descriptionMaxChars) {
    push('error', 'seo', `meta description is ${desc.length} characters; it must be ${SITE_LIMITS.descriptionMinChars}–${SITE_LIMITS.descriptionMaxChars}`);
  }
  if (title) titleIndex.set(title, [...(titleIndex.get(title) ?? []), page.path]);
  if (desc) descIndex.set(desc, [...(descIndex.get(desc) ?? []), page.path]);

  if (!$('meta[name="viewport"]').length) push('error', 'seo', 'viewport meta missing');
  const h1s = $('h1');
  if (h1s.length !== 1) push('error', 'seo', `expected exactly one <h1>, found ${h1s.length}`);

  const levels = headingOutline($);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      push('error', 'seo', `heading level jumps from h${levels[i - 1]} to h${levels[i]}; assistants read the outline, so no level may be skipped`);
      break;
    }
  }

  if (profile === 'production') {
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical) push('error', 'seo', 'canonical link missing');
    if (!$('meta[property="og:title"]').length) push('error', 'seo', 'Open Graph tags missing');
  }

  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') ?? '(no src)';
    if (!($el.attr('alt') ?? '').trim()) push('error', 'seo', `<img src="${src}"> has no alt text`);
    if (!$el.attr('width') || !$el.attr('height')) push('error', 'seo', `<img src="${src}"> has no intrinsic width/height, which causes layout shift`);
  });
}

function checkAeo(c: PageCtx, ctx: { jsonldType: string }): void {
  const { $, push, page } = c;
  const ld = extractJsonLd($);
  if (ld.parseErrors) push('error', 'aeo', `${ld.parseErrors} JSON-LD block(s) do not parse`);
  if (!ld.objects.length) {
    push('error', 'aeo', 'no JSON-LD found');
    return;
  }
  for (const want of ['WebSite', 'WebPage', ctx.jsonldType]) {
    if (!hasType(ld, [want])) push('error', 'aeo', `JSON-LD @graph has no ${want} node`);
  }
  if (page.breadcrumb.length && !hasType(ld, ['BreadcrumbList'])) push('error', 'aeo', 'a page below the home page has no BreadcrumbList');
  const webPage = ld.objects.find((o) => typesOf(o).includes('WebPage'));
  if (webPage && !webPage.speakable) push('warning', 'aeo', 'WebPage node has no speakable specification');

  // The FAQ in the markup and the FAQ in the structured data must be the same FAQ.
  const faqNode = ld.objects.find((o) => typesOf(o).includes('FAQPage'));
  if (page.faq.length) {
    if (!faqNode) {
      push('error', 'aeo', 'the page renders an FAQ but has no FAQPage node');
    } else {
      const entities = (faqNode.mainEntity as { name?: string; acceptedAnswer?: { text?: string } }[]) ?? [];
      if (entities.length !== page.faq.length) {
        push('error', 'aeo', `FAQPage lists ${entities.length} question(s) but the page plans ${page.faq.length}`);
      }
      // Both halves must be on the page: a question or an answer that only exists in the markup is
      // exactly the kind of invisible structured data search engines treat as a manipulation.
      const bodyText = normalizeForMatch($('main').text());
      for (const e of entities) {
        if (e.name && !bodyText.includes(normalizeForMatch(e.name))) {
          push('error', 'aeo', `FAQPage question "${e.name}" is not visible in the rendered page`);
        }
        const answer = e.acceptedAnswer?.text;
        if (answer && !bodyText.includes(normalizeForMatch(answer))) {
          push('error', 'aeo', `the FAQPage answer to "${e.name ?? '(unnamed)'}" does not match the answer rendered on the page`);
        }
      }
    }
  } else if (faqNode) {
    push('error', 'aeo', 'FAQPage node is present but the page renders no FAQ');
  }

  // Answer-first: every section opens with a marked, self-contained sentence.
  $('main section').each((_, el) => {
    const $s = $(el);
    const id = $s.attr('id') ?? '?';
    const opener = $s.find('[data-answer-first]').first();
    if (!opener.length) {
      push('warning', 'aeo', `section#${id} has no [data-answer-first] opener, so the answer-first sentence cannot be marked speakable`);
      return;
    }
    const text = opener.text().trim();
    if (/^(as (mentioned|noted|we said)|see (above|below)|in addition to the above)/i.test(text)) {
      push('error', 'aeo', `section#${id} opens with a back-reference; every section must stand alone`);
    }
  });
  const body = $('main').text();
  for (const m of body.matchAll(/\b(as mentioned above|as we said above|see below|as noted above)\b/gi)) {
    push('error', 'aeo', `the page contains "${m[0]}"; chunks quoted out of context must still make sense`);
  }
}

function checkFabrication(c: PageCtx, allowed: AllowedClaims, copyMap: CopyMap): void {
  const { $, push, page } = c;
  const mapped = new Map(copyMap.paragraphs.filter((p) => p.page_path === page.path).map((p) => [p.copy_id, p]));
  const seen = new Set<string>();

  $('main').find('p, li, blockquote, dd').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav').length) return;
    const text = $el.text().trim();
    if (!text) return;
    const id = $el.attr('data-copy-id');
    if (!id) {
      push('error', 'fabrication', `untracked text in <main> with no data-copy-id: "${text.slice(0, 80)}"`);
      return;
    }
    const entry = mapped.get(id);
    if (!entry) {
      push('error', 'fabrication', `data-copy-id="${id}" is not in copy_map.json for this page`);
      return;
    }
    if (seen.has(id)) {
      push('error', 'fabrication', `data-copy-id="${id}" is rendered more than once on this page; each planned block appears exactly once`);
      return;
    }
    seen.add(id);
    if (sha256Text(text) !== entry.text_sha256) {
      push('error', 'fabrication', `the text of ${id} does not match the planned copy; the rendered wording was changed`);
    }
    // Unsourced copy is held to the stricter standard: it may repeat an extracted fact (the phone
    // number, the address) but nothing that only exists inside some other sentence's quote.
    const isPlaceholder = entry.source === 'placeholder';
    const okText = isPlaceholder ? allowed.factText : allowed.text;
    const okDigits = isPlaceholder ? allowed.factDigits : allowed.digits;
    const why = isPlaceholder ? 'has no verified source and may only repeat an extracted fact' : 'appears in no source quote or extracted fact';
    const claims = findClaims(text);
    for (const n of claims.numbers) {
      const d = digitsOf(n);
      if (d && !okDigits.has(d)) push('error', 'fabrication', `${id} states "${n}", which ${isPlaceholder ? 'is not an extracted fact and the block has no verified source' : why}`);
    }
    for (const h of claims.hard) {
      if (!okText.includes(normalizeForMatch(h))) push('error', 'fabrication', `${id} claims "${h}", which ${isPlaceholder ? why : 'the source site never says'}`);
    }
    for (const s of claims.soft) {
      if (!allowed.text.includes(normalizeForMatch(s))) push('warning', 'fabrication', `${id} uses the superlative "${s}", which the source site never says`);
    }
  });

  // Headings, captions, and table cells make claims too, and none of them are copy-mapped.
  $('main').find('h1, h2, h3, h4, figcaption, caption, td, th, dt').each((_, el) => {
    const $el = $(el);
    if ($el.parents('nav').length) return;
    const text = $el.text().trim();
    if (!text) return;
    const where = `${(el as unknown as { tagName: string }).tagName} "${text.slice(0, 60)}"`;
    const claims = findClaims(text);
    for (const n of claims.numbers) {
      const d = digitsOf(n);
      if (d && !allowed.digits.has(d)) push('error', 'fabrication', `${where} states "${n}", which appears in no source quote or extracted fact`);
    }
    for (const h of claims.hard) {
      if (!allowed.text.includes(normalizeForMatch(h))) push('error', 'fabrication', `${where} claims "${h}", which the source site never says`);
    }
  });

  for (const [id] of mapped) {
    if (!seen.has(id)) push('error', 'fabrication', `planned copy ${id} was never rendered`);
  }

  const placeholders = $('[data-copy="placeholder"]').length;
  const notice = $('.notice, [data-placeholder-notice]').first();
  if (placeholders > 0 && !notice.length) push('error', 'fabrication', 'the page shows unverified copy but has no visible notice');
  if (notice.length && (notice.find('button').length || /dismiss|close/i.test(notice.attr('class') ?? ''))) {
    push('error', 'fabrication', 'the unverified-copy notice must not be dismissible');
  }
}

// ---------------------------------------------------------------------------------------------
// Site-wide
// ---------------------------------------------------------------------------------------------

export function validateSiteTree(o: ValidateOptions): SiteValidation {
  const findings: Finding[] = [];
  const selfTest: Record<string, SelfTestResult> = {};
  const titleIndex = new Map<string, string[]>();
  const descIndex = new Map<string, string[]>();
  const allowed = buildAllowedClaims(o.copyIndex, o.report);
  const taggedIds = new Set<string>();
  const jsonldType = o.jsonldType;

  for (const page of o.plan.pages) {
    const rel = fileForPath(page.path);
    const abs = path.join(o.siteDir, rel);
    if (!fs.existsSync(abs)) {
      findings.push({ page: page.path, level: 'error', gate: 'structure', message: `${rel} was not written` });
      continue;
    }
    const html = fs.readFileSync(abs, 'utf8');
    const $ = loadHtml(html);
    const push = (level: Finding['level'], gate: Finding['gate'], message: string) => findings.push({ page: page.path, level, gate, message });
    const pageDir = path.dirname(abs);
    const resolves = (target: string) => {
      const candidates = target.startsWith('/') ? [path.join(o.siteDir, target.slice(1))] : [path.resolve(pageDir, target)];
      return candidates.some((cand) => fs.existsSync(cand));
    };
    const c: PageCtx = { page, file: rel, html, $, push, resolves };

    checkStructure(c, o.installedFonts);
    checkSeo(c, o.profile, titleIndex, descIndex);
    checkAeo(c, { jsonldType });
    checkFabrication(c, allowed, o.copyMap);

    $('[data-checklist]').each((_, el) => {
      for (const id of ($(el).attr('data-checklist') ?? '').split(/[\s,]+/)) if (id) taggedIds.add(id);
    });

    try {
      selfTest[page.path] = runSelfTest({ file: abs, slug: o.slug, repo: o.repo, out: null });
    } catch (e) {
      findings.push({ page: page.path, level: 'warning', gate: 'coverage', message: `self-test failed: ${(e as Error).message}` });
    }
  }

  for (const [title, paths] of titleIndex) {
    if (paths.length > 1) findings.push({ page: paths[1], level: 'error', gate: 'seo', message: `duplicate <title> "${title}" on ${paths.join(', ')}` });
  }
  for (const [, paths] of descIndex) {
    if (paths.length > 1) findings.push({ page: paths[1], level: 'error', gate: 'seo', message: `duplicate meta description on ${paths.join(', ')}` });
  }

  // Orphans: every page must be reachable from the home page's markup.
  const homeFile = path.join(o.siteDir, 'index.html');
  if (fs.existsSync(homeFile)) {
    const $home = loadHtml(fs.readFileSync(homeFile, 'utf8'));
    const hrefs = new Set<string>();
    $home('a[href]').each((_, el) => {
      hrefs.add(($home(el).attr('href') ?? '').split('#')[0]);
    });
    for (const page of o.plan.pages) {
      if (page.path === '/') continue;
      const expected = o.profile === 'production' ? page.path : fileForPath(page.path);
      if (![...hrefs].some((h) => h === expected || h.endsWith(fileForPath(page.path)))) {
        findings.push({ page: page.path, level: 'warning', gate: 'seo', message: `no link from the home page reaches ${page.path}` });
      }
    }
  }

  // Audit coverage: every gap the audit found must be tagged somewhere in the site.
  const missing: string[] = [];
  if (o.report) {
    const ownerOf = new Map<string, string>();
    for (const page of o.plan.pages) for (const s of page.sections) for (const id of s.checklist_ids) if (!ownerOf.has(id)) ownerOf.set(id, page.path);
    for (const item of o.report.items.filter((i) => i.verdict !== 'pass')) {
      if (!taggedIds.has(item.id)) {
        missing.push(item.id);
        const owner = ownerOf.get(item.id) ?? '/';
        findings.push({
          page: owner,
          level: 'error',
          gate: 'coverage',
          message: `audit gap ${item.id} (${item.verdict}) has no data-checklist element; put data-checklist="${item.id}" on the element that satisfies it`,
        });
      }
    }
  }

  // Sitemap and on-disk pages must describe the same site.
  if (o.profile === 'production') {
    const sitemapPath = path.join(o.siteDir, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) findings.push({ page: '/', level: 'error', gate: 'seo', message: 'sitemap.xml was not written' });
    else {
      const xml = fs.readFileSync(sitemapPath, 'utf8');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      for (const page of o.plan.pages) {
        if (!locs.some((l) => l.endsWith(page.path))) findings.push({ page: page.path, level: 'error', gate: 'seo', message: `${page.path} is missing from sitemap.xml` });
      }
      if (locs.length !== o.plan.pages.length) {
        findings.push({ page: '/', level: 'error', gate: 'seo', message: `sitemap.xml lists ${locs.length} url(s) but the site has ${o.plan.pages.length} page(s)` });
      }
    }
    for (const f of ['robots.txt', 'llms.txt']) {
      if (!fs.existsSync(path.join(o.siteDir, f))) findings.push({ page: '/', level: 'error', gate: 'seo', message: `${f} was not written` });
    }
  }

  const placeholders = o.copyMap.paragraphs.filter((p) => p.source === 'placeholder').length;
  return {
    ok: !findings.some((f) => f.level === 'error'),
    findings,
    placeholder: { placeholder: placeholders, total: o.copyMap.paragraphs.length },
    selfTest,
    coverage: { tagged: [...taggedIds].sort(), missing },
  };
}

/**
 * Findings for one page, in the shape the repair pass wants. SEO findings that come from the plan
 * rather than the markup — a title the copy pass made too long, a duplicate description — are left
 * out, because re-rendering the body cannot fix them and telling the model to try wastes a call.
 */
const NOT_FIXABLE_BY_RENDER = /^(<title> is|meta description is|duplicate <title>|duplicate meta description|canonical link missing|sitemap\.xml|robots\.txt|llms\.txt|.* is missing from sitemap)/;

export function repairNotesFor(validation: SiteValidation, pagePath: string): string[] {
  return validation.findings
    .filter((f) => f.page === pagePath && f.level === 'error' && !NOT_FIXABLE_BY_RENDER.test(f.message))
    .map((f) => f.message);
}
