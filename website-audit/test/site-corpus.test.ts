import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCorpus, dropRepeatedBlocks, firstH1, headingsOf } from '../src/site/corpus.js';
import { tmpDir } from './helpers.js';
import { fixtureReport } from './site-helpers.js';

test('blocks repeated inside one page are dropped after their first appearance', () => {
  const nav = 'Landscaping | Design | Paver Install | Commercial | Locations | More';
  const md = `# Title\n\n${nav}\n\nReal content that only appears once.\n\n${nav}\n\nMore real content.`;
  const r = dropRepeatedBlocks(md);
  assert.equal(r.removedBlocks, 1);
  assert.equal(r.text.split(nav).length - 1, 1, 'the nav survives exactly once');
  assert.ok(r.text.includes('Real content that only appears once.'));
  assert.ok(r.text.includes('More real content.'));
});

test('short repeated blocks are kept, because repetition there is usually meaningful', () => {
  const md = 'Call 801-555-0100\n\nSome body copy here.\n\nCall 801-555-0100';
  const r = dropRepeatedBlocks(md);
  assert.equal(r.removedBlocks, 0);
});

test('repeated headings are never dropped', () => {
  const md = '## Services\n\nbody one\n\n## Services\n\nbody two';
  assert.equal(dropRepeatedBlocks(md, 1).removedBlocks, 0);
});

test('headings and the page title are read out of the markdown', () => {
  const md = '# Green Acres\n\nintro\n\n## Services\n\n### Mowing\n\nbody';
  assert.deepEqual(headingsOf(md), ['# Green Acres', '## Services', '### Mowing']);
  assert.equal(firstH1(md), 'Green Acres');
  assert.equal(firstH1('no heading here'), null);
});

test('buildCorpus reads every page with saved markdown and skips the ones without', () => {
  const dir = tmpDir('siteredesign-corpus-');
  fs.mkdirSync(path.join(dir, 'raw', 'pages', 'aaa'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw', 'pages', 'aaa', 'page.md'), '# Home\n\n[Services](https://example.test/services)\n\nWe mow lawns.');
  const report = fixtureReport();
  report.pages = [
    { url: 'https://example.test/', role: 'home', page_key: 'aaa', markdown_path: 'raw/pages/aaa/page.md', html_path: null, judge_text_path: null, judge_text_stats: null, screenshots: { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] }, status_code: 200 },
    { url: 'https://example.test/gone', role: 'candidate', page_key: 'bbb', markdown_path: 'raw/pages/bbb/page.md', html_path: null, judge_text_path: null, judge_text_stats: null, screenshots: { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] }, status_code: 200 },
  ];
  const corpus = buildCorpus(report, dir, { maxCharsPerPage: 0 });
  assert.equal(corpus.pages.length, 1, 'a page whose markdown never landed on disk is skipped, not faked');
  assert.equal(corpus.pages[0].title, 'Home');
  assert.ok(corpus.pages[0].text.includes('[Services]'), 'link text survives');
  assert.ok(!corpus.pages[0].text.includes('https://example.test/services'), 'link targets are stripped');
});
