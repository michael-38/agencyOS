// The fill is the only thing that writes the page, so these tests are the page's contract.
//
// The load-bearing one is the last: fill the real landscaping template with a fixture pack and
// assert that no part of the mock business survives. Everything else in this file exists to make
// that assertion mean something.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadHtml } from '../src/checks/html.js';
import { loadIndustries } from '../src/personas/load.js';
import { readTemplate, type TemplateManifest } from '../src/site/template.js';
import { FillError, NOTICE_TEXT, fill } from '../src/site/fill.js';
import type { ContentPack, SlotValue } from '../src/site/content.js';
import type { Facts } from '../src/checks/facts.js';
import { REPO_ROOT } from './helpers.js';

const FACTS: Facts = {
  business_name: 'Verdant Grounds',
  phones: ['(503) 555-0142'],
  emails: ['office@verdantgrounds.example'],
  address: '77 Alder Street, Hillsboro, OR 97123',
  hours: 'Mon-Fri 8:00 am-4:00 pm',
  services: ['Patios', 'Drainage'],
  sources: {},
};

const sourced = (slot: string, text: string): SlotValue => ({
  slot,
  text,
  source_kind: 'source',
  source_page_url: 'https://verdantgrounds.example/',
  source_quote: `${text} — stated on the source page.`,
});
const placeholder = (slot: string, text: string): SlotValue => ({ slot, text, source_kind: 'placeholder', source_page_url: null, source_quote: null });

const pack = (slots: SlotValue[], over: Partial<ContentPack> = {}): ContentPack => ({
  business_name: 'Verdant Grounds',
  title: 'Verdant Grounds — patios and drainage in Hillsboro, Oregon',
  meta_description: 'Verdant Grounds designs and builds patios, retaining walls and drainage in Hillsboro and Beaverton, Oregon.',
  site_summary: 'Landscape construction in Hillsboro, Oregon.',
  slots,
  services: [],
  areas: [],
  credentials: [],
  price_statements: [],
  rating_value: null,
  rating_count: null,
  rating_page_url: null,
  rating_quote: null,
  omit_sections: [],
  notes: [],
  ...over,
});

let n = 0;
function template(body: string, htmlAttrs = '') {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fill-')), `t${n++}.html`);
  fs.writeFileSync(
    file,
    `<!doctype html>\n<html lang="en"${htmlAttrs}>\n<head><meta charset="utf-8"><title>T</title><style>:root{--brand-accent:#0a0;--brand-accent-dark:#060;}a{color:var(--brand-accent-dark)}</style></head>\n` +
      `<body><header><nav><a class="skip-link" href="#main">Skip</a></nav></header><main id="main">${body}</main><footer><nav><a href="#main">Top</a></nav></footer></body>\n</html>\n`,
  );
  return { file, manifest: readTemplate(file, 'landscaping', 'test.html'), html: fs.readFileSync(file, 'utf8') };
}

const run = (t: { manifest: TemplateManifest; html: string }, p: ContentPack, facts: Facts | null = FACTS) =>
  fill({ manifest: t.manifest, templateHtml: t.html, pack: p, facts });

const SECTION = (inner: string, attrs = '') => `<section id="s1"${attrs}><h2>H</h2>${inner}</section>`;
const I = 'data-slot-intent';

// ---- slots -------------------------------------------------------------------------------------

test('a text slot is written, clamped to its budget, and gets a copy id', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" data-slot-max="20" ${I}="x">demo text here</p>`));
  const r = run(t, pack([sourced('a.b', 'a value far longer than twenty characters')]));
  const $ = loadHtml(r.html);
  assert.equal($('p').text(), 'a value far longer');
  assert.equal($('p').attr('data-copy-id'), 'p001');
  assert.equal(r.copy.length, 1);
  assert.equal(r.copy[0].source.kind, 'source');
  assert.equal(r.placeholderCount, 0);
});

test('an attribute slot sets the attribute and is not copy, because it carries no sentence', () => {
  const t = template(SECTION(`<a data-slot-href="b.url" data-slot-kind="url" ${I}="x" href="https://demo.example/">Book</a>`));
  const r = run(t, pack([sourced('b.url', 'https://verdantgrounds.example/book')]));
  assert.equal(loadHtml(r.html)('a[href="https://verdantgrounds.example/book"]').length, 1);
  assert.equal(r.copy.length, 0);
});

test('placeholder copy is marked and brings the non-dismissible notice with it', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  const r = run(t, pack([placeholder('a.b', 'A claim-free sentence about the work.')]));
  const $ = loadHtml(r.html);
  assert.equal($('[data-copy="placeholder"]').length, 1);
  assert.equal(r.placeholderCount, 1);
  const notice = $('body').children().first();
  assert.ok(notice.is('[data-placeholder-notice]'), 'the notice is the first child of <body>');
  assert.equal(notice.text(), NOTICE_TEXT);
  assert.equal(notice.find('button').length, 0);
});

