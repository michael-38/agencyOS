import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetHref, depthOf, fileForPath, hrefBetween, markdownForPath, normalizeSitePath } from '../src/site/paths.js';

test('site paths map to the files they are written to', () => {
  assert.equal(fileForPath('/'), 'index.html');
  assert.equal(fileForPath('/faq/'), 'faq/index.html');
  assert.equal(fileForPath('/services/mowing/'), 'services/mowing/index.html');
  assert.equal(markdownForPath('/services/mowing/'), 'services/mowing/index.md');
  assert.equal(depthOf('/'), 0);
  assert.equal(depthOf('/services/mowing/'), 2);
});

test('planned paths are normalized, and unsafe ones are rejected', () => {
  assert.equal(normalizeSitePath('services/mowing'), '/services/mowing/');
  assert.equal(normalizeSitePath('/faq/index.html'), '/faq/');
  assert.equal(normalizeSitePath('//double//slash//'), '/double/slash/');
  assert.equal(normalizeSitePath('/'), '/');
  assert.equal(normalizeSitePath('/../etc/passwd'), null);
  assert.equal(normalizeSitePath('/Services/Mowing/'), null, 'uppercase is rejected rather than silently folded');
  assert.equal(normalizeSitePath(''), null);
});

test('mockup links are relative so the site opens over file://, production links are root-absolute', () => {
  assert.equal(hrefBetween('/services/mowing/', '/', 'mockup'), '../../index.html');
  assert.equal(hrefBetween('/', '/services/mowing/', 'mockup'), 'services/mowing/index.html');
  assert.equal(hrefBetween('/faq/', '/services/mowing/', 'mockup'), '../services/mowing/index.html');
  assert.equal(hrefBetween('/services/mowing/', '/', 'production'), '/');
  assert.equal(hrefBetween('/', '/faq/', 'production'), '/faq/');
});

test('asset links climb out of nested pages in the mockup profile', () => {
  assert.equal(assetHref('/', 'assets/site.css', 'mockup'), 'assets/site.css');
  assert.equal(assetHref('/services/mowing/', 'assets/site.css', 'mockup'), '../../assets/site.css');
  assert.equal(assetHref('/services/mowing/', 'assets/site.css', 'production'), '/assets/site.css');
});
