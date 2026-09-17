import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAllowedClaims, findClaims, repairNotesFor, validateSiteTree, type SiteValidation } from '../src/site/validate.js';
import { indexCopy } from '../src/site/copy.js';
import { REPO_ROOT, tmpDir } from './helpers.js';
import { fixtureCorpus, fixturePlan, fixtureReport, item, replaceCopy, writeFixtureSite } from './site-helpers.js';
import type { BuildProfile } from '../src/site/types.js';

function run(opts: { profile?: BuildProfile; mutate?: (p: string, html: string) => string; plan?: ReturnType<typeof fixturePlan>; report?: ReturnType<typeof fixtureReport> } = {}): SiteValidation {
  const dir = tmpDir('siteredesign-validate-');
  const plan = opts.plan ?? fixturePlan();
  const site = writeFixtureSite(dir, { profile: opts.profile, plan, mutate: opts.mutate });
  return validateSiteTree({
    siteDir: dir,
    repo: REPO_ROOT,
    slug: 'landscaping',
    profile: opts.profile ?? 'mockup',
    plan,
    copyMap: site.copyMap,
    copyIndex: site.copyIndex,
    report: opts.report ?? fixtureReport([item('tel-link')]),
    installedFonts: [],
    jsonldType: 'LocalBusiness',
  });
}

function errors(v: SiteValidation, gate?: string): string[] {
  return v.findings.filter((f) => f.level === 'error' && (!gate || f.gate === gate)).map((f) => f.message);
}

test('the fixture site passes every gate', () => {
  const v = run();
  assert.deepEqual(errors(v), [], 'a correct site produces no errors');
  assert.equal(v.ok, true);
});

// ---- structure -------------------------------------------------------------------------------

test('an external request is an error in both profiles', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<img src="https://cdn.example.com/x.jpg" alt="x" width="1" height="1"></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('external request')));
});

test('an off-site link is an error, because a generated page links only within itself', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="x"><a href="https://elsewhere.test/">go</a></p></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('off-site link')));
});

test('executable script is rejected', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</body>', '<script>alert(1)</script></body>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('executable <script>')));
});

test('a missing skip link is an error', () => {
  const v = run({ mutate: (_p, h) => h.replace(/<a class="skip-link"[^<]*<\/a>/, '') });
  assert.ok(errors(v, 'structure').some((m) => m.includes('skip link missing')));
});

// ---- SEO -------------------------------------------------------------------------------------

test('titles and descriptions outside the bounds search results render are errors', () => {
  const plan = fixturePlan();
  plan.pages[0].title = 'Too short';
  plan.pages[1].meta_description = 'Short.';
  const v = run({ plan });
  assert.ok(errors(v, 'seo').some((m) => m.includes('<title> is 9 characters')));
  assert.ok(errors(v, 'seo').some((m) => m.includes('meta description is 6 characters')));
});

test('two pages sharing a title or a description is an error', () => {
  const plan = fixturePlan();
  plan.pages[1].title = plan.pages[0].title;
  plan.pages[1].meta_description = plan.pages[0].meta_description;
  const v = run({ plan });
  assert.ok(errors(v, 'seo').some((m) => m.includes('duplicate <title>')));
  assert.ok(errors(v, 'seo').some((m) => m.includes('duplicate meta description')));
});

test('a second h1 and a skipped heading level are both errors', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('<h2 id="faq-h">', '<h1>Extra</h1><h2 id="faq-h">') : h) });
  assert.ok(errors(v, 'seo').some((m) => m.includes('exactly one <h1>')));

  const skipped = run({ mutate: (p, h) => (p === '/' ? h.replace('<h2 id="faq-h">Frequently asked questions</h2>', '<h4 id="faq-h">Frequently asked questions</h4>') : h) });
  assert.ok(errors(skipped, 'seo').some((m) => m.includes('heading level jumps')));
});

test('an image with no alt text or no intrinsic size is an error, because both cost real users', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<img src="assets/img/a.webp" width="10" height="10"><img src="assets/img/b.webp" alt="b"></main>') : h) });
  assert.ok(errors(v, 'seo').some((m) => m.includes('has no alt text')));
  assert.ok(errors(v, 'seo').some((m) => m.includes('no intrinsic width/height')));
});

test('production requires a canonical, a sitemap, robots.txt and llms.txt', () => {
  const v = run({ profile: 'production' });
  const msgs = errors(v, 'seo');
  assert.ok(msgs.some((m) => m.includes('canonical link missing')) === false, 'the head builder emits canonical in production');
  assert.ok(msgs.some((m) => m.includes('sitemap.xml was not written')));
  assert.ok(msgs.some((m) => m.includes('robots.txt was not written')));
  assert.ok(msgs.some((m) => m.includes('llms.txt was not written')));
});

