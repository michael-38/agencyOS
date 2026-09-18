import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenSeoPlan, keywordSeeds, localityOf } from '../src/openseo/plan.js';
import { defaultModules } from '../src/modules.js';
import type { Facts } from '../src/checks/facts.js';

const facts: Facts = {
  business_name: 'Cascade Lawn & Landscape',
  phones: ['+1-801-555-0100'],
  emails: [],
  address: { addressLocality: 'Provo', addressRegion: 'UT', postalCode: '84601' },
  hours: null,
  services: ['Lawn care', 'Sprinkler repair', 'Landscape design'],
  sources: {},
};

const base = { homeUrl: 'https://cascadelawn.com/', industrySlug: 'landscaping', facts };

test('no OpenSEO module on = no plan at all', () => {
  assert.equal(buildOpenSeoPlan({ ...base, modules: defaultModules() }), null);
});

test('locality comes from JSON-LD or a free-text address line', () => {
  assert.equal(localityOf({ addressLocality: 'Provo', addressRegion: 'UT' }), 'Provo, UT');
  assert.equal(localityOf('123 Main St, Provo, UT 84601'), 'Provo, UT');
  assert.equal(localityOf('Provo'), null);
  assert.equal(localityOf(null), null);
});

test('keyword seeds are the audited services localised, with an industry fallback', () => {
  assert.deepEqual(keywordSeeds(facts, 'landscaping', 'Provo, UT'), ['Lawn care Provo', 'Sprinkler repair Provo', 'Landscape design Provo']);
  assert.deepEqual(keywordSeeds({ ...facts, services: [] }, 'med-spa', 'Provo, UT'), ['med spa Provo']);
  assert.deepEqual(keywordSeeds(null, 'roofing', null), ['roofing']);
});

test('plan splits free from DataForSEO-billed and pre-fills args from the audit', () => {
  const modules = { ...defaultModules(), 'openseo-crawl': true, 'openseo-local-grid': true, 'openseo-backlinks': true };
  const plan = buildOpenSeoPlan({ ...base, modules })!;

  assert.deepEqual(plan.free, ['openseo-crawl']);
  assert.deepEqual(plan.dataforseo, ['openseo-backlinks', 'openseo-local-grid']);
  assert.equal(plan.status, 'not-run');
  assert.equal(plan.executed_by, 'agent');
  assert.equal(plan.target.domain, 'cascadelawn.com');
  assert.equal(plan.target.locality, 'Provo, UT');
  assert.equal(plan.target.business_name, 'Cascade Lawn & Landscape');

  const grid = plan.requests.find((r) => r.module === 'openseo-local-grid')!;
  assert.equal(grid.billing, 'dataforseo');
  assert.deepEqual(grid.tools, ['get_local_rank_grid']);
  assert.equal(grid.args.businessName, 'Cascade Lawn & Landscape');
  assert.equal(grid.args.locality, 'Provo, UT');
  assert.match(grid.note, /Confirm the estimate/);

  const crawl = plan.requests.find((r) => r.module === 'openseo-crawl')!;
  assert.equal(crawl.billing, 'openseo');
  assert.equal(crawl.args.url, 'https://cascadelawn.com/');
  // Lighthouse is off, so the crawl must not silently opt into the billed sample.
  assert.equal(crawl.args.runLighthouse, false);
  assert.match(crawl.note, /No DataForSEO spend/);
});

test('enabling the Lighthouse module flips the crawl request to run it', () => {
  const modules = { ...defaultModules(), 'openseo-crawl': true, 'openseo-lighthouse': true };
  const plan = buildOpenSeoPlan({ ...base, modules })!;
  assert.equal(plan.requests.find((r) => r.module === 'openseo-crawl')!.args.runLighthouse, true);
});

test('missing facts degrade to a flagged request rather than a fabricated business', () => {
  const modules = { ...defaultModules(), 'openseo-reviews': true };
  const plan = buildOpenSeoPlan({ ...base, facts: null, modules })!;
  const req = plan.requests[0]!;
  assert.equal(req.args.businessName, null);
  assert.match(String(req.args.note), /confirm with the client/);
  assert.deepEqual(plan.keyword_seeds, ['landscaping']);
});
