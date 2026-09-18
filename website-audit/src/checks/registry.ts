// Deterministic check registry. Persona rows with check: deterministic bind to these ids.
// Every check is a pure function over a PageContext; no network, no industry knowledge
// (vendor lists and schema types come from config/detectors.yaml via ctx.detectors).
import type { CheerioAPI } from 'cheerio';
import type { Verdict } from '../personas/schema.js';
import type { Detectors } from '../personas/load.js';
import {
  extractJsonLd, findVendors, forms, hasType, headingTexts, JsonLdExtract, loadHtml, matchesPattern, questionHeadings, snippet,
  telHrefs, typesOf, visibleText,
} from './html.js';

export interface ProbeResult {
  probe_version: number;
  error?: string;
  viewport?: { width: number; height: number };
  fold?: number;
  dpr?: number;
  scrollHeight?: number;
  telLinks?: { href: string; text: string; top: number; inHeader: boolean }[];
  ctas?: { tag: string; text: string; href: string | null; top: number }[];
  forms?: { action: string | null; fieldCount: number; hasSubmit: boolean; top: number; isSearch: boolean }[];
  imagesAboveFold?: { src: string; alt: string | null; w: number; h: number; top: number }[];
  fixedBottomBars?: { text: string; hasTel: boolean; hasCta: boolean }[];
  h1?: string[];
  h2?: string[];
  navText?: string[];
}

export interface PageContext {
  url: string;
  rawHtml: string;
  markdown: string;
  links: string[];
  probe: ProbeResult | null;
  viewport: { width: number; height: number };
  detectors: Detectors;
  /** Archetype's expected JSON-LD type (e.g. LocalBusiness). */
  jsonldType: string;
  /**
   * CSS from stylesheets the page links to locally. Only check-html sets this: a live scrape has the
   * layout probe, but an offline file's rules would otherwise be blind to everything outside a
   * <style> element, and a generated site keeps its CSS in a separate file.
   */
  localCss?: string;
  // lazily computed
  _$?: CheerioAPI;
  _jsonld?: JsonLdExtract;
}

export interface DeterministicEvidence {
  method: 'deterministic' | 'dom-order-fallback';
  selector?: string;
  snippet?: string;
  values?: Record<string, unknown>;
  summary: string;
}

export interface CheckResult {
  verdict: Verdict;
  evidence: DeterministicEvidence;
  note: string;
}

export type CheckFn = (ctx: PageContext) => CheckResult;

export interface CheckDef {
  id: string;
  description: string;
  /** Needs layout information from the in-browser probe; without it the result is capped at partial. */
  needsProbe: boolean;
  fn: CheckFn;
}

export function $of(ctx: PageContext): CheerioAPI {
  if (!ctx._$) ctx._$ = loadHtml(ctx.rawHtml);
  return ctx._$;
}
export function jsonldOf(ctx: PageContext): JsonLdExtract {
  if (!ctx._jsonld) ctx._jsonld = extractJsonLd($of(ctx));
  return ctx._jsonld;
}

const ok = (summary: string, values?: Record<string, unknown>, extra?: Partial<DeterministicEvidence>): CheckResult => ({
  verdict: 'pass',
  evidence: { method: 'deterministic', summary, values, ...extra },
  note: '',
});
const partial = (summary: string, note: string, values?: Record<string, unknown>, extra?: Partial<DeterministicEvidence>): CheckResult => ({
  verdict: 'partial',
  evidence: { method: 'deterministic', summary, values, ...extra },
  note,
});
const fail = (summary: string, note: string, values?: Record<string, unknown>, extra?: Partial<DeterministicEvidence>): CheckResult => ({
  verdict: 'fail',
  evidence: { method: 'deterministic', summary, values, ...extra },
  note,
});
/** Fallback results never exceed partial. */
const fallback = (r: CheckResult): CheckResult => ({
  ...r,
  verdict: r.verdict === 'pass' ? 'partial' : r.verdict,
  evidence: { ...r.evidence, method: 'dom-order-fallback' },
  note: r.note ? `${r.note} (no layout probe; DOM-order estimate)` : 'no layout probe; DOM-order estimate',
});