// ---- AEO -------------------------------------------------------------------------------------

test('structured data that disagrees with the rendered FAQ is an error', () => {
  const v = run({
    mutate: (p, h) =>
      p === '/'
        ? h.replace('>When can I reach you?<', '>Something else entirely?<')
        : h,
  });
  assert.ok(errors(v, 'aeo').some((m) => m.includes('is not visible in the rendered page')));
});

test('an FAQ answer that differs between the markup and the structured data is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p003', 'We cover a wide area.') : h) });
  assert.ok(errors(v, 'aeo').some((m) => m.includes('does not match the answer rendered on the page')));
});

test('back-references break a chunk quoted out of context, so they are an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'As mentioned above, we cover the area.') : h) });
  assert.ok(errors(v, 'aeo').some((m) => /as mentioned above/i.test(m)));
});

test('a missing archetype node in the graph is an error', () => {
  const v = run({ mutate: (p, h) => h.replace(/"@type": "LocalBusiness"/, '"@type": "Thing"') });
  assert.ok(errors(v, 'aeo').some((m) => m.includes('no LocalBusiness node')));
});

// ---- fabrication -----------------------------------------------------------------------------

test('claim detection finds numbers, credentials and superlatives but ignores bare ordinals', () => {
  const c = findClaims('Step 1: we are licensed and rated 4.9 by 132 customers — the best in town, from $45.');
  assert.deepEqual(c.numbers, ['4.9', '132', '$45']);
  assert.ok(c.hard.includes('licensed'));
  assert.ok(c.hard.includes('rated'));
  assert.deepEqual(c.soft, ['best']);
  assert.deepEqual(findClaims('Step 1 of 3.').numbers, [], 'single digits are not claims');
});

test('an invented rating is caught', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Our crews hold a 5.0 rating from 900 customers.') : h) });
  const msgs = errors(v, 'fabrication');
  assert.ok(msgs.some((m) => m.includes('"5.0"')), 'the invented rating value is reported');
  assert.ok(msgs.some((m) => m.includes('"900"')), 'the invented review count is reported');
});

test('an invented credential is caught', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Our crews are accredited and award-winning.') : h) });
  const msgs = errors(v, 'fabrication');
  assert.ok(msgs.some((m) => m.includes('accredited')));
  assert.ok(msgs.some((m) => m.includes('award-winning')));
});

test('a credential the source site already states is allowed through', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Every crew is licensed and insured.') : h) });
  assert.ok(!errors(v, 'fabrication').some((m) => m.includes('licensed')));
});

test('rewriting the planned copy is caught by the text hash', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Our crews work across the whole valley.') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('does not match the planned copy')));
});

test('text in <main> with no data-copy-id is untracked and rejected', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p>Slipped in without provenance.</p></main>') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('no data-copy-id')));
});

test('planned copy that never reached the page is reported', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace(/<p data-copy-id="p002">[^<]*<\/p>/, '') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('p002 was never rendered')));
});

test('unsourced copy may make no specific claim at all', () => {
  const plan = fixturePlan();
  plan.pages[0].sections[0].blocks = [{ kind: 'paragraph', text: 'We have served 4,000 gardens.', source: { kind: 'placeholder', page_url: null, quote: null } }];
  const dir = tmpDir('siteredesign-placeholder-');
  const site = writeFixtureSite(dir, { plan, mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'We have served 4,000 gardens.') : h) });
  const v = validateSiteTree({
    siteDir: dir,
    repo: REPO_ROOT,
    slug: 'landscaping',
    profile: 'mockup',
    plan,
    copyMap: site.copyMap,
    copyIndex: site.copyIndex,
    report: fixtureReport([item('tel-link')]),
    installedFonts: [],
    jsonldType: 'LocalBusiness',
  });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('"4,000"') && m.includes('not an extracted fact')));
});

test('the allowed-claim corpus is built from verified quotes and extracted facts only', () => {
  const plan = fixturePlan();
  const index = indexCopy(plan, fixtureCorpus());
  const allowed = buildAllowedClaims(index, fixtureReport());
  assert.ok(allowed.text.includes('licensed and insured'), 'a credential the source states counts even though no paragraph quotes it directly');
  assert.ok(allowed.digits.has('49') && allowed.digits.has('132'), 'the sourced rating contributes its digits');
  assert.ok(allowed.digits.has('2009'));
  assert.ok(allowed.digits.has('84065'), 'facts contribute their digits');
  assert.ok(!allowed.digits.has('900'));
});

// ---- coverage --------------------------------------------------------------------------------

