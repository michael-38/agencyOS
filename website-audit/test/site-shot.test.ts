// site:shot — the outreach images. Real Chromium, real compositing, no API calls.
//
// The test that matters is the last one: a prospect is sent a picture of their current home page
// beside the rebuilt one, and both halves have to be the same width and the same crop, or the
// comparison is making an argument the pixels do not support.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VIEWPORTS } from '../src/config.js';
import { beforeShots, siteShot } from '../src/site/shot.js';
import { tmpDir } from './helpers.js';
import { fixtureReport, item } from './site-helpers.js';

/** A solid PNG standing in for a Firecrawl screenshot of the audited site. */
async function png(file: string, width: number, height: number, colour: string): Promise<void> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: colour } }).png().toFile(file);
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Example Yard Co</title>
<style>body{margin:0;font:16px/1.5 Helvetica,Arial,sans-serif}main{height:2200px;background:#1f6f43;color:#fff;padding:24px}</style>
</head><body>
<div class="notice" data-placeholder-notice role="status">Preview: unverified copy.</div>
<main><h1>Garden care in Riverton</h1><p data-copy-id="p001" data-copy="placeholder">Placeholder sentence.</p></main>
</body></html>`;

/** A run directory with a built page and the audit's own screenshots of the original site. */
async function seed(opts: { before?: boolean } = {}): Promise<{ runDir: string; siteDir: string }> {
  const runDir = tmpDir('siteshot-');
  const siteDir = path.join(runDir, 'site');
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'index.html'), PAGE);
  const report = fixtureReport([item('tel-link')]);
  report.pages = [
    {
      url: 'https://example.test/',
      role: 'home',
      page_key: 'aaa',
      markdown_path: null,
      html_path: null,
      judge_text_path: null,
      judge_text_stats: null,
      screenshots: opts.before === false
        ? { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] }
        : {
            mobile: 'raw/pages/aaa/mobile.png',
            desktop: 'raw/pages/aaa/desktop.png',
            mobile_fold: 'raw/pages/aaa/mobile.fold.png',
            desktop_fold: 'raw/pages/aaa/desktop.fold.png',
            mobile_tiles: [],
          },
      status_code: 200,
    },
  ];
  if (opts.before !== false) {
    await png(path.join(runDir, 'raw/pages/aaa/mobile.png'), VIEWPORTS.mobile.width, 4000, '#b91c1c');
    await png(path.join(runDir, 'raw/pages/aaa/mobile.fold.png'), VIEWPORTS.mobile.width, VIEWPORTS.mobile.height, '#b91c1c');
    await png(path.join(runDir, 'raw/pages/aaa/desktop.png'), VIEWPORTS.desktop.width, 3000, '#b91c1c');
    await png(path.join(runDir, 'raw/pages/aaa/desktop.fold.png'), VIEWPORTS.desktop.width, VIEWPORTS.desktop.height, '#b91c1c');
  }
  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  return { runDir, siteDir };
}

/** Chromium is a 94MB download, so a checkout that has not run `npm run shots:setup` skips these. */
async function chromiumInstalled(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch();
    await b.close();
    return true;
  } catch {
    return false;
  }
}

test('the audit\'s own home-page screenshots are what the comparison uses', async () => {
  const { runDir } = await seed();
  const before = beforeShots(path.join(runDir, 'report.json'));
  assert.ok(before);
  assert.equal(before.host, 'example.test');
  assert.ok(before.mobile?.endsWith('mobile.fold.png'), 'the fold is preferred over the full-page shot');
  assert.ok(before.desktop?.endsWith('desktop.fold.png'));
});

test('a run with no screenshots of the original yields no before/after, rather than half of one', async () => {
  const { runDir } = await seed({ before: false });
  const before = beforeShots(path.join(runDir, 'report.json'));
  assert.equal(before?.mobile, null);
  assert.equal(before?.desktop, null);
  assert.equal(beforeShots(path.join(runDir, 'nope.json')), null);
});

test('site:shot writes a full-page shot, a fold shot, and a before/after per viewport', async (t) => {
  if (!(await chromiumInstalled())) return t.skip('chromium is not installed — run `npm run shots:setup`');
  const { runDir, siteDir } = await seed();
  const res = await siteShot({
    dir: siteDir,
    reportPath: path.join(runDir, 'report.json'),
    outDir: path.join(siteDir, 'shots'),
    viewports: ['mobile'],
    compare: true,
    scale: 2,
    hideNotice: false,
  });

  const names = res.files.map((f) => path.basename(f));
  assert.deepEqual(names, ['after-mobile.png', 'after-mobile-fold.png', 'before-after-mobile.png']);
  for (const f of res.files) assert.ok(fs.statSync(f).size > 0);

  const fold = await sharp(path.join(siteDir, 'shots', 'after-mobile-fold.png')).metadata();
  assert.equal(fold.width, VIEWPORTS.mobile.width * 2, 'the standalone shot is retina');
  assert.equal(fold.height, VIEWPORTS.mobile.height * 2);

  const full = await sharp(path.join(siteDir, 'shots', 'after-mobile.png')).metadata();
  assert.ok((full.height ?? 0) > (fold.height ?? 0), 'the full-page shot scrolls past the fold');
});

test('both halves of the comparison are the same size, so the picture is not making the argument', async (t) => {
  if (!(await chromiumInstalled())) return t.skip('chromium is not installed — run `npm run shots:setup`');
  const { runDir, siteDir } = await seed();
  await siteShot({
    dir: siteDir,
    reportPath: path.join(runDir, 'report.json'),
    outDir: path.join(siteDir, 'shots'),
    viewports: ['mobile'],
    compare: true,
    scale: 2,
    hideNotice: false,
  });

  const { width, height } = VIEWPORTS.mobile;
  const meta = await sharp(path.join(siteDir, 'shots', 'before-after-mobile.png')).metadata();
  // 20px padding each side, two columns at the viewport width, a 24px gutter, a 48px label strip.
  assert.equal(meta.width, 20 * 2 + width * 2 + 24);
  assert.equal(meta.height, 20 * 2 + 48 + height);
});

test('placeholder copy is reported whether or not the banner is in the image', async (t) => {
  if (!(await chromiumInstalled())) return t.skip('chromium is not installed — run `npm run shots:setup`');
  const { runDir, siteDir } = await seed();
  const shown = await siteShot({ dir: siteDir, reportPath: path.join(runDir, 'report.json'), outDir: path.join(siteDir, 'a'), viewports: ['mobile'], compare: false, scale: 1, hideNotice: false });
  assert.ok(shown.notes.some((n) => n.includes('1 placeholder block(s)') && n.includes('The banner naming them is in after-mobile.png')));

  const hidden = await siteShot({ dir: siteDir, reportPath: path.join(runDir, 'report.json'), outDir: path.join(siteDir, 'b'), viewports: ['mobile'], compare: false, scale: 1, hideNotice: true });
  assert.ok(hidden.notes.some((n) => n.includes('nothing in the image says so')), `notes were ${JSON.stringify(hidden.notes)}`);
});

test('the comparison never carries the QA banner, so the rebuild is judged on its design', async (t) => {
  if (!(await chromiumInstalled())) return t.skip('chromium is not installed — run `npm run shots:setup`');
  const { runDir, siteDir } = await seed();
  const out = path.join(siteDir, 'shots');
  await siteShot({ dir: siteDir, reportPath: path.join(runDir, 'report.json'), outDir: out, viewports: ['mobile'], compare: true, scale: 1, hideNotice: false });

  const { width, height } = VIEWPORTS.mobile;
  // The banner is the only cream-coloured thing on the page; the fixture's own body is green. Sample
  // the top-left of the "after" column: with the banner shown it would be cream, without it green.
  const col = await sharp(path.join(out, 'before-after-mobile.png'))
    .extract({ left: 20 + width + 24 + 8, top: 20 + 48 + 8, width: 4, height: 4 })
    .raw()
    .toBuffer();
  assert.deepEqual([col[0], col[1], col[2]], [0x1f, 0x6f, 0x43], 'the after column should start with the page, not the banner');

  const standalone = await sharp(path.join(out, 'after-mobile-fold.png')).extract({ left: 8, top: 8, width: 4, height: 4 }).raw().toBuffer();
  assert.notDeepEqual([standalone[0], standalone[1], standalone[2]], [0x1f, 0x6f, 0x43], 'the standalone shot keeps the banner');
  assert.ok(height > 0);
});
