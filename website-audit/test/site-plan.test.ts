import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToWords, normalizeArchitecture, normalizePlan } from '../src/site/plan.js';
import { buildCopyMap, indexCopy, normalizeForMatch } from '../src/site/copy.js';
import { toSitePlan } from '../src/site/types.js';
import { fixtureArchitecture, fixtureContent, fixtureCorpus, fixturePlan, fixtureReport, item, SOURCE_URL } from './site-helpers.js';
import type { PageContent } from '../src/site/types.js';

function stitched(over: Partial<ReturnType<typeof fixtureArchitecture>> = {}, contents?: Map<string, PageContent>) {
  const arch = { ...fixtureArchitecture(), ...over };
  const map =
    contents ??
    new Map<string, PageContent>([
      ['/', fixtureContent('overview', 'Example Yard Co has kept gardens tidy in Riverton since 2009.', 'Example Yard Co has kept gardens tidy in Riverton since 2009.')],
      ['/services/mowing/', fixtureContent('mowing', 'Weekly mowing starts at $45 per visit.', 'Weekly mowing starts at $45 per visit.')],
    ]);
  return toSitePlan(arch, map);
}

// ---- pass 1: architecture --------------------------------------------------------------------

test('a clean architecture survives normalization unchanged', () => {
  const { arch, adjustments } = normalizeArchitecture(fixtureArchitecture(), fixtureReport([item('tel-link')]), 12);
  assert.equal(arch.pages.length, 2);
  assert.deepEqual(adjustments, []);
});

test('unsafe, duplicate, and over-budget pages are dropped and reported', () => {
  const base = fixtureArchitecture();
  const raw = {
    ...base,
    pages: [base.pages[0], { ...base.pages[1], path: '/../etc/passwd/' }, { ...base.pages[1] }, { ...base.pages[1] }, { ...base.pages[1], path: '/areas/riverton/' }],
  };
  const { arch, adjustments } = normalizeArchitecture(raw, fixtureReport(), 2);
  assert.deepEqual(arch.pages.map((p) => p.path), ['/', '/services/mowing/']);
  assert.ok(adjustments.some((a) => a.includes('unusable path')));
  assert.ok(adjustments.some((a) => a.includes('duplicate')));
  assert.ok(adjustments.some((a) => a.includes('budget')));
});

test('checklist ids the audit never produced are dropped', () => {
  const base = fixtureArchitecture();
  base.pages[0].sections[0].checklist_ids = ['tel-link', 'invented-id'];
  const { arch, adjustments } = normalizeArchitecture(base, fixtureReport([item('tel-link')]), 12);
  assert.deepEqual(arch.pages[0].sections[0].checklist_ids, ['tel-link']);
  assert.ok(adjustments.some((a) => a.includes('invented-id')));
});

test('audit gaps the architecture forgot are attached to the home page rather than lost', () => {
  const report = fixtureReport([item('tel-link'), item('faq-present'), item('contact-form', { verdict: 'partial' })]);
  const { arch, adjustments } = normalizeArchitecture(fixtureArchitecture(), report, 12);
  const claimed = arch.pages.flatMap((p) => p.sections.flatMap((s) => s.checklist_ids));
  assert.ok(claimed.includes('faq-present'));
  assert.ok(claimed.includes('contact-form'));
  assert.ok(adjustments.some((a) => a.includes('unassigned')));
});

test('an architecture with no home page promotes its first page instead of failing', () => {
  const base = fixtureArchitecture();
  const { arch, adjustments } = normalizeArchitecture({ ...base, pages: [base.pages[1]] }, fixtureReport(), 12);
  assert.equal(arch.pages[0].path, '/');
  assert.equal(arch.pages[0].kind, 'home');
  assert.deepEqual(arch.pages[0].breadcrumb, []);
  assert.ok(adjustments.some((a) => a.includes('promoted')));
});

test('internal links pointing at pages that were not generated are dropped', () => {
  const base = fixtureArchitecture();
  base.internal_links = [
    { from_path: '/', to_path: '/services/mowing/', anchor_text: 'Weekly mowing' },
    { from_path: '/', to_path: '/never/generated/', anchor_text: 'Nope' },
  ];
  const { arch, adjustments } = normalizeArchitecture(base, fixtureReport(), 12);
  assert.equal(arch.internal_links.length, 1);
  assert.ok(adjustments.some((a) => a.includes('internal link')));
});

// ---- stitching -------------------------------------------------------------------------------

