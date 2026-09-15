import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, REGISTERED_CHECK_IDS, REGISTRY, runCheck, type CheckResult } from '../src/checks/registry.js';
import type { Verdict } from '../src/personas/schema.js';
import { pageCtx } from './helpers.js';

const v = (name: string, id: string, probe = true): CheckResult => runCheck(id, pageCtx(name, { probe }));

test('registry: 16 checks, unique ids, unknown id throws', () => {
  assert.equal(CHECKS.length, 16);
  assert.equal(REGISTERED_CHECK_IDS.size, 16);
  assert.ok(REGISTRY.has('tel-link'));
  assert.throws(() => runCheck('nope', pageCtx('generic-weak')), /Unknown deterministic check/);
});

test('landscaping-good with probe: the strong page passes the things it should', () => {
  const expect: Record<string, Verdict> = {
    'tel-link': 'pass',
    'tel-link-above-fold': 'pass',
    'contact-form': 'pass',
    'booking-widget': 'partial',
    'jsonld-localbusiness': 'pass',
    'structured-data': 'pass',
    'review-markup': 'pass',
    'above-fold-images': 'pass',
    'sticky-mobile-cta': 'fail',
    'live-chat': 'fail',
    'single-h1': 'pass',
    'h2-structure': 'pass',
    'faq-present': 'pass',
    'meta-title-description': 'pass',
    'hours-present': 'pass',
    'address-present': 'pass',
  };
  for (const [id, verdict] of Object.entries(expect)) {
    const r = v('landscaping-good', id);
    assert.equal(r.verdict, verdict, `${id}: ${r.evidence.summary}`);
    assert.equal(r.evidence.method, 'deterministic');
    assert.ok(r.evidence.summary.length > 0);
  }
  assert.equal(v('landscaping-good', 'contact-form').evidence.values?.forms && (v('landscaping-good', 'contact-form').evidence.values!.forms as { fieldCount: number }[])[0].fieldCount, 3);
  assert.match(v('landscaping-good', 'review-markup').evidence.summary, /AggregateRating/);
  assert.match(v('landscaping-good', 'booking-widget').evidence.summary, /Get a free quote/);
});

test('plumbing-booking with probe: vendors from detectors.yaml, sticky bar, tel below the fold', () => {
  const expect: Record<string, Verdict> = {
    'tel-link': 'pass',
    'tel-link-above-fold': 'partial',
    'contact-form': 'fail',
    'booking-widget': 'pass',
    'jsonld-localbusiness': 'pass',
    'structured-data': 'pass',
    'review-markup': 'fail',
    'above-fold-images': 'partial',
    'sticky-mobile-cta': 'pass',
    'live-chat': 'pass',
    'single-h1': 'pass',
    'h2-structure': 'pass',
    'faq-present': 'partial',
    'meta-title-description': 'pass',
    'hours-present': 'pass',
    'address-present': 'pass',
  };
  for (const [id, verdict] of Object.entries(expect)) {
    const r = v('plumbing-booking', id);
    assert.equal(r.verdict, verdict, `${id}: ${r.evidence.summary}`);
  }
  assert.match(v('plumbing-booking', 'booking-widget').evidence.summary, /Housecall Pro/);
  assert.match(v('plumbing-booking', 'live-chat').evidence.summary, /Podium/);
  assert.match(v('plumbing-booking', 'address-present').evidence.summary, /2214 Pacific Ave/);
  assert.match(v('plumbing-booking', 'hours-present').evidence.summary, /Mon/i);
});

