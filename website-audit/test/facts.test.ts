import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts } from '../src/checks/facts.js';
import { pageCtx, probeFixture } from './helpers.js';

test('facts from JSON-LD + tel links + nav (landscaping-good)', () => {
  const f = extractFacts(pageCtx('landscaping-good', { probe: true }), probeFixture('landscaping-good').navText);
  assert.equal(f.business_name, 'Green Acres Lawn Care');
  assert.equal(f.sources.business_name, 'jsonld');
  assert.ok(f.phones.includes('+12085550142'));
  assert.equal(f.sources.phones, 'tel-links');
  assert.equal(typeof f.address, 'object');
  assert.equal((f.address as { streetAddress: string }).streetAddress, '410 Orchard St');
  assert.equal(f.sources.address, 'jsonld');
  assert.deepEqual(f.hours, ['Mo-Fr 07:00-18:00', 'Sa 08:00-14:00']);
  assert.ok(f.services.includes('Lawn care'));
  assert.ok(f.services.includes('Patios & hardscaping'));
  for (const noise of ['Home', 'Contact', 'FAQ']) assert.ok(!f.services.includes(noise), noise);
});

test('facts fall back to og:site_name / title, <address>, hours regex (plumbing, generic)', () => {
  const p = extractFacts(pageCtx('plumbing-booking', { probe: true }), probeFixture('plumbing-booking').navText);
  assert.equal(p.business_name, 'Tacoma Plumbing Co.');
  assert.ok(p.phones.includes('+12535550188'));
  assert.equal(p.address, '2214 Pacific Ave, Tacoma, WA 98402');
  assert.equal(p.sources.address, 'address-element');
  assert.equal(p.sources.hours, 'regex');
  assert.match(String(p.hours), /Mon/);
  assert.ok(!p.services.some((s) => /book online/i.test(s)), 'booking CTA is not a service');

  const g = extractFacts(pageCtx('generic-weak', { probe: true }), []);
  assert.equal(g.business_name, 'Welcome to our website');
  assert.equal(g.sources.business_name, 'title');
  assert.deepEqual(g.phones, []);
  assert.equal(g.address, null);
  assert.equal(g.hours, null);
});

test('tel: hrefs with slashes are normalized and phone-like nav entries are not services', () => {
  const ctx = pageCtx('landscaping-good');
  ctx.rawHtml = ctx.rawHtml.replace('href="tel:+12085550142"', 'href="tel://8005550100"');
  const f = extractFacts(ctx, ['Call Now: (816) 804-3318', 'Gallery', 'Design & Build']);
  assert.ok(f.phones.includes('8005550100'));
  assert.ok(!f.phones.some((p) => p.startsWith('/')));
  assert.ok(!f.services.some((s) => /804-3318/.test(s)));
  assert.ok(!f.services.includes('Gallery'));
  assert.ok(f.services.includes('Design & Build'));
});

test('page chrome is kept out of facts.services, because validate.ts treats them as claims', () => {
  // validate.ts's buildAllowedClaims reads facts.services as things the source site says, so
  // "Skip to content" in this array widens what generated copy is allowed to state.
  const ctx = pageCtx('landscaping-good', { probe: true });
  const nav = [
    'Skip to content',
    'Landscaping',
    'Paver Install',
    'More',
    'Employment',
    'Partners',
    'Accessibility',
    'REQUEST CONSULTATION',
    'Areas We Serve',
    'Hours of Operation',
    'landscaping',
  ];
  const f = extractFacts(ctx, nav);

  for (const chrome of ['Skip to content', 'More', 'Employment', 'Partners', 'Accessibility', 'Areas We Serve', 'Hours of Operation']) {
    assert.ok(!f.services.includes(chrome), `chrome survived: ${chrome}`);
  }
  assert.ok(!f.services.some((s) => s === 'REQUEST CONSULTATION'), 'a shouted multi-word string is a button, not a service');
  assert.ok(f.services.includes('Landscaping'), 'a real service must survive');
  assert.ok(f.services.includes('Paver Install'));
  // Case-insensitive dedupe, first spelling wins.
  assert.equal(f.services.filter((s) => s.toLowerCase() === 'landscaping').length, 1);
  assert.ok(!f.services.includes('landscaping'));
});

test('a heading long enough to be a sentence is not a service name', () => {
  const f = extractFacts(pageCtx('landscaping-good', { probe: true }), ['Exceptional Landscaping in Northern and Southern Utah']);
  assert.ok(!f.services.includes('Exceptional Landscaping in Northern and Southern Utah'));
});

test('emails come from mailto: and JSON-LD only, percent-decoded', () => {
  const ctx = pageCtx('landscaping-good', { probe: true });
  ctx.rawHtml =
    '<!doctype html><html lang="en"><body>' +
    // A percent-encoded leading space is common in the wild and is not part of the address.
    '<a href="mailto:%20office@example.com">Email</a>' +
    '<a href="mailto:sales@example.com?subject=Hi">Sales</a>' +
    '<a href="mailto:not-an-address">Broken</a>' +
    '<a href="mailto:%E0%A4%A">Malformed</a>' +
    // A plain-text address is deliberately ignored: obfuscated and third-party addresses live there.
    '<p>reception@example.com</p>' +
    '</body></html>';
  ctx._$ = undefined;
  ctx._jsonld = undefined;
  const f = extractFacts(ctx);
  assert.deepEqual(f.emails, ['office@example.com', 'sales@example.com']);
  assert.equal(f.sources.emails, 'mailto-links');
});

test('no mailto anywhere means no email, not a guess', () => {
  const ctx = pageCtx('landscaping-good', { probe: true });
  ctx.rawHtml = '<!doctype html><html lang="en"><body><p>Call us.</p></body></html>';
  ctx._$ = undefined;
  ctx._jsonld = undefined;
  assert.deepEqual(extractFacts(ctx).emails, []);
});
