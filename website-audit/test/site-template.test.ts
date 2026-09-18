// readTemplate is the single source of truth for a template's contract, so its rejections matter as
// much as its parse: a template that is wrong in a way the reader tolerates becomes a wrong page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FACT_PREFIX, RESIDUE_MIN_CHARS, TemplateError, readTemplate } from '../src/site/template.js';

let n = 0;
/** Write a template to a temp file and read it back. */
function parse(body: string, head = '', htmlAttrs = '') {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-')), `t${n++}.html`);
  fs.writeFileSync(
    file,
    `<!doctype html>\n<html lang="en"${htmlAttrs}>\n<head><meta charset="utf-8"><title>T</title>${head}</head>\n<body><header><nav><a class="skip-link" href="#main">Skip</a></nav></header><main id="main">${body}</main><footer><nav><a href="#main">Top</a></nav></footer></body>\n</html>\n`,
  );
  return readTemplate(file, 'landscaping', 'templates/personas/landscaping/index.html');
}

const rejects = (body: string, re: RegExp) => {
  try {
    parse(body);
  } catch (e) {
    assert.ok(e instanceof TemplateError, `expected TemplateError, got ${(e as Error).name}`);
    assert.match(e.message, re);
    return e;
  }
  assert.fail('expected the template to be rejected');
};

const SECTION = (inner: string, attrs = '') => `<section id="s1"${attrs}><h2>H</h2>${inner}</section>`;