test('no placeholder means no notice', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  const r = run(t, pack([sourced('a.b', 'Every word of this is sourced.')]));
  assert.equal(loadHtml(r.html)('[data-placeholder-notice], .notice').length, 0);
});

test('fact slots come from the audit, not the model, and may appear many times', () => {
  const t = template(
    SECTION('<a data-slot="fact.phone" data-slot-href="fact.phone_href" href="tel:+10000000000">(000) 000-0000</a><p data-slot="fact.address">demo road</p>') +
      '<div><span data-slot="fact.phone">(000) 000-0000</span></div>',
  );
  const r = run(t, pack([]));
  const $ = loadHtml(r.html);
  assert.equal($('a[href^="tel:"]').attr('href'), 'tel:5035550142');
  assert.deepEqual(
    $('[data-copy-id]').map((_, el) => $(el).text()).toArray(),
    ['(503) 555-0142', '77 Alder Street, Hillsboro, OR 97123', '(503) 555-0142'],
  );
  // No model value was involved, so nothing here is placeholder copy.
  assert.equal(r.placeholderCount, 0);
});

test('an optional slot with no value is removed; a required one is a hard error before anything is written', () => {
  const opt = template(SECTION(`<p data-slot="a.b" data-slot-kind="price" data-slot-optional ${I}="x">From $14,500</p>`));
  const r = run(opt, pack([]));
  assert.equal(loadHtml(r.html)('p').length, 0);
  assert.deepEqual(r.droppedSlots, ['a.b']);

  const req = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  assert.throws(
    () => run(req, pack([])),
    (e: unknown) => e instanceof FillError && /required slot "a\.b" has no value/.test(e.message),
  );
});

test('a fallback fills a required slot the source could not', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" data-slot-fallback="Call for details." ${I}="x">demo</p>`));
  const r = run(t, pack([]));
  assert.equal(loadHtml(r.html)('p').text(), 'Call for details.');
});

test('a pack value for an undeclared slot is dropped with a note, not written blindly', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  const r = run(t, pack([sourced('a.b', 'Fine.'), sourced('ghost.slot', 'Should not appear.')]));
  assert.deepEqual(r.unknownSlots, ['ghost.slot']);
  assert.ok(!r.html.includes('Should not appear'));
  assert.ok(r.notes.some((m) => /does not declare/.test(m)));
});

test('em dashes never reach the page, because the templates were written without them', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  const r = run(t, pack([sourced('a.b', 'We build patios — and we drain them — properly.')]));
  assert.equal(loadHtml(r.html)('p').text(), 'We build patios, and we drain them, properly.');
});

// ---- repeats -----------------------------------------------------------------------------------

const REPEAT = (extra = '') =>
  SECTION(
    `<div class="cards" data-repeat="services" data-repeat-min="2" data-repeat-max="4"${extra}>` +
      `<article class="card feature" data-repeat-item><h4 data-slot="services[].name" data-slot-kind="heading" ${I}="x">Demo one</h4></article>` +
      `<article class="card" data-repeat-item><h4 data-slot="services[].name" data-slot-kind="heading" ${I}="x">Demo two</h4></article>` +
      `<article class="card" data-repeat-item><h4 data-slot="services[].name" data-slot-kind="heading" ${I}="x">Demo three</h4></article>` +
      `</div>`,
  );

test('a repeat renders one item per pack entry, feature cell first, clamped to max', () => {
  const t = template(REPEAT());
  const r = run(t, pack([0, 1, 2, 3, 4].map((i) => sourced(`services[${i}].name`, `Real ${i}`))));
  const $ = loadHtml(r.html);
  assert.equal($('.card').length, 4, 'four items, because data-repeat-max is 4');
  assert.deepEqual($('h4').map((_, el) => $(el).text()).toArray(), ['Real 0', 'Real 1', 'Real 2', 'Real 3']);
  assert.ok($('.card').first().hasClass('feature'), 'item 0 keeps the feature prototype');
  assert.equal($('.card.feature').length, 1, 'and only item 0 does');
});

test('out-of-order and sparse pack indices render in order, with no gaps', () => {
  const t = template(REPEAT());
  const r = run(t, pack([sourced('services[7].name', 'Third'), sourced('services[0].name', 'First'), sourced('services[3].name', 'Second')]));
  const $ = loadHtml(r.html);
  assert.deepEqual($('h4').map((_, el) => $(el).text()).toArray(), ['First', 'Second', 'Third']);
});

test('a repeat below its minimum empties the group and takes its region with it', () => {
  const t = template(REPEAT(' data-omit-if-empty="services"'));
  const r = run(t, pack([sourced('services[0].name', 'Only one')]));
  const $ = loadHtml(r.html);
  assert.deepEqual(r.emptyGroups, ['services']);
  assert.equal($('.cards').length, 0);
  assert.equal($('h4').length, 0);
  assert.ok(!r.html.includes('Only one'), 'a group below minimum renders none of its items');
});

