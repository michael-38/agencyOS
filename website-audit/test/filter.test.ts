import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterForJudge } from '../src/content/filter.js';
import { fixture } from './helpers.js';

test('legal sections, cookie banners, footer legal lines, and keyword-dense paragraphs are removed; content survives', () => {
  const md = fixture('markdown/legal-heavy.md');
  const r = filterForJudge(md, 100_000);
  for (const gone of ['Privacy policy', 'Cookies we set', 'We use cookies', 'data controller', '© 2024', 'All rights reserved', 'Analytics cookies']) {
    assert.ok(!r.text.includes(gone), `should be removed: ${gone}`);
  }
  for (const kept of ['# Green Acres Lawn Care', 'We mow, edge, and trim every week.', '## Our services', 'Weekly mowing, spring clean-up, and paver patio installation.', '## Contact', 'Call us any time.']) {
    assert.ok(r.text.includes(kept), `should be kept: ${kept}`);
  }
  assert.equal(r.removedBlocks, 4);
  assert.ok(r.removedChars > 200);
  assert.equal(r.truncated, false);
  // The kept text keeps its order.
  assert.ok(r.text.indexOf('## Our services') < r.text.indexOf('## Contact'));
});

test('a legal H2 swallows its H3 children but not the next H2', () => {
  const md = '## Terms of service\n\nlegal\n\n### Sub\n\nmore legal\n\n## Services\n\nreal content';
  const r = filterForJudge(md, 1000);
  assert.equal(r.text, '## Services\n\nreal content');
  assert.equal(r.removedBlocks, 1);
});

test('cap truncates with a marker and sets the flag', () => {
  const r = filterForJudge('word '.repeat(100), 50);
  assert.equal(r.truncated, true);
  assert.ok(r.text.includes('[… truncated at 50 characters …]'));
  assert.ok(r.text.startsWith('word word'));
});

test('clean markdown is returned unchanged apart from block normalization', () => {
  const md = '# Title\n\nHello there.\n\n## Services\n\nWe do things.';
  const r = filterForJudge(md, 1000);
  assert.equal(r.text, md);
  assert.equal(r.removedBlocks, 0);
  assert.equal(r.removedChars, 0);
});
