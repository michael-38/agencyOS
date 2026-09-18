import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAllowedClaims, findClaims, validateSiteTree, type SiteValidation } from '../src/site/validate.js';
import { indexFilledCopy } from '../src/site/copy.js';
import { REPO_ROOT, tmpDir } from './helpers.js';
import { fixturePack, fixtureReport, item, replaceCopy, writeFixtureSite } from './site-helpers.js';
import type { BuildProfile } from '../src/site/types.js';

interface RunOpts {
  profile?: BuildProfile;
  mutate?: (p: string, html: string) => string;
  pack?: ReturnType<typeof fixturePack>;
  report?: ReturnType<typeof fixtureReport>;
  residue?: { mockTokens: string[]; demoLexicon: string[] } | null;
  allowedLinkHosts?: string[];
  templateCoveredIds?: string[] | null;
}

function run(opts: RunOpts = {}): SiteValidation {
  const dir = tmpDir('sitefill-validate-');
  const pack = opts.pack ?? fixturePack();
  const site = writeFixtureSite(dir, { profile: opts.profile, pack, mutate: opts.mutate });
  return validateSiteTree({
    siteDir: dir,
    repo: REPO_ROOT,
    slug: 'landscaping',
    profile: opts.profile ?? 'mockup',
    page: { path: '/', title: pack.title, meta_description: pack.meta_description },
    copyMap: site.copyMap,
    copyIndex: site.copyIndex,
    report: opts.report ?? fixtureReport([item('tel-link')]),
    installedFonts: [],
    jsonldType: 'LocalBusiness',
    templateCoveredIds: opts.templateCoveredIds ?? null,
    residue: opts.residue ?? null,
    allowedLinkHosts: opts.allowedLinkHosts,
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

test('a title or description outside the bounds search results render is an error', () => {
  // patchHead clamps the long end, so a build cannot overrun; a value too SHORT still has to fail,
  // because that is the one the model can produce and code cannot pad.
  const short = run({ mutate: (p, h) => h.replace(/<title>[^<]*<\/title>/, '<title>Too short</title>') });
  assert.ok(errors(short, 'seo').some((m) => m.includes('<title> is 9 characters')));
  const thin = run({ mutate: (p, h) => h.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Short.">') });
  assert.ok(errors(thin, 'seo').some((m) => m.includes('meta description is 6 characters')));
});


test('a second h1 and a skipped heading level are both errors', () => {
  const v = run({ mutate: (p, h) => h.replace('<section class="section" id="faq"', '<h1>Extra</h1><section class="section" id="faq"') });
  assert.ok(errors(v, 'seo').some((m) => m.includes('exactly one <h1>')));

  // An h4 immediately after the h1, so the outline jumps two levels.
  const skipped = run({ mutate: (p, h) => h.replace('</h1>', '</h1><h4>Jumped</h4>') });
  assert.ok(errors(skipped, 'seo').some((m) => m.includes('heading level jumps')), errors(skipped, 'seo').join(' | '));
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
  // The question in the markup is changed after the JSON-LD was built from it, so the two disagree.
  // A build cannot reach this state — the graph is derived from the rendered questions — which is
  // the point: the gate still catches it if anything ever edits one half.
  const v = run({ mutate: (p, h) => h.replace('>Do you work in my town?<', '>Something else entirely?<') });
  assert.ok(errors(v, 'aeo').some((m) => m.includes('is not visible in the rendered page')), errors(v, 'aeo').join(' | '));
});

test('an FAQ answer that differs between the markup and the structured data is an error', () => {
  const v = run({ mutate: (p, h) => replaceCopy(h, 'p015', 'We cover a wide area.') });
  assert.ok(errors(v, 'aeo').some((m) => m.includes('does not match the answer rendered on the page')), errors(v, 'aeo').join(' | '));
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
  // The claim has to arrive with the quote that supports it, which is how a real build states one:
  // CORPUS_TEXT says "We are licensed and insured for every job we take on."
  const pack = fixturePack();
  const lede = pack.slots.find((sl) => sl.slot === 'hero.lede')!;
  lede.text = 'Every crew is licensed and insured.';
  lede.source_quote = 'We are licensed and insured for every job we take on.';
  const v = run({ pack });
  assert.ok(!errors(v, 'fabrication').some((m) => m.includes('licensed')), errors(v, 'fabrication').join(' | '));

  // The same sentence with no quote behind it is a fabrication.
  const bare = fixturePack();
  const bareLede = bare.slots.find((sl) => sl.slot === 'hero.lede')!;
  bareLede.text = 'Every crew is licensed and insured.';
  bareLede.source_kind = 'placeholder';
  bareLede.source_page_url = null;
  bareLede.source_quote = null;
  assert.ok(errors(run({ pack: bare }), 'fabrication').some((m) => m.includes('licensed')));
});

test('rewriting the planned copy is caught by the text hash', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? replaceCopy(h, 'p002', 'Our crews work across the whole valley.') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('does not match the planned copy')));
});

test('text in <main> with no data-copy-id is untracked and rejected', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p>Slipped in without provenance.</p></main>') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('no data-copy-id')));
});

test('copy the fill wrote but the page does not carry is reported', () => {
  const v = run({ mutate: (p, h) => h.replace(/<p [^>]*data-copy-id="p006"[^>]*>[^<]*<\/p>/, '') });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('p006 was never rendered')), errors(v, 'fabrication').join(' | '));
});

