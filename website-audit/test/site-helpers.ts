// Fixture builders for the templated-build tests: a small source corpus, a matching report, a
// fixture template, and a fill of that template that passes every gate — so each test can break
// exactly one thing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadHtml } from '../src/checks/html.js';
import { buildFilledCopyMap, indexFilledCopy, type CopyIndex } from '../src/site/copy.js';
import { fill, markUnverified } from '../src/site/fill.js';
import { patchHead, type PageSeoContext } from '../src/site/page-seo.js';
import { entitiesOf, type ContentPack, type SlotValue } from '../src/site/content.js';
import { readTemplate, type TemplateManifest } from '../src/site/template.js';
import type { Report, ReportItem } from '../src/report/schema.js';
import type { BuildProfile, CopyMap, Provenance } from '../src/site/types.js';

export const SOURCE_URL = 'https://example.test/';

export function sourced(quote: string, url = SOURCE_URL): Provenance {
  return { kind: 'source', page_url: url, quote };
}
export const placeholder: Provenance = { kind: 'placeholder', page_url: null, quote: null };

/** The scraped page text every sourced quote in the fixture plan must be found inside. */
export const CORPUS_TEXT = [
  '# Example Yard Co',
  'Example Yard Co has kept gardens tidy in Riverton since 2009.',
  'We are licensed and insured for every job we take on.',
  'Weekly mowing starts at $45 per visit.',
  'Our crews work across Riverton and Draper.',
  'Rated 4.9 by 132 customers on our review page.',
  'We answer the phone seven days a week.',
].join('\n\n');

export function fixtureCorpus() {
  return {
    host: 'example.test',
    home_url: SOURCE_URL,
    pages: [
      { url: SOURCE_URL, role: 'home' as const, page_key: 'aaa', title: 'Example Yard Co', headings: [], text: CORPUS_TEXT, chars_raw: CORPUS_TEXT.length, chars_clean: CORPUS_TEXT.length, repeated_blocks_removed: 0, truncated: false },
    ],
    facts: {
      business_name: 'Example Yard Co',
      phones: ['801-555-0100'],
      emails: [],
      address: { '@type': 'PostalAddress', streetAddress: '1 Test Way', addressLocality: 'Riverton', addressRegion: 'UT', postalCode: '84065' },
      hours: null,
      services: ['Mowing', 'Paver installation'],
      sources: { business_name: 'jsonld' },
    },
    total_chars: CORPUS_TEXT.length,
  };
}

export function item(id: string, over: Partial<ReportItem> = {}): ReportItem {
  return {
    id,
    source: 'persona',
    criterion: `criterion for ${id}`,
    scope: 'home',
    check: 'deterministic',
    weight: 'med',
    verdict: 'fail',
    evidence: { method: 'deterministic', summary: '' },
    candidates_checked: [],
    satisfied_at_url: null,
    note: '',
    candidates_selected: [],
    candidate_log: [],
    unverified: null,
    extra: {},
    ...over,
  };
}

export function fixtureReport(items: ReportItem[] = [item('tel-link')]): Report {
  return {
    input_url: SOURCE_URL,
    resolved_origin: 'https://example.test',
    home_url: SOURCE_URL,
    home_rule: 'root-2xx',
    rules_fired: [],
    industry: { slug: 'landscaping', confidence: 1, raw_slug: 'landscaping', rationale: null, source: 'override' },
    persona_file: 'personas/landscaping.md',
    persona_fallback: false,
    items,
    summary: { pass: 0, partial: 0, fail: items.length, top_gaps: [], verdict: 'weak', partial_audit: false, skipped: { modules: [], item_ids: [] } },
    facts: fixtureCorpus().facts,
    openseo: null,
    pages: [],
    run_meta: {
      timestamps: { started: '', finished: '' },
      models: {},
      credits_used: 0,
      anthropic_usd: 0,
      viewports: { mobile: [390, 844], desktop: null },
      run_dir: '',
      cache_source: null,
      cache_stats: { hits: 0, misses: 0, source_hits: 0 },
      persona_hashes: {},
      probe_version: 2,
      pipeline_version: '0.1.0',
      modules: {} as Report['run_meta']['modules'],
      launched_from: 'cli',
      judge_text: 'lean',
      candidate_pool: { rule: 'home-links-top-level', relative_depth: 1, urls: [], capped: [], cap: 8, considered: 0 },
      flags: { markdown_truncated_pages: [], probe_fallback_pages: [], second_map: false, subdomain_share: 0, candidate_pages_skipped: 0 },
    },
  };
}