function probeOk(ctx: PageContext): ctx is PageContext & { probe: ProbeResult } {
  return !!ctx.probe && !ctx.probe.error;
}

function ctaLike(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

const telLink: CheckDef = {
  id: 'tel-link',
  description: 'A tap-to-call tel: link exists on the page.',
  needsProbe: false,
  fn: (ctx) => {
    const hrefs = telHrefs($of(ctx));
    if (hrefs.length) return ok(`${hrefs.length} tel: link(s), e.g. ${hrefs[0]}`, { hrefs }, { selector: 'a[href^="tel:"]' });
    return fail('no tel: link on the page', 'Mobile visitors cannot tap to call.', { hrefs: [] });
  },
};

const telLinkAboveFold: CheckDef = {
  id: 'tel-link-above-fold',
  description: 'A tel: link is visible without scrolling at the mobile viewport.',
  needsProbe: true,
  fn: (ctx) => {
    if (probeOk(ctx)) {
      const links = ctx.probe.telLinks ?? [];
      const above = links.filter((l) => l.top < ctx.viewport.height || l.inHeader);
      if (above.length) return ok(`tel: link at ${above[0].top}px (${above[0].inHeader ? 'in header' : 'above fold'})`, { above });
      if (links.length) return partial(`tel: link exists but first at ${Math.min(...links.map((l) => l.top))}px`, 'Visitors must scroll to find the phone link.', { links });
      return fail('no tel: link on the page', 'No tap-to-call link at all.', { links: [] });
    }
    const $ = $of(ctx);
    const hrefs = telHrefs($);
    if (!hrefs.length) return fail('no tel: link on the page', 'No tap-to-call link at all.', { hrefs: [] });
    const inHeader = $('header a[href^="tel:"], [role="banner"] a[href^="tel:"]').length > 0;
    return fallback(inHeader ? ok('tel: link inside <header>', { hrefs, inHeader }) : partial('tel: link exists outside <header>', 'Likely below the fold.', { hrefs }));
  },
};

const contactForm: CheckDef = {
  id: 'contact-form',
  description: 'A contact/quote form (native or embedded) exists on the page.',
  needsProbe: false,
  fn: (ctx) => {
    const $ = $of(ctx);
    const native = forms($).filter((f) => !f.isSearch && f.fieldCount >= 1);
    const embeds = findVendors(ctx.rawHtml, ctx.detectors.form_embeds);
    if (native.length) return ok(`form with ${native[0].fieldCount} field(s)`, { forms: native, embeds }, { selector: 'form' });
    if (embeds.length) return ok(`embedded form: ${embeds.join(', ')}`, { embeds });
    return fail('no contact form or form embed', 'No asynchronous way to reach the business.', { forms: [], embeds: [] });
  },
};

const bookingWidget: CheckDef = {
  id: 'booking-widget',
  description: 'An online booking/scheduling widget is present (or a booking CTA links to one).',
  needsProbe: false,
  fn: (ctx) => {
    const vendors = findVendors(ctx.rawHtml, ctx.detectors.booking_widgets);
    if (vendors.length) return ok(`booking widget: ${vendors.join(', ')}`, { vendors });
    const $ = $of(ctx);
    const ctas: string[] = [];
    $('a, button').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && ctaLike(t, ctx.detectors.booking_cta_words)) ctas.push(snippet(t, 60));
    });
    if (ctas.length) return partial(`booking-style CTA without a detected widget: "${ctas[0]}"`, 'CTA exists but no scheduling integration was detected.', { ctas: ctas.slice(0, 5) });
    return fail('no booking widget or booking CTA', 'Visitors cannot self-schedule.', { vendors: [], ctas: [] });
  },
};