test('unsourced copy may make no specific claim at all', () => {
  const pack = fixturePack();
  const lede = pack.slots.find((sl) => sl.slot === 'hero.lede')!;
  lede.source_kind = 'placeholder';
  lede.source_page_url = null;
  lede.source_quote = null;
  lede.text = 'We have served 4,000 gardens.';
  const v = run({ pack });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('"4,000"') && m.includes('not an extracted fact')));
});

test('the allowed-claim corpus is built from verified quotes and extracted facts only', () => {
  const dir = tmpDir('sitefill-claims-');
  const site = writeFixtureSite(dir);
  const allowed = buildAllowedClaims(site.copyIndex, fixtureReport());
  assert.ok(allowed.digits.has('2009'), 'a quote the fill verified contributes its digits');
  assert.ok(allowed.digits.has('45'), 'so does the sourced price');
  assert.ok(allowed.digits.has('84065'), 'facts contribute their digits');
  assert.ok(allowed.factDigits.has('84065'), 'and appear in the stricter fact-only set');
  assert.ok(!allowed.digits.has('900'), 'a number the source never states is not allowed');
  // An unverifiable quote earns nothing.
  const bad = fixturePack();
  bad.slots.find((sl) => sl.slot === 'hero.lede')!.source_quote = 'Nowhere in the source at all.';
  const dir2 = tmpDir('sitefill-claims2-');
  const site2 = writeFixtureSite(dir2, { pack: bad });
  assert.ok(site2.copyIndex.issues.some((m) => /quote not found/.test(m)));
});

// ---- coverage --------------------------------------------------------------------------------

test('an audit gap tagged nowhere in the site is an error', () => {
  const v = run({ report: fixtureReport([item('tel-link'), item('review-markup')]) });
  assert.ok(errors(v, 'coverage').some((m) => m.includes('review-markup')));
  assert.ok(v.coverage.missing.includes('review-markup'));
  assert.ok(v.coverage.tagged.includes('tel-link'));
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



test('unsourced copy may repeat an extracted fact, since a fact is not a fabrication', () => {
  const pack = fixturePack();
  const lede = pack.slots.find((sl) => sl.slot === 'hero.lede')!;
  lede.source_kind = 'placeholder';
  lede.source_page_url = null;
  lede.source_quote = null;
  lede.text = 'Call 801-555-0100 to get started.';
  const v = run({ pack });
  assert.deepEqual(errors(v, 'fabrication'), [], 'the phone number is in report.facts');
});

test('the same planned block rendered twice is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="p002">Our crews work across Riverton and Draper.</p></main>') : h) });
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('rendered more than once')));
});



test('a link to an image that was never written is an error', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<img src="assets/img/nope.webp" alt="x" width="1" height="1"></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('dead link: assets/img/nope.webp')));
});

test('the fixture site has no dead links', () => {
  assert.ok(!errors(run(), 'structure').some((m) => m.includes('dead link')));
});

// ---- residue ---------------------------------------------------------------------------------