// ---------------------------------------------------------------------------------------------
// A filled page on disk, correct by construction, so each gate test can break one thing.
// ---------------------------------------------------------------------------------------------

const I = 'data-slot-intent';

/**
 * A miniature template with one of everything the fill has to handle: a required paragraph, an
 * optional price, a repeat with two prototypes, an omittable region, a marked FAQ, and the audit
 * tags the coverage gate looks for.
 */
export const FIXTURE_TEMPLATE = `<!doctype html>
<html lang="en" data-mock-tokens="Mock%20Yard%20Co mockyard.example (555)%20000-0000">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mock Yard Co</title>
  <meta name="description" content="The mock business, which must not survive a fill of this template.">
  <meta name="theme-color" content="#123456">
  <style>
    :root { --brand-accent: #1f6f43; --brand-accent-dark: #14532d; --brand-accent-fg: #ffffff; }
    body { background: #ffffff; color: #111111; }
    a { color: var(--brand-accent-dark); }
    .btn { background: var(--brand-accent); color: var(--brand-accent-fg); }
    .callbar { position: fixed; bottom: 0; left: 0; right: 0; }
    @media (prefers-reduced-motion: reduce) { * { animation: none } }
    @media (prefers-color-scheme: dark) { :root { --brand-accent: #4ade80; --brand-accent-dark: #86efac; --brand-accent-fg: #06130b; } body { background: #0b0f0c; color: #e8efe9; } }
  </style>
  <script type="application/ld+json" data-checklist="structured-data jsonld-localbusiness meta-title-description">{"@context":"https://schema.org","@graph":[{"@type":"LocalBusiness","name":"Mock Yard Co"}]}</script>
</head>
<body>
  <header>
    <nav aria-label="Site"><a class="skip-link" href="#main">Skip to content</a><a href="#services">Services</a><a href="#faq">FAQ</a><a href="#contact">Contact</a></nav>
    <a class="tel" href="tel:+15550000000" data-slot-href="fact.phone_href" data-checklist="tel-link tel-link-above-fold"><span data-slot="fact.phone">(555) 000-0000</span></a>
  </header>
  <main id="main" data-checklist="h2-structure">
    <section class="hero" id="hero" aria-labelledby="hero-h">
      <h1 id="hero-h" data-slot="hero.h1" data-slot-kind="heading" data-slot-max="80" ${I}="What the business does." data-checklist="single-h1">Mock Yard Co keeps gardens tidy</h1>
      <p class="lede" data-answer-first data-slot="hero.lede" data-slot-kind="paragraph" data-slot-max="280" ${I}="Answer-first: services and places." data-checklist="C-answer-first">Mock Yard Co has kept gardens tidy in Mocktown since 1999.</p>
      <a class="btn" href="#contact" data-slot="hero.cta" data-slot-kind="heading" data-slot-max="24" ${I}="The primary action.">Get a quote</a>
    </section>
    <section class="section" id="services" aria-labelledby="services-h" data-omit-if-empty="services">
      <h2 id="services-h" data-slot="services.h2" data-slot-kind="heading" data-slot-max="60" ${I}="Heading for what is sold.">What we do</h2>
      <p data-answer-first data-slot="services.answer" data-slot-kind="paragraph" data-slot-max="240" ${I}="Answer-first: the kinds of work." data-checklist="C-answer-first">We mow, we edge, and we haul it away.</p>
      <div class="cards" data-repeat="services" data-repeat-min="2" data-repeat-max="4">
        <article class="card feature" data-repeat-item>
          <h3 data-slot="services[].name" data-slot-kind="heading" data-slot-max="48" ${I}="Name one service.">Weekly mowing</h3>
          <p data-slot="services[].blurb" data-slot-kind="paragraph" data-slot-max="180" ${I}="What the buyer gets.">Cut, trim and blow off, same day each week.</p>
          <p class="price" data-slot="services[].price" data-slot-kind="price" data-slot-max="28" data-slot-optional ${I}="A price only if stated.">From $45 a visit</p>
        </article>
        <article class="card" data-repeat-item>
          <h3 data-slot="services[].name" data-slot-kind="heading" data-slot-max="48" ${I}="Name one service.">Paver installation</h3>
          <p data-slot="services[].blurb" data-slot-kind="paragraph" data-slot-max="180" ${I}="What the buyer gets.">Compacted base, edge restraint, polymeric sand.</p>
          <p class="price" data-slot="services[].price" data-slot-kind="price" data-slot-max="28" data-slot-optional ${I}="A price only if stated.">From $9,200</p>
        </article>
      </div>
    </section>
    <section class="section" id="faq" aria-labelledby="faq-h" data-omit-if-empty="faq">
      <h2 id="faq-h" data-slot="faq.h2" data-slot-kind="heading" data-slot-max="48" ${I}="Heading for the questions.">Frequently asked questions</h2>
      <p data-answer-first data-slot="faq.answer" data-slot-kind="paragraph" data-slot-max="160" ${I}="Answer-first: whose questions." data-checklist="C-answer-first">These are the questions we are asked most.</p>
      <div class="faq-list" data-repeat="faq" data-repeat-min="1" data-repeat-max="6" data-checklist="faq-present">
        <details class="faq-item" data-repeat-item>
          <summary><h3 class="faq-q" data-faq-q data-slot="faq[].q" data-slot-kind="heading" data-slot-max="90" ${I}="A question a buyer asks.">Do you work in my town?</h3></summary>
          <p class="faq-a" data-faq-a data-answer-first data-slot="faq[].a" data-slot-kind="paragraph" data-slot-max="420" ${I}="Answer it in the first sentence.">We work across Mocktown and Mockville.</p>
        </details>
      </div>
    </section>
    <section class="section" id="contact" aria-labelledby="contact-h">
      <h2 id="contact-h" data-slot="contact.h2" data-slot-kind="heading" data-slot-max="48" ${I}="Ask for the enquiry.">Get in touch</h2>
      <p data-answer-first data-slot="contact.answer" data-slot-kind="paragraph" data-slot-max="220" ${I}="Answer-first: what happens next." data-checklist="C-answer-first">Send the address and we call you back.</p>
      <form action="#" method="post" data-checklist="contact-form"><label for="n">Name</label><input id="n" name="n" type="text"><button class="btn" type="submit" data-slot="contact.submit" data-slot-kind="heading" data-slot-max="28" ${I}="The submit label.">Request a visit</button></form>
      <dl data-checklist="address-present hours-present">
        <div><dt>Address</dt><dd><address data-slot="fact.address">1 Mock Way, Mocktown</address></dd></div>
        <div><dt>Hours</dt><dd data-slot="fact.hours" data-slot-optional>Mon-Fri</dd></div>
      </dl>
    </section>
  </main>
  <footer>
    <nav aria-label="Footer"><a href="#main">Back to top</a></nav>
    <p data-slot="fact.business_name">Mock Yard Co</p>
  </footer>
  <div class="callbar" data-checklist="sticky-mobile-cta">
    <a href="tel:+15550000000" data-slot-href="fact.phone_href"><span data-slot="hero.cta" data-slot-mirror>Get a quote</span></a>
  </div>
</body>
</html>
`;

