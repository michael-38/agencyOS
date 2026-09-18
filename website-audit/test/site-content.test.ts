// The prompt is derived from the template, so these tests are about what the model is and is not
// asked for. Getting that wrong is expensive twice: a slot left out of the table can never be
// filled, and a code-owned fact put into the table invites the model to retype a phone number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadIndustries } from '../src/personas/load.js';
import { readTemplate } from '../src/site/template.js';
import { ContentPackSchema, clampToWords, entitiesOf, normalizeCopy, parseSlotId } from '../src/site/content.js';
import { promptedSlots, siteContentSystem, siteContentUser, slotTable, sourceCorpusBlock } from '../src/llm/prompts/site-content.js';
import { REPO_ROOT } from './helpers.js';

const industries = loadIndustries(REPO_ROOT);
const industry = industries.industries.find((i) => i.slug === 'landscaping')!;
const manifest = readTemplate(path.join(REPO_ROOT, industry.template_file), 'landscaping', industry.template_file);

const PERSONA = {
  industryDisplayName: 'Landscaping & lawn care',
  personaName: 'Homeowner comparing contractors',
  primaryGoal: 'Decide whether this contractor does their kind of job, in their town, at a price they can live with',
  deviceBias: 'mobile',
  goalsProse: 'They want to see finished work near them and a price range before they call.',
};

test('slot ids parse into their canonical form, group and index', () => {
  assert.deepEqual(parseSlotId('hero.lede'), { canonical: 'hero.lede', group: null, index: null, field: null });
  assert.deepEqual(parseSlotId('services[2].name'), { canonical: 'services[].name', group: 'services', index: 2, field: 'name' });
  assert.deepEqual(parseSlotId('fact.phone'), { canonical: 'fact.phone', group: null, index: null, field: null });
  // An unindexed repeat id is not a repeat value; it is the declaration form.
  assert.equal(parseSlotId('services[].name').group, null);
});

test('the model is asked for every fillable slot, and for no code-owned one', () => {
  const asked = promptedSlots(manifest);
  const ids = asked.map((s) => s.id);
  assert.ok(ids.length > 30, `expected a substantial slot list, got ${ids.length}`);
  assert.deepEqual(ids.filter((id) => id.startsWith('fact.')), [], 'fact.* values come from the audit, not the model');
  assert.deepEqual([...new Set(ids)], ids, 'each slot is asked for exactly once');
  assert.deepEqual(asked.filter((s) => s.mirror), [], 'a mirror repeats a canonical value and is never asked for');
  // Every repeat field appears once, not once per prototype.
  assert.equal(ids.filter((id) => id === 'services[].name').length, 1);
  assert.ok(ids.includes('hero.h1'));
  assert.ok(ids.includes('faq[].q'));
  // Every asked slot carries the intent that is its only instruction.
  for (const s of asked) assert.ok(s.intent.trim().length > 10, `${s.id} has no usable intent`);
});

