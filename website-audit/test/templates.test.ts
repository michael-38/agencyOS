// The promotion gate: what a file must satisfy to be a fillable page template.
//
// Runs against every `template_file` in config/industries.yaml. The load-bearing rule is the last
// one: any claim-bearing text in <main> that is NOT inside a [data-slot] is text the filler cannot
// replace, so it would ship the template's mock business to a real client. Keeping that set empty
// is the whole reason the residue gate can be trusted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadHtml } from '../src/checks/html.js';
import { loadChecklist, loadIndustries } from '../src/personas/load.js';
import { REGISTERED_CHECK_IDS } from '../src/checks/registry.js';
import { findClaims } from '../src/site/validate.js';
import { REPO_ROOT } from './helpers.js';
import type { CheerioAPI } from 'cheerio';

/** `data-checklist` ids the build places itself, so a template may carry them without a persona. */
const RESERVED_CHECK_IDS = new Set(['sticky-mobile-cta']);
/** The two custom properties the brand override rewrites. Every template must route through them. */
const BRAND_TOKENS = ['--brand-accent', '--brand-accent-dark'];

/**
 * Templates not yet annotated with slots and brand tokens. Declared debt, the same way
 * `templates/personas/tools/coverage.mjs` declares its unsatisfiable criteria: the two annotation
 * rules report their work order for these slugs instead of failing.
 *
 * The set only shrinks. A slug listed here that actually passes is itself a failure, so finishing a
 * template forces its own removal — and the last removal deletes this block.
 */
const PENDING_ANNOTATION = new Set([
  'landscaping',
  'cleaning',
  'med-spa',
  'senior-care',
  'wedding-venues',
  'schools-camps',
  'funeral-homes',
  'generic',
]);

/**
 * Assert for a rule that is still pending on some templates. An annotated slug must be clean; a
 * pending slug prints what is left to do; a pending slug that is already clean must be un-listed.
 */
function assertOrPending(slug: string, offenders: string[], label: string): void {
  const pending = PENDING_ANNOTATION.has(slug);
  if (!pending) {
    assert.deepEqual(offenders, [], `${slug} ${label}:\n` + offenders.map((o) => `  ${o}`).join('\n'));
    return;
  }
  assert.ok(
    offenders.length > 0,
    `${slug} now passes "${label}" — remove it from PENDING_ANNOTATION in this file.`,
  );
  process.stderr.write(`pending: ${slug} — ${offenders.length} ${label}\n`);
}

const industries = loadIndustries(REPO_ROOT);

interface Loaded {
  slug: string;
  file: string;
  html: string;
  $: CheerioAPI;
  ids: Set<string>;
}

const templates: Loaded[] = industries.industries.map((ind) => {
  const file = path.join(REPO_ROOT, ind.template_file);
  const html = fs.readFileSync(file, 'utf8');
  const checklist = loadChecklist(REPO_ROOT, industries, ind.slug, {
    includePersona: true,
    includeCommon: true,
    registeredCheckIds: REGISTERED_CHECK_IDS,
  });
  return { slug: ind.slug, file: ind.template_file, html, $: loadHtml(html), ids: new Set(checklist.items.map((it) => it.id)) };
});

test('every industry in industries.yaml has a template on disk', () => {
  assert.equal(templates.length, industries.industries.length);
  for (const t of templates) assert.ok(t.html.length > 1000, `${t.file} looks empty`);
});

for (const t of templates) {
  test(`${t.slug}: document shell`, () => {
    const { $ } = t;
    assert.match(t.html, /^\s*<!doctype html>/i, 'missing doctype');
    assert.equal($('html').length, 1);
    assert.ok($('html').attr('lang'), '<html> has no lang');
    for (const lm of ['header', 'main', 'footer']) assert.equal($(lm).length >= 1, true, `landmark <${lm}> missing`);
    assert.ok($('a.skip-link').length, 'skip link missing');
    assert.ok($('main section').length >= 5, `expected >= 5 sections in <main>, found ${$('main section').length}`);
    assert.equal($('h1').length, 1, 'expected exactly one <h1>');
  });

  test(`${t.slug}: exactly one script, and it is parseable JSON-LD`, () => {
    const scripts = t.$('script');
    assert.equal(scripts.length, 1, `expected 1 <script>, found ${scripts.length}`);
    assert.equal(scripts.attr('type'), 'application/ld+json');
    assert.doesNotThrow(() => JSON.parse(scripts.text()), 'JSON-LD does not parse');
  });

  test(`${t.slug}: every data-checklist id is real`, () => {
    const seen = new Set<string>();
    t.$('[data-checklist]').each((_, el) => {
      for (const id of (t.$(el).attr('data-checklist') ?? '').split(/\s+/).filter(Boolean)) seen.add(id);
    });
    assert.ok(seen.size > 0, 'template tags no checklist ids at all');
    // A persona criterion, a registered deterministic check (check-html can still evaluate it even
    // when this persona's table omits it), or an id the build places itself. Anything else is a typo.
    const unknown = [...seen].filter((id) => !t.ids.has(id) && !REGISTERED_CHECK_IDS.has(id) && !RESERVED_CHECK_IDS.has(id));
    assert.deepEqual(unknown, [], `unknown data-checklist ids: ${unknown.join(', ')}`);
  });

  test(`${t.slug}: images declare alt and intrinsic size`, () => {
    const bad: string[] = [];
    t.$('img').each((_, el) => {
      const $el = t.$(el);
      const src = $el.attr('src') ?? '?';
      if (!($el.attr('alt') ?? '').trim()) bad.push(`${src}: no alt`);
      if (!$el.attr('width') || !$el.attr('height')) bad.push(`${src}: no width/height`);
    });
    assert.deepEqual(bad, []);
  });

  test(`${t.slug}: the accent routes through the brand tokens`, () => {
    const css = t.$('style').text();
    const missing = BRAND_TOKENS.flatMap((token) => {
      const out: string[] = [];
      if (!new RegExp(`${token}\\s*:`).test(css)) out.push(`:root does not define ${token}`);
      else if (!new RegExp(`var\\(\\s*${token}`).test(css)) out.push(`${token} is defined but never used`);
      return out;
    });
    assertOrPending(t.slug, missing, 'brand token(s) missing');
  });

  test(`${t.slug}: no claim in <main> text outside a [data-slot]`, () => {
    assertOrPending(t.slug, unslottedClaims(t.$), 'claim-bearing text node(s) in <main> outside a [data-slot]');
  });
}

/**
 * Text nodes in `<main>` with no `[data-slot]` ancestor that carry a number or a hard claim.
 * Returns a human-readable list, because this test's failure output is the annotation work order.
 */
function unslottedClaims($: CheerioAPI): string[] {
  const out: string[] = [];
  const main = $('main');
  if (!main.length) return out;
  for (const node of main.find('*').contents().toArray()) {
    if ((node as { type?: string }).type !== 'text') continue;
    const text = $(node).text().trim();
    if (!text) continue;
    const parent = $(node).parent();
    if (parent.closest('[data-slot]').length) continue;
    // Element attributes are a separate concern; only visible text can leak a fact.
    if (parent.is('script, style')) continue;
    const claims = findClaims(text);
    if (!claims.numbers.length && !claims.hard.length) continue;
    const where = parent.get(0) ? (parent.get(0) as { tagName?: string }).tagName ?? '?' : '?';
    const what = [...claims.numbers, ...claims.hard].join(' | ');
    out.push(`<${where}> [${what}] ${text.slice(0, 90)}${text.length > 90 ? '…' : ''}`);
  }
  return out;
}