let templateN = 0;

/** Write the fixture template to a temp file and read its manifest. */
export function fixtureTemplate(html = FIXTURE_TEMPLATE): { file: string; html: string; manifest: TemplateManifest } {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-tpl-')), `t${templateN++}.html`);
  fs.writeFileSync(file, html);
  return { file, html, manifest: readTemplate(file, 'landscaping', 'test/fixture-template.html') };
}

export const sourcedSlot = (slot: string, text: string, quote: string): SlotValue => ({
  slot,
  text,
  source_kind: 'source',
  source_page_url: SOURCE_URL,
  source_quote: quote,
});
export const placeholderSlot = (slot: string, text: string): SlotValue => ({
  slot,
  text,
  source_kind: 'placeholder',
  source_page_url: null,
  source_quote: null,
});

/** A pack that fills the fixture template completely, with every quote present in CORPUS_TEXT. */
export function fixturePack(over: Partial<ContentPack> = {}): ContentPack {
  const slots: SlotValue[] = [
    sourcedSlot('hero.h1', 'Example Yard Co keeps gardens tidy', 'Example Yard Co has kept gardens tidy in Riverton since 2009.'),
    sourcedSlot('hero.lede', 'Example Yard Co has kept gardens tidy in Riverton since 2009.', 'Example Yard Co has kept gardens tidy in Riverton since 2009.'),
    sourcedSlot('hero.cta', 'Get a quote', 'We answer the phone seven days a week.'),
    sourcedSlot('services.h2', 'What we do', 'Our crews work across Riverton and Draper.'),
    sourcedSlot('services.answer', 'Our crews work across Riverton and Draper.', 'Our crews work across Riverton and Draper.'),
    sourcedSlot('services[0].name', 'Weekly mowing', 'Weekly mowing starts at $45 per visit.'),
    sourcedSlot('services[0].blurb', 'Weekly mowing, on the same day each week.', 'Weekly mowing starts at $45 per visit.'),
    sourcedSlot('services[0].price', 'From $45 per visit', 'Weekly mowing starts at $45 per visit.'),
    sourcedSlot('services[1].name', 'Paver installation', 'Our crews work across Riverton and Draper.'),
    sourcedSlot('services[1].blurb', 'Installed by our own crew across Riverton.', 'Our crews work across Riverton and Draper.'),
    sourcedSlot('faq.h2', 'Frequently asked questions', 'We answer the phone seven days a week.'),
    sourcedSlot('faq.answer', 'These are the questions we are asked most often.', 'We answer the phone seven days a week.'),
    sourcedSlot('faq[0].q', 'Do you work in my town?', 'Our crews work across Riverton and Draper.'),
    // Deliberately not the same sentence as services.answer: two identical strings on the page would
    // let an FAQ answer be edited without the AEO mirror check noticing.
    sourcedSlot('faq[0].a', 'We answer the phone seven days a week, across Riverton and Draper.', 'We answer the phone seven days a week.'),
    sourcedSlot('contact.h2', 'Get in touch', 'We answer the phone seven days a week.'),
    sourcedSlot('contact.answer', 'We answer the phone seven days a week.', 'We answer the phone seven days a week.'),
    sourcedSlot('contact.submit', 'Request a visit', 'We answer the phone seven days a week.'),
  ];
  return {
    business_name: 'Example Yard Co',
    title: 'Example Yard Co, garden care in Riverton',
    meta_description: 'Example Yard Co has kept gardens tidy in Riverton and Draper since 2009, with weekly mowing and paver installation.',
    site_summary: 'Garden care in Riverton, Utah.',
    slots,
    services: [{ name: 'Weekly mowing', detail: 'Same day each week', ...sourceFields('Weekly mowing starts at $45 per visit.') }],
    areas: [{ name: 'Riverton', detail: '', ...sourceFields('Our crews work across Riverton and Draper.') }],
    credentials: [],
    price_statements: [],
    rating_value: null,
    rating_count: null,
    rating_page_url: null,
    rating_quote: null,
    omit_sections: [],
    notes: [],
    ...over,
  };
}