test("the template's mock business must not survive the fill", () => {
  const residue = { mockTokens: ['Hollow Creek Landscape Co.', 'C-48219'], demoLexicon: ['Hollow Creek has been installing hardscape since 2009.'] };

  // A page that never mentions the mock is silent on this gate.
  assert.deepEqual(errors(run({ residue }), 'residue'), []);

  // An identity string in rendered text.
  const named = run({ residue, mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="zz">Call Hollow Creek Landscape Co. today.</p></main>') : h) });
  assert.ok(errors(named, 'residue').some((m) => m.includes('Hollow Creek Landscape Co.')));

  // An identity string hiding in an attribute a reader sees.
  const inAttr = run({ residue, mutate: (p, h) => (p === '/' ? h.replace('</main>', '<img src="a.webp" alt="C-48219" width="1" height="1"></main>') : h) });
  assert.ok(errors(inAttr, 'residue').some((m) => m.includes('C-48219')));

  // Demo prose rendered verbatim.
  const prose = run({ residue, mutate: (p, h) => (p === '/' ? h.replace('</main>', '<p data-copy-id="zz">Hollow Creek has been installing hardscape since 2009.</p></main>') : h) });
  assert.ok(errors(prose, 'residue').some((m) => m.includes('template demo copy was rendered verbatim')));

  // The stylesheet is not the mock business, and neither is the build's own JSON-LD.
  const inStyle = run({ residue, mutate: (p, h) => (p === '/' ? h.replace('</head>', '<style>/* C-48219 */</style></head>') : h) });
  assert.deepEqual(errors(inStyle, 'residue'), [], 'a token inside <style> is not rendered text');
});

// ---- off-site links --------------------------------------------------------------------------

test('an off-site link is allowed only to a host the audited site itself links to', () => {
  const link = (href: string) => (p: string, h: string) => (p === '/' ? h.replace('</main>', `<a href="${href}">Book</a></main>`) : h);

  const allowed = run({ allowedLinkHosts: ['booking.joinblvd.com'], mutate: link('https://booking.joinblvd.com/verdant') });
  assert.deepEqual(errors(allowed, 'structure'), [], 'a real booking system the source linked to survives');

  const invented = run({ allowedLinkHosts: ['booking.joinblvd.com'], mutate: link('https://evil.example/pay') });
  assert.ok(errors(invented, 'structure').some((m) => m.includes('evil.example is not a host the audited site links to')));

  // www. is not a different host.
  const withWww = run({ allowedLinkHosts: ['joinblvd.com'], mutate: link('https://www.joinblvd.com/x') });
  assert.deepEqual(errors(withWww, 'structure'), []);

  // With no allowlist at all, every off-site link is an error, as before.
  assert.ok(errors(run({ mutate: link('https://anything.example/') }), 'structure').length > 0);
});

test('an anchor pointing at no element is a dead link, because omitting a section can orphan one', () => {
  const v = run({ mutate: (p, h) => (p === '/' ? h.replace('</main>', '<a href="#gone">Jump</a></main>') : h) });
  assert.ok(errors(v, 'structure').some((m) => m.includes('dead anchor: <a href="#gone">')));
  // The fixture's own in-page anchors must not trip it.
  assert.deepEqual(errors(run(), 'structure'), []);
});

// ---- coverage tiers --------------------------------------------------------------------------

test('an audit gap the template cannot carry is a warning; one it can carry and dropped is an error', () => {
  // The fixture tags tel-link from the plan and faq-present from the build's own FAQ block, so
  // live-chat and review-markup are the untagged gaps.
  const report = fixtureReport([item('tel-link'), item('live-chat'), item('review-markup')]);

  // With no template declared, every untagged gap is a build failure, as before.
  const strict = run({ report });
  assert.equal(errors(strict, 'coverage').filter((m) => m.includes('live-chat')).length, 1);
  assert.equal(errors(strict, 'coverage').filter((m) => m.includes('review-markup')).length, 1);

  // Declaring what the template can carry splits them. review-markup is inside its remit, so the
  // built page dropping it is still a real bug; live-chat needs a third-party chat script no
  // template ships, so it is reported rather than failing the build.
  const tiered = run({ report, templateCoveredIds: ['tel-link', 'review-markup'] });
  assert.deepEqual(errors(tiered, 'coverage').filter((m) => m.includes('live-chat')), []);
  assert.deepEqual(tiered.coverage.uncoverable, ['live-chat']);
  assert.ok(
    tiered.findings.some((f) => f.gate === 'coverage' && f.level === 'warning' && /live-chat.*outside what this template can carry/.test(f.message)),
  );
  assert.ok(errors(tiered, 'coverage').some((m) => m.includes('review-markup')));
  assert.deepEqual(tiered.coverage.missing, ['review-markup']);
});

test('template boilerplate is held to the same fact-only standard as placeholder copy', () => {
  const v = run({
    mutate: (p, h) =>
      p === '/' ? h.replace('</main>', '<p data-copy-id="tpl">Fully licensed, with 25 years behind us.</p></main>') : h,
  });
  // The block is not in copy_map.json at all, which is itself the error the gate reports first.
  assert.ok(errors(v, 'fabrication').some((m) => m.includes('not in copy_map.json')));
});
