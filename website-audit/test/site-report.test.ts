import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSeoReport } from '../src/site/report.js';
import { buildCopyMap, indexCopy } from '../src/site/copy.js';
import { fixtureCorpus, fixturePlan } from './site-helpers.js';
import type { AssetManifest, AssetRecord, SitePlan } from '../src/site/types.js';
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

function report(over: { assets?: AssetManifest; validation?: SiteValidation | null; notes?: string[]; preview?: boolean; plan?: SitePlan; shots?: string[] } = {}) {
  const plan = over.plan ?? fixturePlan();
  const copyMap = buildCopyMap(indexCopy(plan, fixtureCorpus()));
  return renderSeoReport({
    file: '/tmp/x.md',
    plan,
    profile: 'mockup',
    baseUrl: 'https://example.test',
    slug: 'landscaping',
    assets: over.assets ?? { assets: [asset()], skipped: [], harvested: 3, downloaded: 1 },
    copyMap,
    validation: over.validation === undefined ? ({ ok: true, findings: [], placeholder: { placeholder: 0, total: 4 }, selfTest: {}, coverage: { tagged: [], missing: [], deferred: [], uncoverable: [] } } as SiteValidation) : over.validation,
    notes: over.notes ?? [],
    usd: 2.5,
    preview: over.preview ?? false,
    shots: over.shots,
  });
}

test('the report leads with the numbers an operator has to check', () => {
  const md = report();
  assert.ok(md.includes('# Example Yard Co — generated site'));
  assert.ok(md.includes('- Pages: 2'));
  assert.ok(md.includes('- Anthropic spend: $2.5000'));
  assert.ok(md.includes('- Validation: passed'));
  assert.ok(/Placeholder copy: \d+ of \d+ blocks/.test(md));
});

test('images that need a licence check are called out, including stock-looking ones on the client\'s own host', () => {
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
  assert.ok(md.includes('## Images to check before publishing'));
  assert.ok(md.includes('`assets/img/a.webp` — filename looks like a stock-library download'));
  assert.ok(md.includes('`assets/img/b.webp` — hosted off the audited domain'));
  assert.ok(!md.includes('`assets/img/c.webp`'), 'a clean image is not listed');
});

test('unresolved errors are reproduced verbatim rather than summarised away', () => {
  const md = report({
    validation: {
      ok: false,
      findings: [
        { page: '/', level: 'error', gate: 'fabrication', message: 'p003 claims "accredited", which the source site never says' },
        { page: '/faq/', level: 'warning', gate: 'aeo', message: 'no speakable specification' },
      ],
      placeholder: { placeholder: 1, total: 4 },
      selfTest: {},
      coverage: { tagged: [], missing: ['review-markup'], deferred: [], uncoverable: [] },
    } as SiteValidation,
    notes: ['build reference: med-spa.md is an unfilled authoring skeleton'],
  });
  assert.ok(md.includes('## Unresolved validation errors'));
  assert.ok(md.includes('`/` [fabrication] p003 claims "accredited"'));
  assert.ok(md.includes('## Warnings'));
  assert.ok(md.includes('## Audit gaps with no home on the page'));
  assert.ok(md.includes('- `review-markup`'));
  assert.ok(md.includes('unfilled authoring skeleton'));
  assert.ok(md.includes('- Validation: 1 error(s)'));
});

test('the mockup profile says why the production-only files are absent', () => {
  assert.ok(report().includes('Re-run with `--profile production --base-url …`'));
});