const jsonldLocalBusiness: CheckDef = {
  id: 'jsonld-localbusiness',
  description: 'JSON-LD of the archetype type (or an accepted schema.org subtype) is present and parseable.',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    const wanted = [ctx.jsonldType, ...ctx.detectors.schema_org_local_business_subtypes];
    const types = [...new Set(ld.objects.flatMap(typesOf))];
    if (hasType(ld, wanted)) return ok(`JSON-LD type(s): ${types.filter((t) => wanted.map((w) => w.toLowerCase()).includes(t.toLowerCase())).join(', ')}`, { types });
    if (ld.objects.length) return partial(`JSON-LD present but no ${ctx.jsonldType}: ${types.join(', ') || '(untyped)'}`, `Add a ${ctx.jsonldType} (or subtype) block.`, { types });
    if (ld.scripts && ld.parseErrors === ld.scripts) return fail('JSON-LD script(s) present but none parse', 'Fix the JSON syntax.', { scripts: ld.scripts, parseErrors: ld.parseErrors });
    return fail('no JSON-LD on the page', `Add ${ctx.jsonldType} structured data.`, { types: [] });
  },
};

const structuredData: CheckDef = {
  id: 'structured-data',
  description: 'At least one parseable JSON-LD object with an @type exists.',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    const types = [...new Set(ld.objects.flatMap(typesOf))];
    if (ld.objects.length) return ok(`JSON-LD types: ${types.join(', ')}`, { types, scripts: ld.scripts });
    if (ld.scripts) return partial('JSON-LD script(s) present but unparseable or untyped', 'Fix the JSON or add @type.', { scripts: ld.scripts, parseErrors: ld.parseErrors });
    return fail('no JSON-LD structured data', 'Machines have nothing to read.', { scripts: 0 });
  },
};

const reviewMarkup: CheckDef = {
  id: 'review-markup',
  description: 'Reviews/ratings exist as JSON-LD (AggregateRating/Review) or an embedded reviews widget.',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    const hasRating = ld.objects.some((o) => typesOf(o).some((t) => /^(aggregaterating|review)$/i.test(t)) || 'aggregateRating' in o || 'review' in o);
    const embeds = findVendors(ctx.rawHtml, ctx.detectors.review_embeds);
    if (hasRating) return ok('AggregateRating/Review JSON-LD present', { embeds });
    if (embeds.length) return ok(`review widget: ${embeds.join(', ')}`, { embeds });
    const heads = headingTexts($of(ctx), 'h1, h2, h3').filter((h) => /review|testimonial|what (our )?(clients|customers) say/i.test(h));
    if (heads.length) return partial(`"${snippet(heads[0], 60)}" section without review markup`, 'Testimonials exist but are invisible to machines.', { headings: heads });
    return fail('no review markup or reviews widget', 'No social proof machines can read.', { embeds: [] });
  },
};

const aboveFoldImages: CheckDef = {
  id: 'above-fold-images',
  description: 'At least one reasonably sized image (>= 200x150 css px) appears above the mobile fold.',
  needsProbe: true,
  fn: (ctx) => {
    if (probeOk(ctx)) {
      const imgs = (ctx.probe.imagesAboveFold ?? []).filter((i) => i.top < ctx.viewport.height);
      const big = imgs.filter((i) => i.w >= 200 && i.h >= 150);
      if (big.length) return ok(`${big.length} image(s) >= 200x150 above the fold (first ${big[0].w}x${big[0].h})`, { images: big.slice(0, 5) });
      if (imgs.length) return partial(`${imgs.length} small image(s) only (max ${Math.max(...imgs.map((i) => i.w))}px wide)`, 'Only logo/icon-sized imagery above the fold.', { images: imgs.slice(0, 5) });
      return fail('no images above the fold', 'First screen is text-only.', { images: [] });
    }
    const $ = $of(ctx);
    const first = $('header img, main img, body img').slice(0, 3);
    let big = 0;
    first.each((_, el) => {
      const w = parseInt($(el).attr('width') || '0', 10);
      const h = parseInt($(el).attr('height') || '0', 10);
      if (w >= 200 && h >= 150) big++;
    });
    if (big) return fallback(ok(`${big} early image(s) with >= 200x150 attributes`, { big }));
    if (first.length) return fallback(partial(`${first.length} early image(s) of unknown size`, 'Sizes unknown without layout.', { count: first.length }));
    return fail('no <img> early in the document', 'First screen is likely text-only.', { count: 0 });
  },
};