test('the architecture pass and the copy pass stitch into one plan', () => {
  const plan = stitched();
  assert.equal(plan.pages.length, 2);
  assert.equal(plan.pages[0].sections[0].h2, 'What we do');
  assert.equal(plan.pages[0].sections[0].image_slot, 'none');
  assert.deepEqual(plan.pages[0].sections[0].checklist_ids, ['tel-link']);
  assert.deepEqual(plan.pages[0].sections[0].cta, { label: 'Call us', kind: 'tel', target: '801-555-0100' });
  assert.equal(plan.entities.rating?.value, '4.9');
  assert.equal(plan.entities.credentials[0].source.kind, 'source');
});

test('a rating with no quote behind it never becomes a sourced entity', () => {
  const plan = stitched({ rating_quote: null, rating_page_url: null });
  assert.equal(plan.entities.rating?.source.kind, 'placeholder');
});

test('a rating missing its count is dropped entirely', () => {
  const plan = stitched({ rating_count: null });
  assert.equal(plan.entities.rating, null);
});

// ---- pass 2: copy ----------------------------------------------------------------------------

test('FAQ headings are forced into question form', () => {
  const contents = new Map<string, PageContent>([
    ['/', fixtureContent('overview', 'We keep gardens tidy.', null, [], [{ q: 'Where do you work', a: 'Riverton and Draper.', quote: null }])],
    ['/services/mowing/', fixtureContent('mowing', 'Weekly mowing starts at $45 per visit.', 'Weekly mowing starts at $45 per visit.')],
  ]);
  const { plan, adjustments } = normalizePlan(stitched({}, contents));
  assert.equal(plan.pages[0].faq[0].q, 'Where do you work?');
  assert.ok(adjustments.some((a) => a.includes('question mark')));
});

test('a page the copy pass returned nothing for is dropped, not shipped empty', () => {
  const contents = new Map<string, PageContent>([
    ['/', fixtureContent('overview', 'We keep gardens tidy.', null)],
  ]);
  const { plan, adjustments } = normalizePlan(stitched({}, contents));
  assert.deepEqual(plan.pages.map((p) => p.path), ['/']);
  assert.equal(plan.internal_links.length, 0, 'links into the dropped page go with it');
  assert.ok(adjustments.some((a) => a.includes('has no copy')));
});

// ---- provenance ------------------------------------------------------------------------------

test('a quote that is not in the scraped source loses its credit and becomes a placeholder', () => {
  const contents = new Map<string, PageContent>([
    ['/', fixtureContent('overview', 'We have won nine awards.', 'We have won nine awards for our work.')],
    ['/services/mowing/', fixtureContent('mowing', 'Weekly mowing starts at $45 per visit.', 'Weekly mowing starts at $45 per visit.')],
  ]);
  const index = indexCopy(stitched({}, contents), fixtureCorpus());
  const map = buildCopyMap(index);
  assert.ok(index.issues.some((i) => i.includes('quote not found')));
  assert.equal(map.paragraphs[0].source, 'placeholder');
  assert.ok(map.placeholder_ratio > 0);
});

test('a quote found on a different page than claimed is still credited, and the correction is reported', () => {
  const plan = fixturePlan();
  plan.pages[0].sections[0].blocks = [
    { kind: 'paragraph', text: 'We are licensed and insured.', source: { kind: 'source', page_url: 'https://example.test/about', quote: 'We are licensed and insured for every job we take on.' } },
  ];
  const index = indexCopy(plan, fixtureCorpus());
  const slot = index.slots.find((s) => s.text === 'We are licensed and insured.')!;
  assert.equal(slot.verified, true);
  assert.equal(slot.correctedUrl, SOURCE_URL);
  assert.ok(index.issues.some((i) => i.includes('was actually found on')));
});

test('entity quotes are verified too, and an unverifiable one is reported', () => {
  const plan = fixturePlan();
  plan.entities.credentials = [{ name: 'Bonded', detail: '', source: { kind: 'source', page_url: SOURCE_URL, quote: 'We are bonded in every state.' } }];
  const index = indexCopy(plan, fixtureCorpus());
  assert.ok(index.issues.some((i) => i.includes('credential "Bonded"')));
  assert.ok(!index.entityQuotes.includes('We are bonded in every state.'));
});

test('quote matching tolerates markdown, curly quotes, and whitespace but not different words', () => {
  assert.equal(normalizeForMatch('**We’re  open**'), "we're open");
  assert.equal(normalizeForMatch('We are\nopen'), 'we are open');
  assert.notEqual(normalizeForMatch('we are open'), normalizeForMatch('we are closed'));
});

