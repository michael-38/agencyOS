// Fixture builders for the SiteRedesign (site:build) tests: a small plan, a matching report, and a
// renderer that produces a page the validator should pass, so each test can break exactly one thing.
import type { Report, ReportItem } from '../src/report/schema.js';
import type { CopyBlock, PageContent, PlanPage, Provenance, SiteArchitecture, SitePlan } from '../src/site/types.js';

export const SOURCE_URL = 'https://example.test/';

export function sourced(quote: string, url = SOURCE_URL): Provenance {
  return { kind: 'source', page_url: url, quote };
}
export const placeholder: Provenance = { kind: 'placeholder', page_url: null, quote: null };

export function block(text: string, source: Provenance = placeholder, kind: CopyBlock['kind'] = 'paragraph'): CopyBlock {
  return { kind, text, source };
}

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
      address: { '@type': 'PostalAddress', streetAddress: '1 Test Way', addressLocality: 'Riverton', addressRegion: 'UT', postalCode: '84065' },
      hours: null,
      services: ['Mowing', 'Paver installation'],
      sources: { business_name: 'jsonld' },
    },
    total_chars: CORPUS_TEXT.length,
  };
}

export function fixturePlan(overrides: Partial<SitePlan> = {}): SitePlan {
  const home: PlanPage = {
    path: '/',
    kind: 'home',
    title: 'Example Yard Co — garden care in Riverton',
    meta_description: 'Example Yard Co has kept gardens tidy in Riverton since 2009, with weekly mowing and paver work across Riverton and Draper.',
    primary_query: 'who does garden care in Riverton',
    h1: 'Garden care in Riverton',
    breadcrumb: [],
    entity_name: null,
    sections: [
      {
        id: 'overview',
        h2: 'What we do',
        answer_first_opener: block('Example Yard Co has kept gardens tidy in Riverton since 2009.', sourced('Example Yard Co has kept gardens tidy in Riverton since 2009.')),
        blocks: [block('Our crews work across Riverton and Draper.', sourced('Our crews work across Riverton and Draper.'))],
        cta: { label: 'Call us', kind: 'tel', target: '801-555-0100' },
        image_slot: 'none',
        checklist_ids: ['tel-link'],
      },
    ],
    faq: [{ q: 'When can I reach you?', a: 'We answer the phone seven days a week.', source: sourced('We answer the phone seven days a week.') }],
  };
  const service: PlanPage = {
    path: '/services/mowing/',
    kind: 'service',
    title: 'Weekly mowing in Riverton — Example Yard Co',
    meta_description: 'Weekly mowing from Example Yard Co, the crew that has kept gardens tidy in Riverton since 2009. Booked by phone.',
    primary_query: 'weekly mowing Riverton',
    h1: 'Weekly mowing',
    breadcrumb: ['Services', 'Mowing'],
    entity_name: 'Weekly mowing',
    sections: [
      {
        id: 'mowing',
        h2: 'How mowing works',
        answer_first_opener: block('Weekly mowing starts at $45 per visit.', sourced('Weekly mowing starts at $45 per visit.')),
        blocks: [],
        cta: null,
        image_slot: 'none',
        checklist_ids: [],
      },
    ],
    faq: [],
  };
  return {
    business_name: 'Example Yard Co',
    site_summary: 'Example Yard Co keeps gardens tidy in Riverton and Draper.',
    pages: [home, service],
    entities: {
      services: [{ name: 'Weekly mowing', detail: 'Mowing every week', source: sourced('Weekly mowing starts at $45 per visit.') }],
      areas: [{ name: 'Riverton', detail: '', source: sourced('Our crews work across Riverton and Draper.') }],
      credentials: [{ name: 'Licensed and insured', detail: '', source: sourced('We are licensed and insured for every job we take on.') }],
      rating: { value: '4.9', count: '132', source: sourced('Rated 4.9 by 132 customers on our review page.') },
      price_statements: [],
    },
    internal_links: [{ from_path: '/', to_path: '/services/mowing/', anchor_text: 'Weekly mowing' }],
    notes: [],
    ...overrides,
  };
}