const stickyMobileCta: CheckDef = {
  id: 'sticky-mobile-cta',
  description: 'A fixed/sticky bottom bar with a call or CTA link exists at the mobile viewport.',
  needsProbe: true,
  fn: (ctx) => {
    if (probeOk(ctx)) {
      const bars = ctx.probe.fixedBottomBars ?? [];
      const good = bars.filter((b) => b.hasTel || b.hasCta);
      if (good.length) return ok(`sticky bar: "${snippet(good[0].text, 50)}"`, { bars: good });
      if (bars.length) return partial('fixed bottom bar without a call/CTA link', 'Bar exists but does not convert.', { bars });
      return fail('no sticky mobile CTA bar', 'No persistent call/book action while scrolling.', { bars: [] });
    }
    const lower = ctx.rawHtml.toLowerCase();
    const hint = /position\s*:\s*(fixed|sticky)/.test(lower) && /bottom\s*:\s*0/.test(lower);
    const classHint = /class="[^"]*(sticky|fixed)[^"]*(cta|call|bar|footer)[^"]*"/.test(lower);
    if (hint || classHint) return fallback(partial('CSS hints of a fixed bottom element', 'Cannot confirm without layout.', { hint, classHint }));
    return fallback(fail('no fixed/sticky bottom bar hints in HTML', 'Likely no sticky CTA.', {}));
  },
};

const liveChat: CheckDef = {
  id: 'live-chat',
  description: 'A live chat / messaging widget script is present.',
  needsProbe: false,
  fn: (ctx) => {
    const vendors = findVendors(ctx.rawHtml, ctx.detectors.chat_widgets);
    if (vendors.length) return ok(`chat widget: ${vendors.join(', ')}`, { vendors });
    return fail('no chat widget detected', 'No way to ask a quick question.', { vendors: [] });
  },
};

const singleH1: CheckDef = {
  id: 'single-h1',
  description: 'Exactly one non-empty H1.',
  needsProbe: false,
  fn: (ctx) => {
    const h1 = headingTexts($of(ctx), 'h1');
    if (h1.length === 1) return ok(`H1: "${snippet(h1[0], 80)}"`, { h1 }, { selector: 'h1' });
    if (h1.length > 1) return partial(`${h1.length} H1s: "${snippet(h1[0], 40)}", "${snippet(h1[1], 40)}"…`, 'Multiple H1s dilute the page topic.', { h1 });
    return fail('no H1', 'The page has no stated topic.', { h1: [] });
  },
};

const h2Structure: CheckDef = {
  id: 'h2-structure',
  description: 'At least two non-empty H2 section headings.',
  needsProbe: false,
  fn: (ctx) => {
    const h2 = headingTexts($of(ctx), 'h2');
    if (h2.length >= 2) return ok(`${h2.length} H2s, e.g. "${snippet(h2[0], 50)}"`, { h2: h2.slice(0, 10) }, { selector: 'h2' });
    if (h2.length === 1) return partial(`only one H2: "${snippet(h2[0], 60)}"`, 'Sections are not delineated.', { h2 });
    return fail('no H2 headings', 'No section structure for readers or machines.', { h2: [] });
  },
};

const faqPresent: CheckDef = {
  id: 'faq-present',
  description: 'An FAQ exists: FAQPage JSON-LD, an FAQ heading, or >= 3 question-form headings.',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    if (hasType(ld, ['FAQPage'])) return ok('FAQPage JSON-LD present', {});
    const $ = $of(ctx);
    const faqHead = headingTexts($, 'h1, h2, h3').filter((h) => /\bfaqs?\b|frequently asked/i.test(h));
    if (faqHead.length) return ok(`FAQ heading: "${snippet(faqHead[0], 60)}"`, { headings: faqHead });
    const qs = questionHeadings($);
    if (qs.length >= 3) return ok(`${qs.length} question-form headings`, { questions: qs.slice(0, 5) });
    if (qs.length) return partial(`${qs.length} question-form heading(s) only`, 'Not a recognisable FAQ section.', { questions: qs });
    return fail('no FAQ section', 'Common questions are not answered on the page.', {});
  },
};