test('a summary long enough to be a paragraph is clamped at a word boundary', () => {
  const long = 'Olympus keeps gardens tidy in St. George and Riverton. ' + 'It also does a great many other things worth describing at length. '.repeat(6);
  const { plan, adjustments } = normalizePlan({ ...stitched(), site_summary: long });
  assert.ok(plan.site_summary.length <= 280);
  assert.ok(plan.site_summary.startsWith('Olympus keeps gardens tidy in St. George and Riverton.'), 'an abbreviation is not a sentence break');
  assert.ok(plan.site_summary.endsWith('…'));
  assert.ok(!/\s…$/.test(plan.site_summary), 'no dangling space before the ellipsis');
  assert.ok(adjustments.some((a) => a.includes('rendered as a one-line description')));
});

test('a long summary with no sentence break is truncated rather than dropped', () => {
  const { plan } = normalizePlan({ ...stitched(), site_summary: 'a'.repeat(400) });
  assert.equal(plan.site_summary.length, 280);
  assert.ok(plan.site_summary.endsWith('…'));
});

test('the same observation from several page passes is reported once', () => {
  const { plan } = normalizePlan({ ...stitched(), notes: ['No prices on the source.', 'no prices on the source.', 'No crew photo.', '  '] });
  assert.deepEqual(plan.notes, ['No prices on the source.', 'No crew photo.']);
});

test('a breadcrumb is forced to one crumb per path segment', () => {
  const norm = (path: string, crumbs: string[]) => {
    const base = fixtureArchitecture();
    const { arch } = normalizeArchitecture({ ...base, pages: [base.pages[0], { ...base.pages[1], path, breadcrumb: crumbs }] }, fixtureReport(), 12);
    return arch.pages.find((p) => p.path === path)!.breadcrumb;
  };
  // The renderer prepends Home itself, so a model that includes it produces a doubled trail.
  assert.deepEqual(norm('/faq/', ['Home', 'FAQ']), ['FAQ']);
  assert.deepEqual(norm('/services/mowing/', ['Services', 'Mowing']), ['Services', 'Mowing']);
  assert.deepEqual(norm('/services/mowing/', ['Home', 'Mowing']), ['Services', 'Mowing'], 'a Home crumb is dropped, and the level it displaced comes from the path');
  assert.deepEqual(norm('/services/mowing/', ['Mowing']), ['Services', 'Mowing'], 'a missing crumb is filled from the path');
  assert.deepEqual(norm('/services/mowing/', []), ['Services', 'Mowing']);
});

test('a breadcrumb that did not match its path is reported, not silently corrected', () => {
  const base = fixtureArchitecture();
  const { adjustments } = normalizeArchitecture({ ...base, pages: [base.pages[0], { ...base.pages[1], path: '/faq/', breadcrumb: ['Home', 'FAQ'] }] }, fixtureReport(), 12);
  assert.ok(adjustments.some((a) => a.includes("did not match the path's depth")));
});

test('a section that claims an id the build itself emits is renamed', () => {
  const base = fixtureArchitecture();
  base.pages[0].sections = [{ id: 'faq', h2: 'Questions', intent: 'x', image_slot: 'none', checklist_ids: [] }];
  const { arch, adjustments } = normalizeArchitecture(base, fixtureReport(), 12);
  assert.equal(arch.pages[0].sections[0].id, 'faq-section');
  assert.ok(adjustments.some((a) => a.includes('reserved by the build')));
});

test('a title or description the copy pass made too long is cut, since the markup stage cannot fix the head', () => {
  const base = fixtureArchitecture();
  base.pages[0].title = 'Example Yard Co — garden care, paver patios, retaining walls and weekly mowing across the whole of Riverton and Draper';
  base.pages[0].meta_description = 'x'.repeat(400);
  const { arch, adjustments } = normalizeArchitecture(base, fixtureReport(), 12);
  assert.ok(arch.pages[0].title.length <= 70 && arch.pages[0].title.endsWith('…'));
  assert.ok(!arch.pages[0].title.includes('  '));
  assert.equal(arch.pages[0].meta_description.length, 170);
  assert.ok(adjustments.some((a) => a.includes('<title> was 118 characters')));
  assert.ok(adjustments.some((a) => a.includes('meta description was 400 characters')));
});

test('clampToWords cuts at a word boundary, or mid-word when there is no usable one', () => {
  assert.equal(clampToWords('one two three four', 12), 'one two…');
  assert.equal(clampToWords('short', 40), 'short');
  assert.equal(clampToWords('a'.repeat(50), 10), `${'a'.repeat(9)}…`);
});
