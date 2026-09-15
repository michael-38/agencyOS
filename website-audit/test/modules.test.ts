import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, MODULE_IDS, defaultModules, parseList, resolveModules } from '../src/modules.js';

test('defaults: everything on except lighthouse; registry is consistent', () => {
  const d = defaultModules();
  assert.equal(Object.keys(d).length, 9);
  assert.equal(d.lighthouse, false);
  assert.ok(MODULE_IDS.every((id) => id === 'lighthouse' ? d[id] === false : d[id] === true));
  assert.deepEqual(MODULES.map((m) => m.id), [...MODULE_IDS]);
  assert.ok(MODULES.every((m) => m.label && m.cost && m.description));
  assert.equal(MODULES.find((m) => m.id === 'lighthouse')!.built, false);
});

test('--enable/--disable/config precedence (config < enable < disable)', () => {
  const r = resolveModules({ config: { judgment: false, desktop: false }, enable: ['judgment'], disable: ['subpath', 'judgment'] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.modules.judgment, false);
  assert.equal(r.modules.desktop, false);
  assert.equal(r.modules.subpath, false);
  assert.equal(r.modules.deterministic, true);
});

test('errors: unknown id, enabling an unbuilt module, classify off without an industry', () => {
  assert.match(resolveModules({ enable: ['nope'] }).errors[0], /unknown module "nope"/);
  assert.match(resolveModules({ enable: ['lighthouse'] }).errors[0], /not built yet/);
  assert.match(resolveModules({ disable: ['classify'] }).errors[0], /no --industry/);
  assert.deepEqual(resolveModules({ disable: ['classify'], industry: 'landscaping' }).errors, []);
});

test('warnings: both check modules off, both checklists off, subpath without checks', () => {
  const r = resolveModules({ disable: ['deterministic', 'judgment'] });
  assert.ok(r.warnings.some((w) => /no checklist items will be evaluated/.test(w)));
  assert.ok(r.warnings.some((w) => /"subpath" has no effect/.test(w)));
  const c = resolveModules({ disable: ['common-checklist', 'persona-checklist'] });
  assert.ok(c.warnings.some((w) => /both checklists are off/.test(w)));
  assert.deepEqual(resolveModules({}).warnings, []);
});

test('parseList trims and drops empties', () => {
  assert.deepEqual(parseList(' a, b ,,c '), ['a', 'b', 'c']);
  assert.deepEqual(parseList(undefined), []);
});