const metaTitleDescription: CheckDef = {
  id: 'meta-title-description',
  description: 'Title 10-70 chars and meta description 50-170 chars.',
  needsProbe: false,
  fn: (ctx) => {
    const $ = $of(ctx);
    const title = ($('title').first().text() || '').trim();
    const desc = ($('meta[name="description"]').attr('content') || '').trim();
    const values = { title, titleLength: title.length, description: snippet(desc, 200), descriptionLength: desc.length };
    if (!title || !desc) return fail(`${!title ? 'title missing' : ''}${!title && !desc ? '; ' : ''}${!desc ? 'meta description missing' : ''}`, 'Search and AI results fall back to guessed text.', values);
    const titleOk = title.length >= 10 && title.length <= 70;
    const descOk = desc.length >= 50 && desc.length <= 170;
    if (titleOk && descOk) return ok(`title ${title.length} chars, description ${desc.length} chars`, values);
    return partial(`present but out of range (title ${title.length}, description ${desc.length})`, 'Length outside the 10-70 / 50-170 windows.', values);
  },
};

const hoursPresent: CheckDef = {
  id: 'hours-present',
  description: 'Business hours are stated (openingHours JSON-LD or day+time text).',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    const ldHours = ld.objects.find((o) => 'openingHours' in o || 'openingHoursSpecification' in o);
    if (ldHours) return ok('openingHours in JSON-LD', { openingHours: ldHours['openingHours'] ?? 'specification' });
    const text = visibleText($of(ctx));
    const m = ctx.detectors.hoursRe?.exec(text);
    if (m) return ok(`hours text: "${snippet(m[0], 60)}"`, { match: m[0] });
    return fail('no business hours found', 'Visitors cannot tell when to call.', {});
  },
};

const addressPresent: CheckDef = {
  id: 'address-present',
  description: 'A physical address is stated (PostalAddress JSON-LD, <address>, or street-address text).',
  needsProbe: false,
  fn: (ctx) => {
    const ld = jsonldOf(ctx);
    const ldAddr = ld.objects.find((o) => 'address' in o) || ld.objects.find((o) => typesOf(o).some((t) => /postaladdress/i.test(t)));
    if (ldAddr) return ok('address in JSON-LD', { address: ldAddr['address'] ?? ldAddr });
    const $ = $of(ctx);
    const addrEl = $('address').first().text().replace(/\s+/g, ' ').trim();
    if (addrEl) return ok(`<address>: "${snippet(addrEl, 80)}"`, { address: addrEl }, { selector: 'address' });
    const text = visibleText($);
    const m = ctx.detectors.addressRe?.exec(text);
    if (m) return ok(`address text: "${snippet(m[0], 80)}"`, { match: m[0] });
    return fail('no physical address found', 'Locality is unstated for visitors and machines.', {});
  },
};

export const CHECKS: CheckDef[] = [
  telLink,
  telLinkAboveFold,
  contactForm,
  bookingWidget,
  jsonldLocalBusiness,
  structuredData,
  reviewMarkup,
  aboveFoldImages,
  stickyMobileCta,
  liveChat,
  singleH1,
  h2Structure,
  faqPresent,
  metaTitleDescription,
  hoursPresent,
  addressPresent,
];

/**
 * Selectors of CSS rules that pin an element to the bottom of the viewport. Deliberately simple:
 * only class, id and element selectors survive, because the point is to hand cheerio something it
 * can evaluate, not to implement a CSS engine.
 */