test('generic-weak with probe: the weak page fails or partials nearly everything', () => {
  const expect: Record<string, Verdict> = {
    'tel-link': 'fail',
    'tel-link-above-fold': 'fail',
    'contact-form': 'fail',
    'booking-widget': 'fail',
    'jsonld-localbusiness': 'fail',
    'structured-data': 'partial',
    'review-markup': 'partial',
    'above-fold-images': 'fail',
    'sticky-mobile-cta': 'fail',
    'live-chat': 'fail',
    'single-h1': 'partial',
    'h2-structure': 'fail',
    'faq-present': 'fail',
    'meta-title-description': 'fail',
    'hours-present': 'fail',
    'address-present': 'fail',
  };
  for (const [id, verdict] of Object.entries(expect)) {
    const r = v('generic-weak', id);
    assert.equal(r.verdict, verdict, `${id}: ${r.evidence.summary}`);
  }
  assert.match(v('generic-weak', 'structured-data').evidence.summary, /unparseable/);
  assert.match(v('generic-weak', 'jsonld-localbusiness').evidence.summary, /none parse/);
  assert.match(v('generic-weak', 'single-h1').evidence.summary, /2 H1s/);
  assert.match(v('generic-weak', 'meta-title-description').evidence.summary, /meta description missing/);
});

test('search-form-only: a role=search form is not a contact form', () => {
  assert.equal(v('search-form-only', 'contact-form', false).verdict, 'fail');
  assert.equal(v('search-form-only', 'meta-title-description', false).verdict, 'partial', 'title "Blog" is under 10 chars');
});

test('jsonld-localbusiness respects the archetype type and the subtype list', () => {
  const org = runCheck('jsonld-localbusiness', pageCtx('plumbing-booking', { jsonldType: 'Organization' }));
  assert.equal(org.verdict, 'pass', 'Plumber is an accepted subtype regardless of archetype');
  const ctx = pageCtx('plumbing-booking', { jsonldType: 'Organization' });
  ctx.detectors = { ...ctx.detectors, schema_org_local_business_subtypes: [] };
  const strict = runCheck('jsonld-localbusiness', ctx);
  assert.equal(strict.verdict, 'partial', 'JSON-LD present but not the expected type');
});

test('without a probe, layout checks never pass and are marked dom-order-fallback', () => {
  for (const id of ['tel-link-above-fold', 'above-fold-images', 'sticky-mobile-cta']) {
    assert.equal(REGISTRY.get(id)!.needsProbe, true, id);
    for (const page of ['landscaping-good', 'plumbing-booking', 'generic-weak']) {
      const r = v(page, id, false);
      assert.notEqual(r.verdict, 'pass', `${page}/${id} must not pass without a probe (${r.evidence.summary})`);
      if (r.verdict === 'partial') assert.equal(r.evidence.method, 'dom-order-fallback');
      assert.ok(r.note.length > 0);
    }
  }
  // The strong page still gets credit as partial via the DOM-order estimate.
  assert.equal(v('landscaping-good', 'tel-link-above-fold', false).verdict, 'partial');
  assert.equal(v('landscaping-good', 'above-fold-images', false).verdict, 'partial');
  // Probe with an error field behaves like no probe.
  const ctx = pageCtx('landscaping-good', { probe: true });
  ctx.probe = { probe_version: 2, error: 'boom' };
  const r = runCheck('tel-link-above-fold', ctx);
  assert.equal(r.evidence.method, 'dom-order-fallback');
});

test('non-layout checks give the same answer with and without a probe', () => {
  for (const def of CHECKS.filter((c) => !c.needsProbe)) {
    for (const page of ['landscaping-good', 'plumbing-booking', 'generic-weak']) {
      assert.equal(v(page, def.id, true).verdict, v(page, def.id, false).verdict, `${page}/${def.id}`);
    }
  }
});

test('every registered check has at least one pass and one non-pass across the fixtures', () => {
  const pages = ['landscaping-good', 'plumbing-booking', 'generic-weak', 'search-form-only'];
  for (const id of REGISTERED_CHECK_IDS) {
    const verdicts = pages.map((p) => v(p, id).verdict);
    assert.ok(verdicts.includes('pass'), `${id} never passes: ${verdicts.join(',')}`);
    assert.ok(verdicts.some((x) => x !== 'pass'), `${id} always passes: ${verdicts.join(',')}`);
  }
});

test('a crashing check is reported as fail with check-error, not thrown', () => {
  const ctx = pageCtx('generic-weak');
  // Force a crash: detectors without the regex the check dereferences.
  (ctx as unknown as { detectors: null }).detectors = null;
  const r = runCheck('booking-widget', ctx);
  assert.equal(r.verdict, 'fail');
  assert.equal(r.note, 'check-error');
});