test('an audit gap tagged nowhere in the site is an error', () => {
  const v = run({ report: fixtureReport([item('tel-link'), item('review-markup')]) });
  assert.ok(errors(v, 'coverage').some((m) => m.includes('review-markup')));
  assert.ok(v.coverage.missing.includes('review-markup'));
  assert.ok(v.coverage.tagged.includes('tel-link'));
});

test('a page the plan promised but never wrote is an error', () => {
  const dir = tmpDir('siteredesign-missing-');
  const plan = fixturePlan();
  const site = writeFixtureSite(dir, { plan });
  fs.rmSync(path.join(dir, 'services', 'mowing', 'index.html'));
  const v = validateSiteTree({
    siteDir: dir,
    repo: REPO_ROOT,
    slug: 'landscaping',
    profile: 'mockup',
    plan,
    copyMap: site.copyMap,
    copyIndex: site.copyIndex,
    report: fixtureReport([item('tel-link')]),
    installedFonts: [],
    jsonldType: 'LocalBusiness',
  });
  assert.ok(errors(v, 'structure').some((m) => m.includes('was not written')));
});

test('a claim in a caption or a table cell is caught even though captions are not copy-mapped', () => {
  const v = run({
    mutate: (p, h) =>
      p === '/'
        ? h.replace('</main>', '<figure><figcaption>Rated 4.8 by 500 customers</figcaption></figure><table><tr><td>Bonded and accredited</td></tr></table></main>')
        : h,
  });
  const msgs = errors(v, 'fabrication');
  assert.ok(msgs.some((m) => m.includes('"4.8"')));
  assert.ok(msgs.some((m) => m.includes('"500"')));
  
  assert.ok(msgs.some((m) => /td .*claims "Bonded"/i.test(m)));
  assert.ok(msgs.some((m) => /td .*claims "accredited"/i.test(m)));
});

test('a missing audit tag is attributed to the page that was supposed to carry it', () => {
  const plan = fixturePlan();
  plan.pages[1].sections[0].checklist_ids = ['review-markup'];
  const v = run({ plan, report: fixtureReport([item('tel-link'), item('review-markup')]) });
  const finding = v.findings.find((f) => f.gate === 'coverage' && f.message.includes('review-markup'));
  assert.equal(finding?.page, '/services/mowing/', 'the repair pass needs to know which page to re-render');
});

test('repair notes exclude findings a re-render cannot fix', () => {
  const plan = fixturePlan();
  plan.pages[0].title = 'Too short';
  const v = run({ plan });
  assert.ok(errors(v, 'seo').some((m) => m.includes('<title> is 9 characters')));
  assert.ok(!repairNotesFor(v, '/').some((m) => m.includes('<title> is 9 characters')), 'a bad title comes from the copy pass, not the markup');
});

test('unsourced copy may repeat an extracted fact, since a fact is not a fabrication', () => {
  const plan = fixturePlan();
  plan.pages[0].sections[0].blocks = [{ kind: 'paragraph', text: 'Call 801-555-0100 to get started.', source: { kind: 'placeholder', page_url: null, quote: null } }];
  const dir = tmpDir('siteredesign-factph-');
  const site = writeFixtureSite(dir, { plan, mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Call 801-555-0100 to get started.') : h) });
  const v = validateSiteTree({
    siteDir: dir,
    repo: REPO_ROOT,
    slug: 'landscaping',
    profile: 'mockup',
    plan,
    copyMap: site.copyMap,
    copyIndex: site.copyIndex,
    report: fixtureReport([item('tel-link')]),
    installedFonts: [],
    jsonldType: 'LocalBusiness',
  });
  assert.deepEqual(errors(v, 'fabrication'), [], 'the phone number is in report.facts');
});

test('the same planned block rendered twice is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="p002">Our crews work across Riverton and Draper.</p></main>') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('rendered more than once')));
});

test('the build renders the FAQ, so it always mirrors the structured data', () => {
  const dir = tmpDir('siteredesign-faq-');
  const plan = fixturePlan();
  writeFixtureSite(dir, { plan });
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('<h3 class="faq-q" id="faq-1">When can I reach you?</h3>'));
  assert.ok(html.includes('data-checklist="faq-present"'));
  assert.ok(html.includes('class="related"'), 'internal links are emitted by the build too');
  assert.ok(html.includes('<li><a href="services/mowing/index.html">Weekly mowing</a></li>'));
});

test('a link to a page that was never written is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="x"><a href="services/index.html">Services</a></p></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('dead link: services/index.html')));
});

test('a link to an image that was never written is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<img src="assets/img/nope.webp" alt="x" width="1" height="1"></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('dead link: assets/img/nope.webp')));
});

test('the fixture site has no dead links', () => {
  assert.ok(!errors(run(), 'structure').some((m) => m.includes('dead link')));
});