test('a text slot, its kind, budget, intent and inherited checklist ids', () => {
  const m = parse(
    SECTION(
      '<p data-checklist="LS-services-clear C-answer-first" data-answer-first>' +
        '<span data-slot="hero.lede" data-slot-kind="paragraph" data-slot-max="180" data-slot-intent="Say what they do.">We build patios in Chagrin Falls, Ohio.</span></p>',
    ),
  );
  assert.equal(m.slots.length, 1);
  const s = m.slots[0];
  assert.equal(s.id, 'hero.lede');
  assert.equal(s.kind, 'paragraph');
  assert.equal(s.attr, null);
  assert.equal(s.group, null);
  assert.equal(s.max, 180);
  assert.equal(s.optional, false);
  assert.equal(s.answerFirst, true);
  assert.deepEqual(s.checklistIds, ['LS-services-clear', 'C-answer-first']);
  assert.equal(s.demoText, 'We build patios in Chagrin Falls, Ohio.');
  assert.equal(m.slug, 'landscaping');
  assert.match(m.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(m.sections, [{ id: 's1', omitGroup: null, checklistIds: [] }]);
  assert.deepEqual(m.coveredChecklistIds, ['C-answer-first', 'LS-services-clear']);
});

test('an attribute slot targets that attribute, not the text', () => {
  const m = parse(SECTION('<a data-slot-href="book.url" data-slot-kind="url" data-slot-intent="Booking link." href="https://demo.example/book">Book</a>'));
  assert.equal(m.slots.length, 1);
  assert.equal(m.slots[0].id, 'book.url');
  assert.equal(m.slots[0].attr, 'href');
  assert.equal(m.slots[0].demoText, 'https://demo.example/book');
});

test('one element can declare both a text slot and an attribute slot', () => {
  const m = parse(
    SECTION('<img data-slot-alt="hero.alt" data-slot-src="hero.src" data-slot-kind="paragraph" data-slot-intent="Hero." src="a.webp" alt="A patio at dusk" width="10" height="10">'),
  );
  assert.deepEqual(m.slots.map((s) => [s.id, s.attr]).sort(), [['hero.alt', 'alt'], ['hero.src', 'src']]);
});

test('fact.* slots need no intent and infer phone kind', () => {
  const m = parse(SECTION(`<a data-slot="${FACT_PREFIX}phone">(440) 555-0148</a><p data-slot="${FACT_PREFIX}address">128 Solon Road</p>`));
  assert.deepEqual(m.slots.map((s) => s.kind).sort(), ['paragraph', 'phone']);
  assert.ok(m.slots.every((s) => s.intent === ''));
});

test('a repeat records cardinality, prototype count, its slots and its owning section', () => {
  const m = parse(
    SECTION(
      '<div data-repeat="services" data-repeat-min="2" data-repeat-max="6">' +
        '<article data-repeat-item><h4 data-slot="services[].name" data-slot-kind="heading" data-slot-intent="Name it.">Paver patios</h4>' +
        '<p data-slot="services[].price" data-slot-kind="price" data-slot-optional data-slot-intent="Only if stated.">From $14,500</p></article>' +
        '<article data-repeat-item><h4 data-slot="services[].name" data-slot-kind="heading" data-slot-intent="Name it.">Drainage</h4>' +
        '<p data-slot="services[].price" data-slot-kind="price" data-slot-optional data-slot-intent="Only if stated.">From $3,800</p></article>' +
        '</div>',
    ),
  );
  assert.equal(m.repeats.length, 1);
  const r = m.repeats[0];
  assert.equal(r.group, 'services');
  assert.deepEqual([r.min, r.max, r.prototypes], [2, 6, 2]);
  assert.deepEqual(r.slotIds.sort(), ['services[].name', 'services[].price']);
  assert.equal(r.sectionId, 's1');
  assert.ok(m.slots.filter((s) => s.id === 'services[].price').every((s) => s.optional));
  // Both prototypes declare the same ids; that is the variant, not a duplicate.
  assert.equal(m.slots.filter((s) => s.id === 'services[].name').length, 2);
});

test('data-omit-if-empty resolves to a declared repeat group', () => {
  const m = parse(
    SECTION(
      '<div data-repeat="reviews" data-repeat-max="3"><p data-repeat-item data-slot="reviews[].text" data-slot-kind="quote" data-slot-intent="A review.">Great work all round.</p></div>',
      ' data-omit-if-empty="reviews"',
    ),
  );
  assert.deepEqual(m.sections, [{ id: 's1', omitGroup: 'reviews', checklistIds: [] }]);
});

test('mock identity tokens come off <html>, demo prose from the slots', () => {
  const m = parse(
    SECTION('<p data-slot="trust.body" data-slot-kind="paragraph" data-slot-intent="Trust.">Hollow Creek has been installing hardscape since 2009.</p><p data-slot="x.short" data-slot-kind="paragraph" data-slot-intent="Short.">Tiny</p>'),
    '',
    ' data-mock-tokens="Hollow%20Creek%20Landscape%20Co. hollowcreeklandscape.com (440)%20555-0148"',
  );
  assert.deepEqual(m.mockTokens, ['Hollow Creek Landscape Co.', 'hollowcreeklandscape.com', '(440) 555-0148']);
  assert.deepEqual(m.demoLexicon, ['Hollow Creek has been installing hardscape since 2009.']);
  assert.ok(m.demoLexicon.every((t) => t.length >= RESIDUE_MIN_CHARS), 'short demo text is not distinctive enough to match on');
});

// ---- rejections --------------------------------------------------------------------------------

test('a non-fact slot without an intent is rejected, because the intent is the prompt', () => {
  rejects(SECTION('<p data-slot="hero.lede" data-slot-kind="paragraph">x</p>'), /data-slot-intent is required/);
});

test('a slot without a kind is rejected', () => {
  rejects(SECTION('<p data-slot="hero.lede" data-slot-intent="Say it.">x</p>'), /data-slot-kind is required/);
});

test('an unknown kind is rejected and lists the valid set', () => {
  rejects(SECTION('<p data-slot="a.b" data-slot-kind="prose" data-slot-intent="x">y</p>'), /data-slot-kind "prose" is not one of heading\|paragraph/);
});

test('a duplicated singleton slot id is rejected', () => {
  rejects(
    SECTION('<p data-slot="a.b" data-slot-kind="paragraph" data-slot-intent="x">1</p><p data-slot="a.b" data-slot-kind="paragraph" data-slot-intent="x">2</p>'),
    /slot "a\.b" is declared 2 times/,
  );
});

test('the repeat id form is required inside a repeat, and forbidden outside one', () => {
  rejects(
    SECTION('<div data-repeat="services" data-repeat-max="4"><p data-repeat-item data-slot="name" data-slot-kind="heading" data-slot-intent="x">n</p></div>'),
    /must be "services\[\]\.<field>"/,
  );
  rejects(SECTION('<p data-slot="services[].name" data-slot-kind="heading" data-slot-intent="x">n</p>'), /uses the repeat form but has no \[data-repeat\] ancestor/);
});

test('a slot whose group disagrees with its container is rejected', () => {
  rejects(
    SECTION('<div data-repeat="services" data-repeat-max="4"><p data-repeat-item data-slot="areas[].name" data-slot-kind="heading" data-slot-intent="x">n</p></div>'),
    /must start "services\[\]\."/,
  );
});

test('a repeat with no prototype, no slots, no max, or a bad range is rejected', () => {
  rejects(SECTION('<div data-repeat="services" data-repeat-max="4"><p>nothing</p></div>'), /has no \[data-repeat-item\] prototype/);
  rejects(SECTION('<div data-repeat="services" data-repeat-max="4"><p data-repeat-item>nothing</p></div>'), /contains no slots/);
  rejects(
    SECTION('<div data-repeat="services"><p data-repeat-item data-slot="services[].name" data-slot-kind="heading" data-slot-intent="x">n</p></div>'),
    /data-repeat-max is required/,
  );
  rejects(
    SECTION('<div data-repeat="services" data-repeat-min="5" data-repeat-max="2"><p data-repeat-item data-slot="services[].name" data-slot-kind="heading" data-slot-intent="x">n</p></div>'),
    /min 5 exceeds max 2/,
  );
});

test('a repeat group declared twice is rejected', () => {
  rejects(
    SECTION('<div data-repeat="s" data-repeat-max="2"><p data-repeat-item data-slot="s[].a" data-slot-kind="heading" data-slot-intent="x">n</p></div>') +
      SECTION('<div data-repeat="s" data-repeat-max="2"><p data-repeat-item data-slot="s[].a" data-slot-kind="heading" data-slot-intent="x">n</p></div>').replace('id="s1"', 'id="s2"'),
    /declared on more than one container/,
  );
});

test('data-omit-if-empty naming no group is rejected, because the section could never be removed', () => {
  rejects(SECTION('<p data-slot="a.b" data-slot-kind="paragraph" data-slot-intent="x">y</p>', ' data-omit-if-empty="ghosts"'), /names no \[data-repeat\] group/);
});

test('every problem is reported at once, so one read gives the whole work order', () => {
  const e = rejects(
    SECTION('<p data-slot="a.b" data-slot-kind="prose">1</p><p data-slot="c.d">2</p>'),
    /is not a valid template \(4 problems\)/,
  );
  assert.equal(e.problems.length, 4);
  assert.equal(e.file, 'templates/personas/landscaping/index.html');
});
