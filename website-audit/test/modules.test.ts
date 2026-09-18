import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, MODULE_IDS, OPENSEO_MODULE_IDS, defaultModules, parseList, resolveModules } from '../src/modules.js';

test('defaults: every audit module on except lighthouse, every OpenSEO module off; registry is consistent', () => {
  const d = defaultModules();
  const audit = MODULES.filter((m) => m.group === 'audit');
  const openseo = MODULES.filter((m) => m.group === 'openseo');
  assert.equal(Object.keys(d).length, MODULE_IDS.length);
  assert.equal(audit.length, 9);
  assert.ok(openseo.length >= 1);
  assert.equal(d.lighthouse, false);
  assert.ok(audit.every((m) => (m.id === 'lighthouse' ? d[m.id] === false : d[m.id] === true)));
  assert.deepEqual(MODULES.map((m) => m.id), [...MODULE_IDS]);
  assert.ok(MODULES.every((m) => m.label && m.cost && m.description));
  assert.equal(MODULES.find((m) => m.id === 'lighthouse')!.built, false);
});

test('OpenSEO modules: off by default, billing declared, tools listed, never audit-billing', () => {
  const d = defaultModules();
  const openseo = MODULES.filter((m) => m.group === 'openseo');
  assert.equal(openseo.length, OPENSEO_MODULE_IDS.length);
  for (const m of openseo) {
    assert.equal(d[m.id], false, `${m.id} must default off — it needs a connected account or spends credits`);
    assert.ok(m.billing === 'openseo' || m.billing === 'dataforseo', `${m.id} must declare who it bills`);
    assert.ok(m.built, `${m.id} must be built to be tickable`);
    assert.ok(m.tools && m.tools.length, `${m.id} must name the OpenSEO tools it maps to`);
  }
  // Every audit module is free of third-party billing.
  assert.ok(MODULES.filter((m) => m.group === 'audit').every((m) => m.billing === 'none'));
  // The money-spending set is explicitly enumerated, so a new one can't slip in unlabelled.
  assert.deepEqual(
    openseo.filter((m) => m.billing === 'dataforseo').map((m) => m.id).sort(),
    ['openseo-backlinks', 'openseo-competitors', 'openseo-keywords', 'openseo-lighthouse', 'openseo-local-grid', 'openseo-local-pack', 'openseo-rank-tracking', 'openseo-rankings', 'openseo-reviews', 'openseo-serp'],
  );
});

test('OpenSEO: lighthouse implies the crawl, local modules warn without facts', () => {
  const lh = resolveModules({ enable: ['openseo-lighthouse'] });
  assert.equal(lh.modules['openseo-crawl'], true);
  assert.ok(lh.warnings.some((w) => /runs as part of the OpenSEO crawl/.test(w)));

  const local = resolveModules({ enable: ['openseo-local-grid'], disable: ['facts'] });
  assert.ok(local.warnings.some((w) => /openseo-local-grid.*no location pre-filled/.test(w)));
  assert.deepEqual(resolveModules({ enable: ['openseo-local-grid'] }).warnings, []);
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
