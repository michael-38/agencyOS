import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parsePersonaMarkdown } from '../src/personas/parse.js';
import { loadChecklist, loadDetectors, loadIndustries, loadPersonaFile, validateAllPersonas } from '../src/personas/load.js';
import { PersonaValidationError } from '../src/personas/schema.js';
import { REGISTERED_CHECK_IDS } from '../src/checks/registry.js';
import { BASE_INDUSTRIES_YAML, FIXTURES, PKG_ROOT, REPO_ROOT, fixture, tempRepo } from './helpers.js';

const personaFixture = (name: string) => fixture(`personas/${name}.md`);

function expectViolation(name: string, re: RegExp): PersonaValidationError {
  try {
    parsePersonaMarkdown(personaFixture(name), `${name}.md`);
  } catch (e) {
    assert.ok(e instanceof PersonaValidationError, `expected PersonaValidationError, got ${(e as Error).name}`);
    assert.match(e.message, re);
    assert.ok(e.violations.every((v) => v.file === `${name}.md` && typeof v.line === 'number'));
    return e;
  }
  assert.fail(`${name} should not parse`);
}

test('valid persona: frontmatter, goals prose, extra column, escaped pipe', () => {
  const p = parsePersonaMarkdown(personaFixture('valid-extra-column'), 'valid-extra-column.md');
  assert.equal(p.frontmatter.device_bias, 'desktop');
  assert.equal(p.frontmatter.persona_name, 'Test visitor');
  assert.match(p.goals_prose, /First prose line\.\nSecond prose line\./);
  assert.doesNotMatch(p.goals_prose, /Checklist/);
  assert.equal(p.items.length, 3);
  assert.equal(p.items[1].id, 'X-pipe');
  assert.equal(p.items[1].criterion, 'Shows "call | text" options');
  assert.equal(p.items[0].extra.notes, 'keep');
  assert.equal(p.items[2].extra.notes, '');
  assert.equal(p.items[2].scope, 'subpath');
  assert.equal(p.items[2].weight, 'low');
  assert.ok(p.items.every((it) => typeof it.line === 'number' && it.line > 0));
  assert.deepEqual(p.warnings, []);
});

test('device_bias defaults to mobile', () => {
  const p = parsePersonaMarkdown(personaFixture('trailing-content'), 'trailing-content.md');
  assert.equal(p.frontmatter.device_bias, 'mobile');
});

test('each violation is reported with file:line', () => {
  expectViolation('missing-column', /missing required column "weight"/);
  expectViolation('bad-scope', /scope "page" must be one of home\|subpath/);
  expectViolation('duplicate-id', /duplicate id "tel-link" \(first at line \d+\)/);
  expectViolation('no-frontmatter', /must start with a "---"/);
  expectViolation('two-tables', /more than one checklist table/);
});

test('content after the table produces a warning, not an error', () => {
  const p = parsePersonaMarkdown(personaFixture('trailing-content'), 'trailing-content.md');
  assert.equal(p.items.length, 1);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0].message, /ignored/);
  assert.ok(p.warnings[0].line > 8);
});

