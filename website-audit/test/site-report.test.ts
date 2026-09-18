// seo-report.md is what a human reads before the page goes anywhere, so the tests are about whether
// it states the uncomfortable things: what did not validate, which images cannot be published, and
// which of the audit's findings a one-page rebuild leaves open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { renderSeoReport, type ReportChecklistItem } from '../src/site/report.js';
import { buildFilledCopyMap, indexFilledCopy } from '../src/site/copy.js';
import { fill } from '../src/site/fill.js';
import { entitiesOf } from '../src/site/content.js';
import { fixtureCorpus, fixturePack, fixtureReport, fixtureTemplate } from './site-helpers.js';
import type { AssetManifest, AssetRecord } from '../src/site/types.js';
import type { SiteValidation } from '../src/site/validate.js';

function asset(over: Partial<AssetRecord> = {}): AssetRecord {
  return {
    file: 'assets/img/hero-00.webp',
    source_url: 'https://example.test/hero.jpg',
    alt_from_source: 'Hero',
    bytes: 1000,
    width: 1024,
    height: 683,
    role: 'hero',
    same_host: true,
    verify_license: false,
    likely_stock: false,
    ...over,
  };
}

const validation = (over: Partial<SiteValidation> = {}): SiteValidation =>
  ({
    ok: true,
    findings: [],
    placeholder: { placeholder: 0, total: 4 },
    selfTest: {},
    coverage: { tagged: ['tel-link'], missing: [], uncoverable: [] },
    ...over,
  }) as SiteValidation;

const CHECKLIST: ReportChecklistItem[] = [
  { id: 'tel-link', criterion: 'A tap-to-call link exists', verdict: 'fail', weight: 'high', scope: 'home' },
];

function report(
  over: {
    assets?: AssetManifest;
    validation?: SiteValidation | null;
    notes?: string[];
    checklist?: ReportChecklistItem[];
    pack?: ReturnType<typeof fixturePack>;
    shots?: string[];
  } = {},
) {
  const tpl = fixtureTemplate();
  const pack = over.pack ?? fixturePack();
  const filled = fill({ manifest: tpl.manifest, templateHtml: tpl.html, pack, facts: fixtureReport().facts, assets: [] });
  const copyMap = buildFilledCopyMap(indexFilledCopy(filled.copy, entitiesOf(pack), fixtureCorpus()));
  return renderSeoReport({
    file: path.join('/tmp', 'x.md'),
    profile: 'mockup',
    baseUrl: 'https://example.test',
    slug: 'landscaping',
    manifest: tpl.manifest,
    pack,
    assets: over.assets ?? { assets: [asset()], skipped: [], harvested: 3, downloaded: 1 },
    copyMap,
    validation: over.validation === undefined ? validation() : over.validation,
    checklist: over.checklist ?? CHECKLIST,
    notes: over.notes ?? [],
    usd: 0.47,
  });
}

test('the report leads with the numbers an operator has to check', () => {
  const md = report();
  assert.match(md, /^# Example Yard Co — rebuilt home page/);
  assert.match(md, /- Template: `test\/fixture-template\.html` \(sha256 `[0-9a-f]{16}`\)/);
  assert.match(md, /- Audit gaps closed: 1 of 1 \(100%\)/);
  assert.match(md, /- Anthropic spend: \$0\.4700/);
  assert.match(md, /- Validation: passed/);
  assert.match(md, /- Unverified copy: \d+ of \d+ blocks/);
});

test("images that need a licence check are called out, including stock-looking ones on the client's own host", () => {
  const md = report({
    assets: {
      assets: [
        asset({ file: 'assets/img/a.webp', likely_stock: true }),
        asset({ file: 'assets/img/b.webp', same_host: false, verify_license: true, source_url: 'https://cdn.other.test/b.jpg' }),
        asset({ file: 'assets/img/c.webp' }),
      ],
      skipped: [],
      harvested: 5,
      downloaded: 3,
    },
  });
  assert.match(md, /## Images to check before publishing/);
  assert.match(md, /`assets\/img\/a\.webp` — filename looks like a stock-library download/);
  assert.match(md, /`assets\/img\/b\.webp` — hosted off the audited domain/);
  assert.ok(!md.includes('`assets/img/c.webp`'), 'a clean image is not listed');
});

test('unresolved errors are reproduced verbatim, and each says where to fix it', () => {
  const md = report({
    validation: validation({
      ok: false,
      findings: [
        { page: '/', level: 'error', gate: 'fabrication', message: 'p003 claims "accredited", which the source site never says' },
        { page: '/', level: 'warning', gate: 'aeo', message: 'section#hero has no [data-answer-first] opener' },
      ],
      coverage: { tagged: [], missing: ['review-markup'], uncoverable: [] },
    }),
    checklist: [...CHECKLIST, { id: 'review-markup', criterion: 'Review markup is present', verdict: 'fail', weight: 'med', scope: 'home' }],
    notes: ['build reference: med-spa.md is an unfilled authoring skeleton'],
  });
  assert.match(md, /## Unresolved validation errors/);
  assert.match(md, /\[fabrication\] p003 claims "accredited"/);
  assert.match(md, /re-run `--stage fill`, which is free/);
  assert.match(md, /## Warnings/);
  assert.match(md, /## Audit gaps the template should have closed, and did not/);
  assert.match(md, /- `review-markup` — Review markup is present/);
  assert.match(md, /unfilled authoring skeleton/);
  assert.match(md, /- Validation: 1 error\(s\)/);
});

test('the honest accounting of what a one-page rebuild leaves open is its own section', () => {
  const md = report({
    validation: validation({ coverage: { tagged: ['tel-link'], missing: [], uncoverable: ['live-chat', 'LS-service-area-pages'] } }),
    checklist: [
      ...CHECKLIST,
      { id: 'live-chat', criterion: 'A live chat widget is available', verdict: 'fail', weight: 'low', scope: 'home' },
      { id: 'LS-service-area-pages', criterion: 'A page exists per town served', verdict: 'fail', weight: 'med', scope: 'subpath' },
    ],
  });
  assert.match(md, /## What this page does not close/);
  assert.match(md, /2 of the audit's 3 open items are outside what a single templated page can carry/);
  assert.match(md, /do not let the rebuild imply a clean sweep/);
  // A subpath criterion needs a page; everything else needs a widget or client material.
  assert.match(md, /`LS-service-area-pages`.*needs a page of its own.*a dedicated page/);
  assert.match(md, /`live-chat`.*third-party widget or content only the business can supply/);
  assert.match(md, /- Audit gaps closed: 1 of 3 \(33%\)/);
});

test('a clean sweep says so plainly rather than printing an empty table', () => {
  const md = report();
  assert.match(md, /Every one of the audit's 1 open items is addressed on this page\./);
  assert.ok(!md.includes('| criterion | weight |'));
});

test('sections the source could not fill are listed as things to ask the client for', () => {
  const md = report({ pack: fixturePack({ omit_sections: ['faq'] }) });
  assert.match(md, /## Sections removed for lack of source material/);
  assert.match(md, /- `faq`/);
  assert.match(md, /a specific thing to ask the client for/);
});

test('the report says the design is the template, and how to change its accent', () => {
  assert.match(report(), /The design is this industry's template, not a bespoke one\./);
  assert.match(report(), /pass `--brand <hex>` and re-run `--stage fill`/);
  assert.match(report({ notes: ['brand: accent #0057b8 from logo, contrast 5.10:1 (light, needs 4.5)'] }), /taken from the client's own logo/);
});

test('the mockup profile says why the production-only files are absent', () => {
  assert.match(report(), /Re-run with `--profile production --base-url …`/);
});