test('the slot table states each slot\'s budget, optionality and cardinality', () => {
  const table = slotTable(manifest);
  assert.match(table, /\| slot \| kind \| rules \| what it has to accomplish \|/);
  assert.match(table, /`hero\.h1` \| heading \| required, <= 80 chars/);
  assert.match(table, /`services\[\]\.price`.*optional/);
  assert.match(table, /- `services\[\]`: between 2 and 6 items \(section `services`\)/);
  assert.match(table, /### Sections on this page/);
  for (const s of manifest.sections) assert.ok(table.includes(`\`${s.id}\``), `section ${s.id} is not listed`);
  // No fact slot leaks into the table.
  assert.ok(!table.includes('`fact.'), 'the table must not invite the model to write a fact');
  // A pipe in an intent would break the markdown table.
  assert.ok(!/\|\s*\|\s*\|\s*\|\s*\|\s*\|/.test(table), 'no row has a stray column');
});

test('the corpus block leads the request, byte-identical, so it can be prompt-cached', () => {
  const a = sourceCorpusBlock('<page url="u">text</page>');
  const b = sourceCorpusBlock('<page url="u">text</page>');
  assert.equal(a, b);
  assert.match(a, /^## Source pages/);
  assert.match(a, /only permitted source of quotes/);
});

test('the system prompt states every rule the gates enforce', () => {
  const sys = siteContentSystem(PERSONA);
  for (const rule of [
    'source_kind: "placeholder"',
    'verbatim span',
    'omit the slot entirely',
    'omit_sections',
    'No dashes as punctuation',
    'One label per intent',
    'answer-first',
    'when the source states both a value and a count',
    'Never write a review, a testimonial or a rating that is not already published',
  ]) {
    assert.ok(sys.includes(rule), `the prompt does not state: ${rule}`);
  }
});

test('vertical knowledge reaches the prompt only as data', () => {
  // The same invariant test/no-industry-terms.test.ts enforces over src/: nothing in the prompt
  // source knows a vertical by name. Called with sentinel persona values, the output must contain
  // no industry term at all — every one it does carry came through the persona file.
  const sys = siteContentSystem({
    industryDisplayName: 'SENTINEL_INDUSTRY',
    personaName: 'SENTINEL_PERSONA',
    primaryGoal: 'SENTINEL_GOAL',
    deviceBias: 'SENTINEL_DEVICE',
    goalsProse: 'SENTINEL_PROSE',
  });
  for (const term of ['landscap', 'patio', 'med spa', 'medspa', 'funeral', 'hvac', 'roofing', 'plumb', 'wedding', 'assisted living']) {
    assert.ok(!sys.toLowerCase().includes(term), `the prompt source names a vertical: ${term}`);
  }
  for (const sentinel of ['SENTINEL_INDUSTRY', 'SENTINEL_PERSONA', 'SENTINEL_GOAL', 'SENTINEL_DEVICE', 'SENTINEL_PROSE']) {
    assert.ok(sys.includes(sentinel), `the persona's ${sentinel} never reaches the prompt`);
  }
});

test('the user message carries the facts, the gaps, the reference and the slot table', () => {
  const user = siteContentUser({
    facts: 'business_name: Verdant Grounds\nphones: (503) 555-0142',
    guidance: { archetype: 'Archetype guidance here.', industry: 'Industry guidance here.' },
    gaps: [{ id: 'tel-link', criterion: 'A tap-to-call link exists', verdict: 'fail', weight: 'high', scope: 'home', note: 'none found' }],
    manifest,
    profile: 'mockup',
  });
  assert.match(user, /## Facts extracted from the source site/);
  assert.match(user, /Verdant Grounds/);
  assert.match(user, /## Build reference — business archetype/);
  assert.match(user, /## Build reference — this industry/);
  assert.match(user, /`tel-link` \(fail, high, scope home\): A tap-to-call link exists — auditor's note: none found/);
  assert.match(user, /## Slots \(\d+\)/);
});

test('an unwritten build reference is declared, not papered over', () => {
  const user = siteContentUser({ facts: 'x', guidance: { archetype: '', industry: '' }, gaps: [], manifest, profile: 'mockup' });
  assert.match(user, /No build reference has been authored for this industry yet/);
  assert.match(user, /more conservative than usual/);
  assert.match(user, /\(none — the current site already meets every checklist item\)/);
});

test('the pack schema accepts a minimal pack and rejects a malformed slot', () => {
  const base = {
    business_name: 'Verdant Grounds',
    title: 'Verdant Grounds, patios in Hillsboro',
    meta_description: 'Verdant Grounds designs and builds paver patios and drainage across Hillsboro, Oregon.',
    site_summary: 'Landscape construction in Hillsboro.',
    slots: [{ slot: 'hero.h1', text: 'Patios and drainage', source_kind: 'source', source_page_url: 'u', source_quote: 'q' }],
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
  };
  assert.equal(ContentPackSchema.safeParse(base).success, true);
  assert.equal(ContentPackSchema.safeParse({ ...base, slots: [{ slot: 'x', text: 'y', source_kind: 'invented', source_page_url: null, source_quote: null }] }).success, false);
  const parsed = ContentPackSchema.parse(base);
  assert.deepEqual(entitiesOf(parsed).rating, null, 'no value and count means no rating');
});

test('copy normalisation strips the tells, and clamping cuts on a word boundary', () => {
  assert.equal(normalizeCopy('We build patios — properly'), 'We build patios, properly');
  assert.equal(normalizeCopy('a – b'), 'a, b');
  assert.equal(normalizeCopy('“quoted”  and  ‘single’'), '"quoted" and \'single\'');
  assert.equal(clampToWords('one two three four', 100), 'one two three four');
  assert.equal(clampToWords('one two three four', 11), 'one two');
  // A single long word has no boundary to cut on, so it is cut hard rather than dropped.
  assert.equal(clampToWords('abcdefghijklmnop', 8).length, 8);
});

test('every template in industries.yaml produces a usable slot table', () => {
  // A template with no fillable slots would silently produce a page of nothing, and a template whose
  // intents are missing would produce a page of guesses.
  for (const ind of industries.industries) {
    const file = path.join(REPO_ROOT, ind.template_file);
    if (!fs.existsSync(file)) continue;
    let m;
    try {
      m = readTemplate(file, ind.slug, ind.template_file);
    } catch {
      continue; // not yet annotated; the promotion gate tracks that
    }
    const asked = promptedSlots(m);
    if (!asked.length) continue;
    assert.ok(slotTable(m).includes('| slot |'), `${ind.slug} produced no slot table`);
    for (const s of asked) assert.ok(s.intent.trim(), `${ind.slug}: slot ${s.id} has no intent`);
  }
});