// ---- omission ----------------------------------------------------------------------------------

test('a section the source gives nothing for is removed, and so are the links to it', () => {
  const t = template(
    `<nav><ul><li><a href="#s1">One</a></li><li><a href="#s2">Two</a></li></ul></nav>` +
      SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`) +
      `<section id="s2"><h2>Two</h2><p data-slot="c.d" data-slot-kind="paragraph" data-slot-optional ${I}="x">demo two</p></section>`,
  );
  const r = run(t, pack([sourced('a.b', 'Kept.')], { omit_sections: ['s2'] }));
  const $ = loadHtml(r.html);
  assert.equal($('#s2').length, 0);
  assert.deepEqual($('nav a[href^="#s"]').map((_, el) => $(el).attr('href')).toArray(), ['#s1']);
  assert.equal($('nav li').length, 1, 'the whole nav item goes, not just its anchor');
  assert.ok(r.omittedRegions.some((m) => m.startsWith('s2')));
});

// ---- output hygiene ----------------------------------------------------------------------------

test('no scaffolding attribute survives, and the audit tags do', () => {
  const t = template(
    SECTION(
      `<p data-checklist="C-answer-first" data-answer-first data-slot="a.b" data-slot-kind="paragraph" data-slot-max="80" data-slot-optional ${I}="x">demo</p>` + REPEAT(),
      ' data-omit-if-empty="services"',
    ),
    ' data-mock-tokens="Demo%20Co"',
  );
  const r = run(t, pack([sourced('a.b', 'Kept.'), sourced('services[0].name', 'A'), sourced('services[1].name', 'B')]));
  assert.doesNotMatch(r.html, /data-slot|data-repeat|data-omit-if-empty|data-mock-tokens|data-image-slot/);
  const $ = loadHtml(r.html);
  assert.equal($('[data-checklist="C-answer-first"]').length, 1);
  assert.equal($('[data-answer-first]').length, 1);
  assert.equal($('[data-copy-id]').length, 3);
});

test('a brand override is appended to the template stylesheet, not added as a second one', () => {
  const t = template(SECTION(`<p data-slot="a.b" data-slot-kind="paragraph" ${I}="x">demo</p>`));
  const r = fill({ manifest: t.manifest, templateHtml: t.html, pack: pack([sourced('a.b', 'x')]), facts: FACTS, brandCss: ':root{--brand-accent:#123456}' });
  const $ = loadHtml(r.html);
  assert.equal($('style').length, 1);
  assert.match($('style').text(), /--brand-accent:#123456/);
  assert.equal($('link[rel="stylesheet"]').length, 0, 'still zero network requests');
});

// ---- the real template -------------------------------------------------------------------------

test('filling the real landscaping template leaves nothing of the mock business behind', () => {
  const industries = loadIndustries(REPO_ROOT);
  const industry = industries.industries.find((i) => i.slug === 'landscaping')!;
  const file = path.join(REPO_ROOT, industry.template_file);
  const manifest = readTemplate(file, 'landscaping', industry.template_file);
  const templateHtml = fs.readFileSync(file, 'utf8');

  // One value per declared slot, enough items to clear every repeat minimum.
  const slots: SlotValue[] = [];
  for (const def of manifest.slots) {
    if (def.id.startsWith('fact.') || def.mirror) continue;
    if (def.group) continue;
    slots.push(sourced(def.id, `Sourced copy for ${def.id}.`));
  }
  for (const r of manifest.repeats) {
    for (let i = 0; i < r.min; i++) {
      for (const id of r.slotIds) slots.push(sourced(id.replace('[]', `[${i}]`), `Sourced ${id} ${i}.`));
    }
  }

  const res = fill({ manifest, templateHtml, pack: pack(slots), facts: FACTS });
  const $ = loadHtml(res.html);

  // <body> is the fill's territory. <head> is not: its title, description, canonical, OG tags and
  // JSON-LD are replaced wholesale by patchHead, and are asserted in test/site-seo.test.ts.
  const body = $('body').clone();
  body.find('style, script').remove();
  const rendered = body.html() ?? '';

  for (const token of manifest.mockTokens) {
    assert.ok(!rendered.includes(token), `mock identity token survived the fill: ${token}`);
  }
  const survivors = manifest.demoLexicon.filter((phrase) => rendered.includes(phrase));
  assert.deepEqual(survivors, [], `demo prose survived the fill:\n${survivors.map((s) => `  ${s}`).join('\n')}`);
  assert.ok(res.copy.length > 40, `expected the page to carry real copy, got ${res.copy.length} blocks`);
  assert.equal(res.unknownSlots.length, 0);
});