function stickySelectors(lowerCss: string): string[] {
  const out: string[] = [];
  // Comments sit between rules, so they otherwise arrive glued to the front of a selector.
  const css = lowerCss.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/position\s*:\s*fixed/.test(body) || !/bottom\s*:\s*0/.test(body)) continue;
    for (const raw of m[1].split(',')) {
      const sel = raw.trim().replace(/::?[a-z-]+(\([^)]*\))?/g, '').trim();
      if (sel && /^[a-z0-9 .#_>-]+$/.test(sel)) out.push(sel);
    }
  }
  return [...new Set(out)];
}

export const REGISTRY: Map<string, CheckDef> = new Map(CHECKS.map((c) => [c.id, c]));
export const REGISTERED_CHECK_IDS: Set<string> = new Set(REGISTRY.keys());

export function runCheck(id: string, ctx: PageContext): CheckResult {
  const def = REGISTRY.get(id);
  if (!def) throw new Error(`Unknown deterministic check "${id}"`);
  try {
    return def.fn(ctx);
  } catch (e) {
    return { verdict: 'fail', evidence: { method: 'deterministic', summary: `check crashed: ${(e as Error).message}` }, note: 'check-error' };
  }
}

/** Static-layout variants used by check-html (no probe available for a local file). */
export const STATIC_LAYOUT_RULES: Record<string, (ctx: PageContext) => CheckResult | null> = {
  'tel-link-above-fold': (ctx) => {
    const $ = $of(ctx);
    const inHeader = $('header a[href^="tel:"], [role="banner"] a[href^="tel:"]').length > 0;
    const before = $('body').children().first().find('a[href^="tel:"]').length > 0;
    if (inHeader || before) return ok('tel: link inside <header> or before the first section (static rule)', { inHeader, before });
    return telHrefs($).length ? partial('tel: link exists but not in <header> (static rule)', 'Move it into the header.', {}) : fail('no tel: link', 'No tap-to-call link.', {});
  },
  'sticky-mobile-cta': (ctx) => {
    const $ = $of(ctx);
    let found = false;
    $('[style]').each((_, el) => {
      const s = ($(el).attr('style') || '').toLowerCase();
      if (/position\s*:\s*fixed/.test(s) && /bottom\s*:\s*0/.test(s) && $(el).find('a[href^="tel:"], a, button').length) found = true;
    });
    if (found) return ok('inline-styled fixed bottom bar with a link (static rule)', {});
    const css = `${$('style').text()}\n${ctx.localCss ?? ''}`.toLowerCase();
    // A class-based bar is better practice than an inline style, so bind the rule to the DOM rather
    // than settling for `partial`: take the selectors of any rule that pins an element to the
    // bottom, and see whether one of them actually matches a bar containing an action.
    for (const sel of stickySelectors(css)) {
      let bound = false;
      try {
        $(sel).each((_, el) => {
          if ($(el).find('a[href^="tel:"], a, button').length) bound = true;
        });
      } catch {
        continue; // a selector cheerio cannot evaluate tells us nothing either way
      }
      if (bound) return ok(`stylesheet pins "${sel}" to the bottom and it holds an action (static rule)`, {});
    }
    if (/position\s*:\s*fixed[^}]*bottom\s*:\s*0|bottom\s*:\s*0[^}]*position\s*:\s*fixed/.test(css)) return partial('stylesheet declares a fixed bottom element (static rule)', 'Cannot bind it to a CTA without layout.', {});
    return fail('no fixed bottom bar (static rule)', 'No sticky CTA.', {});
  },
  'above-fold-images': (ctx) => {
    const $ = $of(ctx);
    // The header and the first section are both above the fold, and either may carry the image, so
    // both are checked. Selecting `header, main > section` and taking .first() only ever looked in
    // the header, which made a hero image inside the first section invisible to this rule.
    for (const scope of [$('header').first(), $('main > section').first()]) {
      const img = scope.find('img, svg').first();
      if (img.length) return ok(`${img.prop('tagName')?.toString().toLowerCase()} in the header or first section (static rule)`, {});
    }
    return null;
  },
};
