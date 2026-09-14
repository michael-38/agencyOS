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
