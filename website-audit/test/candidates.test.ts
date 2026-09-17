import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidatePool } from '../src/steps/candidates.js';

test('top-level pages linked from home: document order, deduped, legal/asset/external dropped, home excluded', () => {
  const pool = buildCandidatePool(
    {
      url: 'https://uv-landscaping.com/',
      links: [
        'https://uv-landscaping.com/',
        'https://uv-landscaping.com/#brx-content',
        'https://uv-landscaping.com/services/',
        'https://uv-landscaping.com/service/artificial-turf/',
        'https://uv-landscaping.com/about/',
        'https://www.uv-landscaping.com/about',
        'https://uv-landscaping.com/privacy-policy/',
        'https://clienthub.getjobber.com/client_hubs/x/new',
        'https://uv-landscaping.com/wp-content/uploads/logo.svg',
        'https://uv-landscaping.com/resources/',
        'tel:+18018999199',
        'mailto:admin@uv-landscaping.com',
        'https://uv-landscaping.com/contact/',
        'https://uv-landscaping.com/about/?utm=x',
      ],
    },
    8,
  );
  assert.deepEqual(pool.urls, ['https://uv-landscaping.com/services', 'https://uv-landscaping.com/about', 'https://uv-landscaping.com/resources', 'https://uv-landscaping.com/contact']);
  assert.equal(pool.relative_depth, 1);
  assert.deepEqual(pool.capped, []);
  assert.equal(pool.cap, 8);
  assert.equal(pool.considered, 5);
  assert.equal(pool.rule, 'home-links-top-level');
});

test('depth is relative to the home path (Wix-style /my-site)', () => {
  const pool = buildCandidatePool(
    {
      url: 'https://bclawn03.wixsite.com/my-site',
      links: ['https://bclawn03.wixsite.com/my-site/about', 'https://bclawn03.wixsite.com/other-site/x', 'https://bclawn03.wixsite.com/my-site/services', 'https://bclawn03.wixsite.com/my-site'],
    },
    8,
  );
  assert.deepEqual(pool.urls, ['https://bclawn03.wixsite.com/my-site/about', 'https://bclawn03.wixsite.com/my-site/services']);
  assert.equal(pool.relative_depth, 1);
  assert.equal(pool.considered, 3);
});

test('falls back to the shallowest depth with at least two links when depth 1 is empty (Shopify-style /pages/*)', () => {
  const pool = buildCandidatePool(
    { url: 'https://shop.example.com/', links: ['https://shop.example.com/pages/about', 'https://shop.example.com/collections/all', 'https://shop.example.com/pages/contact', 'https://shop.example.com/products/a/b'] },
    8,
  );
  assert.deepEqual(pool.urls, ['https://shop.example.com/pages/about', 'https://shop.example.com/collections/all', 'https://shop.example.com/pages/contact']);
  assert.equal(pool.relative_depth, 2);
});

test('a single depth-1 link is kept when no deeper depth has two links', () => {
  const pool = buildCandidatePool({ url: 'https://example.com/', links: ['https://example.com/about', 'https://example.com/pages/x'] }, 8);
  assert.deepEqual(pool.urls, ['https://example.com/about']);
  assert.equal(pool.relative_depth, 1);
});

test('cap keeps the first N in document order and records the rest; cap 0 judges nothing', () => {
  const links = Array.from({ length: 10 }, (_, i) => `https://example.com/area-${i}`);
  const pool = buildCandidatePool({ url: 'https://example.com/', links }, 3);
  assert.deepEqual(pool.urls, links.slice(0, 3));
  assert.deepEqual(pool.capped, links.slice(3));
  assert.equal(pool.cap, 3);
  const none = buildCandidatePool({ url: 'https://example.com/', links }, 0);
  assert.deepEqual(none.urls, []);
  assert.equal(none.capped.length, 10);
});

test('no links or an unparsable home yields an empty pool', () => {
  assert.deepEqual(buildCandidatePool({ url: 'https://example.com/', links: [] }, 8).urls, []);
  const bad = buildCandidatePool({ url: 'not a url', links: ['https://example.com/a'] }, 8);
  assert.deepEqual(bad.urls, []);
  assert.equal(bad.considered, 0);
});
