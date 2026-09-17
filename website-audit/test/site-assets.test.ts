import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { harvestImageUrls, STOCK_RE } from '../src/site/assets.js';
import { tmpDir } from './helpers.js';
import { fixtureReport } from './site-helpers.js';
import type { ReportPage } from '../src/report/schema.js';

function page(key: string, url: string, role: ReportPage['role'], html: string, dir: string): ReportPage {
  fs.mkdirSync(path.join(dir, 'raw', 'pages', key), { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw', 'pages', key, 'page.html'), html);
  return {
    url,
    role,
    page_key: key,
    markdown_path: null,
    html_path: `raw/pages/${key}/page.html`,
    judge_text_path: null,
    judge_text_stats: null,
    screenshots: { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] },
    status_code: 200,
  };
}

test('images are harvested from every saved page, absolutised, and deduped', () => {
  const dir = tmpDir('siteredesign-assets-');
  const report = fixtureReport();
  report.pages = [
    page(
      'aaa',
      'https://example.test/',
      'home',
      `<html><head><meta property="og:image" content="/og.jpg"><meta property="og:image:alt" content="Social"></head>
       <body><header><img src="logo.png" alt="Logo"></header>
       <img src="/photos/one.jpg" alt="One">
       <img src="data:image/gif;base64,R0lGOD" alt="inline">
       <img srcset="/photos/two-400.jpg 400w, /photos/two-1600.jpg 1600w" alt="Two">
       <img src="https://cdn.other.test/three.jpg" alt="Three">
       </body></html>`,
      dir,
    ),
    page('bbb', 'https://example.test/services/', 'candidate', '<html><body><img src="/photos/one.jpg" alt="One again"><img src="four.jpg" alt="Four"></body></html>', dir),
  ];
  const found = harvestImageUrls(report, dir);
  const urls = found.map((f) => f.url);
  assert.deepEqual(urls, [
    'https://example.test/og.jpg',
    'https://example.test/logo.png',
    'https://example.test/photos/one.jpg',
    'https://example.test/photos/two-1600.jpg',
    'https://cdn.other.test/three.jpg',
    'https://example.test/services/four.jpg',
  ]);
  assert.equal(found[0].isOgImage, true);
  assert.equal(found[0].alt, 'Social');
  assert.equal(found[1].hintedRole, 'logo', 'a filename containing "logo" is the brand mark, not a photograph');
  assert.equal(found[1].inHeader, true);
  assert.equal(found[3].url.includes('1600'), true, 'the widest srcset candidate wins');
  assert.equal(found[5].url, 'https://example.test/services/four.jpg', 'relative paths resolve against their own page');
});

test('a filename that only contains "logo" as a substring is still a logo', () => {
  const dir = tmpDir('siteredesign-assets2-');
  const report = fixtureReport();
  report.pages = [page('aaa', 'https://example.test/', 'home', '<img src="/OLogoMain_clr.png" alt=""><img src="/logos3.png" alt=""><img src="/patio.jpg" alt="Patio">', dir)];
  const found = harvestImageUrls(report, dir);
  assert.deepEqual(found.map((f) => f.hintedRole), ['logo', 'logo', null]);
});

test('a stock-library filename is recognised, whoever is hosting it', () => {
  const dir = tmpDir('siteredesign-assets3-');
  const report = fixtureReport();
  report.pages = [page('aaa', 'https://example.test/', 'home', '<img src="/wp-content/iStock-1289546495-1024x683.jpg" alt="Yard"><img src="/photos/our-crew.jpg" alt="Crew">', dir)];
  const found = harvestImageUrls(report, dir);
  assert.equal(STOCK_RE.test(found[0].url), true);
  assert.equal(STOCK_RE.test(found[1].url), false);
});