/** The pass-1 shape: page architecture plus the facts the site may state. */
export function fixtureArchitecture(over: Partial<SiteArchitecture> = {}): SiteArchitecture {
  return {
    business_name: 'Example Yard Co',
    site_summary: 'Example Yard Co keeps gardens tidy in Riverton and Draper.',
    pages: [
      {
        path: '/',
        kind: 'home',
        title: 'Example Yard Co — garden care in Riverton',
        meta_description: 'Example Yard Co has kept gardens tidy in Riverton since 2009, with weekly mowing and paver work across Riverton and Draper.',
        primary_query: 'who does garden care in Riverton',
        h1: 'Garden care in Riverton',
        breadcrumb: [],
        entity_name: null,
        sections: [{ id: 'overview', h2: 'What we do', intent: 'Say what the company does and where.', image_slot: 'none', checklist_ids: ['tel-link'] }],
      },
      {
        path: '/services/mowing/',
        kind: 'service',
        title: 'Weekly mowing in Riverton — Example Yard Co',
        meta_description: 'Weekly mowing from Example Yard Co, the crew that has kept gardens tidy in Riverton since 2009. Booked by phone.',
        primary_query: 'weekly mowing Riverton',
        h1: 'Weekly mowing',
        breadcrumb: ['Services', 'Mowing'],
        entity_name: 'Weekly mowing',
        sections: [{ id: 'mowing', h2: 'How mowing works', intent: 'Explain the mowing offer.', image_slot: 'none', checklist_ids: [] }],
      },
    ],
    services: [{ name: 'Weekly mowing', detail: 'Mowing every week', source_kind: 'source', source_page_url: SOURCE_URL, source_quote: 'Weekly mowing starts at $45 per visit.' }],
    areas: [{ name: 'Riverton', detail: '', source_kind: 'source', source_page_url: SOURCE_URL, source_quote: 'Our crews work across Riverton and Draper.' }],
    credentials: [{ name: 'Licensed and insured', detail: '', source_kind: 'source', source_page_url: SOURCE_URL, source_quote: 'We are licensed and insured for every job we take on.' }],
    price_statements: [],
    rating_value: '4.9',
    rating_count: '132',
    rating_page_url: SOURCE_URL,
    rating_quote: 'Rated 4.9 by 132 customers on our review page.',
    internal_links: [{ from_path: '/', to_path: '/services/mowing/', anchor_text: 'Weekly mowing' }],
    notes: [],
  };
}

