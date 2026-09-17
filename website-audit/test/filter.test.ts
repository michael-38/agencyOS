import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropHomeDuplicateBlocks, filterForJudge, homeLeanText, prepareJudgeText, stripLinkTargets } from '../src/content/filter.js';
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

test('stripLinkTargets: same-site targets drop, off-site targets keep the host, tel/mailto untouched, images keep alt', () => {
  const md = [
    '[Home](https://www.example.com/) · [Blog post](https://example.com/blog/x/#top) · [Anchor](#services) · [Rel](/about)',
    '[Get a Quote](https://clienthub.getjobber.com/client_hubs/abc/new?source=website "Quote")',
    '[(801) 555-0100](tel:+18015550100) [Email](mailto:hi@example.com)',
    '![Patio install in Orem](https://example.com/wp-content/uploads/patio.webp) ![](https://example.com/logo.svg)',
    '[![Logo](https://example.com/logo.svg)](https://example.com/)',
    '[](https://example.com/empty)',
    '[Grass Icon: https://streamlinehq.com\\\n    **Artificial Turf** \\\n    The grass is always green.](https://example.com/service/artificial-turf/)',
  ].join('\n\n');
  const r = stripLinkTargets(md, 'www.example.com');
  assert.ok(r.text.includes('[Home] · [Blog post] · [Anchor] · [Rel]'), r.text);
  assert.ok(r.text.includes('[Get a Quote](clienthub.getjobber.com)'), r.text);
  assert.ok(r.text.includes('[(801) 555-0100](tel:+18015550100) [Email](mailto:hi@example.com)'), r.text);
  assert.ok(r.text.includes('![Patio install in Orem]'), r.text);
  assert.ok(!r.text.includes('logo.svg'), r.text);
  assert.ok(r.text.includes('![Logo]') && !r.text.includes('[![Logo]]'), r.text);
  assert.ok(!r.text.includes('empty'), r.text);
  assert.ok(r.text.includes('**Artificial Turf**') && !r.text.includes('artificial-turf/'), r.text);
  assert.ok(!/https?:\/\/(www\.)?example\.com/.test(r.text), r.text);
  assert.equal(r.imagesStripped, 3);
  assert.equal(r.linksStripped, 8);
});

test('dropHomeDuplicateBlocks: verbatim long blocks go, short blocks and lone headings stay, order kept', () => {
  const nav = '- [Home]\n- [Services]\n- [About]\n- [Resources]\n- [Contact Us] [Get a Quote](clienthub.getjobber.com)';
  assert.ok(nav.length >= 60);
  const home = `${nav}\n\n# Welcome\n\nWe build yards.\n\n## Services\n\n${nav}`;
  const page = `${nav}\n\n## Services\n\nOur services page content that is unique to this page and long enough.\n\nSubmit\n\n${nav}`;
  const r = dropHomeDuplicateBlocks(page, home);
  assert.equal(r.text, '## Services\n\nOur services page content that is unique to this page and long enough.\n\nSubmit');
  assert.equal(r.removedBlocks, 2);
  assert.equal(r.removedChars, nav.length * 2);
});

test('prepareJudgeText: full equals filterForJudge; lean strips before dedup so per-page anchors still match; cap runs last', () => {
  const homeMd = 'Header: [Call us](https://example.com/#) · [Book](https://clienthub.getjobber.com/x) — free estimates for every yard in the valley.\n\n# Home\n\nHello.';
  const pageMd = 'Header: [Call us](https://example.com/about/#) · [Book](https://clienthub.getjobber.com/x) — free estimates for every yard in the valley.\n\n# About\n\n![](https://example.com/a.png)\n\nWe are a team.';
  const full = prepareJudgeText(pageMd, { maxChars: 10_000, mode: 'full', siteHost: 'example.com', homeLeanText: null });
  assert.equal(full.text, filterForJudge(pageMd, 10_000).text);
  assert.equal(full.stats.mode, 'full');
  assert.equal(full.stats.links_stripped, 0);
  assert.equal(full.stats.home_dup_blocks_removed, 0);

  const homeLean = homeLeanText(homeMd, 'example.com');
  const lean = prepareJudgeText(pageMd, { maxChars: 10_000, mode: 'lean', siteHost: 'example.com', homeLeanText: homeLean });
  assert.equal(lean.text, '# About\n\nWe are a team.');
  assert.equal(lean.stats.home_dup_blocks_removed, 1);
  assert.equal(lean.stats.links_stripped, 2);
  assert.equal(lean.stats.images_stripped, 1);
  assert.equal(lean.stats.chars_raw, pageMd.length);
  assert.equal(lean.stats.chars_sent, lean.text.length);
  assert.equal(lean.stats.truncated, false);

  const capped = prepareJudgeText(pageMd, { maxChars: 10, mode: 'lean', siteHost: 'example.com', homeLeanText: homeLean });
  assert.equal(capped.stats.truncated, true);
  assert.ok(capped.text.startsWith('# About'));
});
