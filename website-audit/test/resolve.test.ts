import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideHome, detectSplash } from '../src/steps/resolve.js';
import { fixture } from './helpers.js';

const longFooter = `<footer>${'lorem ipsum dolor sit amet '.repeat(60)}</footer>`;
const splashHtml = `<!doctype html><html><head><title>Choose</title>
<link rel="alternate" hreflang="en-us" href="/us/"><link rel="alternate" hreflang="fr-ca" href="/ca-fr/">
</head><body><nav>${'nav item '.repeat(40)}</nav>
<main><h1>Choose your region</h1><a href="/us/">United States</a><a href="/ca/">Canada</a><a href="/uk/">United Kingdom</a><a href="/fr/">Français</a></main>
${longFooter}</body></html>`;

test('detectSplash ignores nav/header/footer text and flags a region chooser', () => {
  const s = detectSplash(splashHtml);
  assert.equal(s.isSplash, true);
  assert.ok(s.words < 20, `words=${s.words}`);
  assert.ok(s.regionLinks >= 3);
  assert.equal(s.hreflang, 2);
});

test('detectSplash is false for a real page and for a short page without region links', () => {
  assert.equal(detectSplash(fixture('pages/landscaping-good.html')).isSplash, false);
  assert.equal(detectSplash('<html><body><main><h1>Hi</h1><p>Short page.</p><a href="/x">Read more</a></main></body></html>').isSplash, false);
});

const base = { rootStatus: 200, rootScrapeError: null, splash: { isSplash: false, words: 500, regionLinks: 0, hreflang: 0 }, inputHostDiffers: false, hasCandidates: true };

test('decideHome: root-2xx when nothing fires', () => {
  const d = decideHome(base);
  assert.deepEqual(d, { rules_fired: [], needs_chooser: false, home_rule: 'root-2xx', reason: 'root responded 2xx and looks like a real page' });
});

test('decideHome: precedence root-non-2xx > host-mismatch > splash-detected, all fired rules recorded', () => {
  const all = decideHome({ ...base, rootStatus: 404, inputHostDiffers: true, splash: { isSplash: true, words: 10, regionLinks: 3, hreflang: 0 } });
  assert.equal(all.home_rule, 'root-non-2xx');
  assert.deepEqual(all.rules_fired, ['root-non-2xx', 'host-mismatch', 'splash-detected']);
  assert.equal(all.needs_chooser, true);
  assert.match(all.reason, /404/);
  const hm = decideHome({ ...base, inputHostDiffers: true, splash: { isSplash: true, words: 10, regionLinks: 3, hreflang: 0 } });
  assert.equal(hm.home_rule, 'host-mismatch');
  assert.deepEqual(hm.rules_fired, ['host-mismatch', 'splash-detected']);
  const sp = decideHome({ ...base, splash: { isSplash: true, words: 10, regionLinks: 3, hreflang: 0 } });
  assert.equal(sp.home_rule, 'splash-detected');
  assert.match(sp.reason, /10 words, 3 region links/);
  const err = decideHome({ ...base, rootStatus: null, rootScrapeError: 'timeout' });
  assert.equal(err.home_rule, 'root-non-2xx');
  assert.match(err.reason, /timeout/);
});

test('decideHome: input-page-fallback when a rule fires but nothing can be chosen', () => {
  const d = decideHome({ ...base, rootStatus: 500, hasCandidates: false });
  assert.equal(d.home_rule, 'input-page-fallback');
  assert.equal(d.needs_chooser, false);
  assert.deepEqual(d.rules_fired, ['root-non-2xx']);
  assert.match(d.reason, /no mapped URLs/);
});