/** The pass-2 shape for one page. */
export function fixtureContent(sectionId: string, opener: string, quote: string | null, blocks: { text: string; quote: string | null }[] = [], faq: { q: string; a: string; quote: string | null }[] = []): PageContent {
  const prov = (q: string | null) =>
    q ? { source_kind: 'source' as const, source_page_url: SOURCE_URL, source_quote: q } : { source_kind: 'placeholder' as const, source_page_url: null, source_quote: null };
  return {
    sections: [
      {
        id: sectionId,
        h2: sectionId === 'overview' ? 'What we do' : 'How mowing works',
        opener: { kind: 'paragraph', text: opener, ...prov(quote) },
        blocks: blocks.map((b) => ({ kind: 'paragraph' as const, text: b.text, ...prov(b.quote) })),
        cta_label: 'Call us',
        cta_kind: 'tel',
        cta_target: '801-555-0100',
      },
    ],
    faq: faq.map((f) => ({ q: f.q, a: f.a, ...prov(f.quote) })),
    notes: [],
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
// A rendered site on disk, correct by construction, so each validator test can break one thing.
// ---------------------------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { buildCopyMap, indexCopy, type CopyIndex } from '../src/site/copy.js';
import { assembleDocument } from '../src/site/render.js';
import type { SeoContext } from '../src/site/seo.js';
import type { BuildProfile, CopyMap, RenderedPage } from '../src/site/types.js';
import { hrefBetween, outputFile } from '../src/site/paths.js';

const HOME_HEADER = `<nav aria-label="Site">
  <a href="index.html" aria-current="page">Home</a>
  <a href="services/mowing/index.html">Weekly mowing</a>
</nav>
<a class="tel" href="tel:8015550100" data-checklist="tel-link">801-555-0100</a>`;

const SERVICE_HEADER = `<nav aria-label="Site">
  <a href="../../index.html">Home</a>
  <a href="index.html" aria-current="page">Weekly mowing</a>
</nav>
<a class="tel" href="tel:8015550100">801-555-0100</a>`;

const FOOTER = `<nav aria-label="Footer"><a href="index.html">Home</a></nav>
<address>1 Test Way, Riverton, UT, 84065</address>`;

export function homeMarkup(): RenderedPage {
  return {
    header_html: HOME_HEADER,
    main_html: `<section id="overview" aria-labelledby="overview-h">
  <h1 id="overview-h">Garden care in Riverton</h1>
  <p data-copy-id="p001" data-answer-first>Example Yard Co has kept gardens tidy in Riverton since 2009.</p>
  <p data-copy-id="p002">Our crews work across Riverton and Draper.</p>
  <a class="cta" href="tel:8015550100">Call us</a>
</section>`,
    footer_html: FOOTER,
    sticky_html: '',
  };
}

export function serviceMarkup(): RenderedPage {
  return {
    header_html: SERVICE_HEADER,
    main_html: `<section id="mowing" aria-labelledby="mowing-h">
  <h1 id="mowing-h">Weekly mowing</h1>
  <p data-copy-id="p004" data-answer-first>Weekly mowing starts at $45 per visit.</p>
</section>`,
    footer_html: `<nav aria-label="Footer"><a href="../../index.html">Home</a></nav>`,
    sticky_html: '',
  };
}

export interface FixtureSite {
  dir: string;
  copyIndex: CopyIndex;
  copyMap: CopyMap;
  seo: SeoContext;
}

/** Write a two-page site that passes every gate. `mutate` may rewrite a page before it lands. */
export function writeFixtureSite(
  dir: string,
  opts: { profile?: BuildProfile; plan?: SitePlan; mutate?: (path: string, html: string) => string } = {},
): FixtureSite {
  const profile = opts.profile ?? 'mockup';
  const plan = opts.plan ?? fixturePlan();
  const copyIndex = indexCopy(plan, fixtureCorpus());
  const copyMap = buildCopyMap(copyIndex);
  const seo: SeoContext = {
    profile,
    baseUrl: 'https://example.test',
    jsonldType: 'LocalBusiness',
    facts: fixtureReport().facts,
    plan,
    assets: [],
    themeColor: '#123456',
    buildDate: '2026-09-16',
  };
  const ctx = {
    llm: null as never,
    model: '',
    seo,
    copy: copyIndex,
    assets: [],
    designMd: '',
    telHref: 'tel:8015550100',
    telLabel: '801-555-0100',
    addressText: '1 Test Way, Riverton, UT, 84065',
    hoursText: null,
  };
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'site.css'), ':root{--x:1}\n@media (prefers-reduced-motion: reduce){*{animation:none}}\n');
  const markup: Record<string, RenderedPage> = { '/': homeMarkup(), '/services/mowing/': serviceMarkup() };
  for (const page of plan.pages) {
    const rendered = markup[page.path];
    if (!rendered) continue;
    let html = assembleDocument({
      page,
      rendered,
      ctx,
      lcpImage: null,
      hasPlaceholders: false,
      headChecklistIds: [],
      faqChecklistIds: page.faq.length ? ['faq-present'] : [],
      internalLinks: seo.plan.internal_links.filter((l) => l.from_path === page.path).map((l) => ({ href: hrefBetween(page.path, l.to_path, profile), label: l.anchor_text })),
    });
    if (opts.mutate) html = opts.mutate(page.path, html);
    const file = outputFile(dir, page.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
  return { dir, copyIndex, copyMap, seo };
}

/** Replace the text of one copy-mapped paragraph without touching the head or the structured data. */
export function replaceCopy(html: string, copyId: string, newText: string): string {
  const re = new RegExp(`(<p[^>]*\\bdata-copy-id="${copyId}"[^>]*>)([^<]*)(</p>)`);
  if (!re.test(html)) throw new Error(`replaceCopy: no paragraph with data-copy-id="${copyId}"`);
  return html.replace(re, `$1${newText}$3`);
}