test('loadPersonaFile enforces frontmatter industry == file slug', () => {
  assert.throws(() => loadPersonaFile(PKG_ROOT, 'test/fixtures/personas/industry-mismatch.md'), /must equal the file's slug "industry-mismatch"/);
  assert.throws(() => loadPersonaFile(PKG_ROOT, 'test/fixtures/personas/does-not-exist.md'), /file not found/);
});

test('loadChecklist: unregistered deterministic id lists the registry', () => {
  const yaml = BASE_INDUSTRIES_YAML.replace(
    'industries:\n',
    'industries:\n  - slug: unregistered-deterministic\n    display_name: X\n    aliases: []\n    archetype: local-service\n    persona_file: personas/unregistered-deterministic.md\n    build_reference_file: x.md\n',
  );
  const repo = tempRepo({ industries: yaml, personas: { 'unregistered-deterministic.md': personaFixture('unregistered-deterministic') } });
  const industries = loadIndustries(repo);
  assert.throws(
    () => loadChecklist(repo, industries, 'unregistered-deterministic', { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS }),
    (e: unknown) => e instanceof PersonaValidationError && /not-a-check.*not a registered check/.test(e.message) && /Registered: .*tel-link/.test(e.message),
  );
});

test('loadChecklist: an id shared by the persona and _common is a validation error', () => {
  const collide = `---\nindustry: collide\npersona_name: T\nprimary_goal: T\n---\n\n| id | criterion | scope | check | weight |\n|---|---|---|---|---|\n| structured-data | dup of common | home | deterministic | high |\n`;
  const yaml = BASE_INDUSTRIES_YAML.replace(
    'industries:\n',
    'industries:\n  - slug: collide\n    display_name: X\n    aliases: []\n    archetype: local-service\n    persona_file: personas/collide.md\n    build_reference_file: x.md\n',
  );
  const repo = tempRepo({ industries: yaml, personas: { 'collide.md': collide } });
  const industries = loadIndustries(repo);
  assert.throws(
    () => loadChecklist(repo, industries, 'collide', { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS }),
    /collides with the same id in personas\/collide\.md/,
  );
});

test('loadChecklist: missing persona file falls back to generic with a warning', () => {
  const yaml = BASE_INDUSTRIES_YAML.replace(
    'industries:\n',
    'industries:\n  - slug: ghost\n    display_name: Ghost\n    aliases: []\n    archetype: local-service\n    persona_file: personas/ghost.md\n    build_reference_file: x.md\n',
  );
  const repo = tempRepo({ industries: yaml });
  const industries = loadIndustries(repo);
  const res = loadChecklist(repo, industries, 'ghost', { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  assert.equal(res.personaFallback, true);
  assert.equal(res.personaFile, 'personas/generic.md');
  assert.ok(res.warnings.some((w) => /falling back/.test(w.message)));
  assert.ok(res.items.some((it) => it.source === 'persona'));
  assert.ok(res.items.some((it) => it.source === 'common'));
  assert.deepEqual(Object.keys(res.hashes).sort(), ['personas/_common.md', 'personas/generic.md']);
});

test('loadChecklist: excludeItems and module flags', () => {
  const industries = loadIndustries(REPO_ROOT);
  const all = loadChecklist(REPO_ROOT, industries, 'landscaping', { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  assert.ok(all.items.some((it) => it.id === 'tel-link-above-fold'));
  const excluded = loadChecklist(REPO_ROOT, industries, 'landscaping', {
    includePersona: true,
    includeCommon: true,
    registeredCheckIds: REGISTERED_CHECK_IDS,
    excludeItems: ['tel-link-above-fold'],
  });
  assert.ok(!excluded.items.some((it) => it.id === 'tel-link-above-fold'));
  assert.equal(excluded.items.length, all.items.length - 1);
  const commonOnly = loadChecklist(REPO_ROOT, industries, 'landscaping', { includePersona: false, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  assert.ok(commonOnly.items.every((it) => it.source === 'common'));
  assert.equal(commonOnly.personaFile, null);
  assert.equal(Object.keys(all.hashes).length, 2);
  assert.match(all.hashes['personas/landscaping.md'], /^[0-9a-f]{64}$/);
});

test('loadIndustries validation: duplicate slug, unknown archetype, missing generic', () => {
  const dup = tempRepo({ industries: BASE_INDUSTRIES_YAML.replace('slug: generic', 'slug: landscaping') });
  assert.throws(() => loadIndustries(dup), /duplicate slug "landscaping"|slug "generic" is required/);
  const badArch = tempRepo({ industries: BASE_INDUSTRIES_YAML.replace('archetype: local-service', 'archetype: nope') });
  assert.throws(() => loadIndustries(badArch), /archetype "nope" is not declared/);
});

test('loadDetectors compiles regexes and merges an industry block over the global lists', () => {
  const d = loadDetectors(REPO_ROOT);
  assert.ok(d.hoursRe instanceof RegExp);
  assert.ok(d.addressRe instanceof RegExp);
  assert.ok(d.booking_widgets.length > 5);
  assert.ok(d.schema_org_local_business_subtypes.includes('LocalBusiness'));
  const industries = loadIndustries(REPO_ROOT);
  const ind = { ...industries.industries[0], detectors: { chat_widgets: [{ name: 'TestChat', patterns: ['testchat.example'] }], booking_cta_words: ['grab a slot'] } };
  const merged = loadDetectors(REPO_ROOT, ind);
  assert.ok(merged.chat_widgets.some((c) => c.name === 'TestChat'));
  assert.ok(merged.chat_widgets.length === d.chat_widgets.length + 1);
  assert.ok(merged.booking_cta_words.includes('grab a slot'));
  assert.ok(merged.booking_cta_words.includes('book'));
});

test('validateAllPersonas passes on the real repo', () => {
  const res = validateAllPersonas(REPO_ROOT, REGISTERED_CHECK_IDS);
  assert.equal(res.ok, true, res.violations.map((v) => `${v.file}:${v.line} ${v.message}`).join('\n'));
  assert.ok(res.checked.includes('landscaping') && res.checked.includes('generic'));
});

test('fixture personas directory has the expected files', () => {
  const files = fs.readdirSync(path.join(FIXTURES, 'personas'));
  for (const f of ['valid-extra-column.md', 'missing-column.md', 'bad-scope.md', 'duplicate-id.md', 'two-tables.md', 'trailing-content.md']) assert.ok(files.includes(f), f);
});