const sourceFields = (quote: string) => ({ source_kind: 'source' as const, source_page_url: SOURCE_URL, source_quote: quote });

export interface FixtureSite {
  dir: string;
  copyIndex: CopyIndex;
  copyMap: CopyMap;
  manifest: TemplateManifest;
  pack: ContentPack;
  html: string;
}

/**
 * Fill the fixture template and write the result, exactly as a build would. `mutate` may rewrite the
 * page before it lands, which is how each gate test breaks one thing.
 */
export function writeFixtureSite(
  dir: string,
  opts: {
    profile?: BuildProfile;
    pack?: ContentPack;
    template?: string;
    mutate?: (pagePath: string, html: string) => string;
    brandCss?: string | null;
  } = {},
): FixtureSite {
  const profile = opts.profile ?? 'mockup';
  const tpl = fixtureTemplate(opts.template);
  const pack = opts.pack ?? fixturePack();
  const report = fixtureReport();

  const filled = fill({ manifest: tpl.manifest, templateHtml: tpl.html, pack, facts: report.facts, assets: [], brandCss: opts.brandCss ?? null });
  const copyIndex = indexFilledCopy(filled.copy, entitiesOf(pack), fixtureCorpus());
  const copyMap = buildFilledCopyMap(copyIndex);

  const $ = loadHtml(filled.html);
  markUnverified($, copyIndex.placeholderIds);
  const ctx: PageSeoContext = {
    profile,
    baseUrl: 'https://example.test',
    jsonldType: 'LocalBusiness',
    facts: report.facts,
    businessName: 'Example Yard Co',
    siteSummary: pack.site_summary,
    title: pack.title,
    metaDescription: pack.meta_description,
    entities: entitiesOf(pack),
    assets: [],
    buildDate: '2026-09-18',
  };
  patchHead($, ctx);
  let html = $.html();
  if (opts.mutate) html = opts.mutate('/', html);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return { dir, copyIndex, copyMap, manifest: tpl.manifest, pack, html };
}

/** Replace the text of one copy-mapped element without touching the head or the structured data. */
export function replaceCopy(html: string, copyId: string, newText: string): string {
  const re = new RegExp(`(<(?:p|h[1-6]|li|dd|cite|span|a|button|address)[^>]*\\bdata-copy-id="${copyId}"[^>]*>)([^<]*)(</)`);
  if (!re.test(html)) throw new Error(`replaceCopy: no element with data-copy-id="${copyId}"`);
  return html.replace(re, `$1${newText}$3`);
}
