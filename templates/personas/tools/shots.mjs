#!/usr/bin/env node
// Full-page screenshots of every persona home page, mobile and desktop, for eyeballing the
// designs. Uses the Playwright already installed for website-audit; run it from anywhere.
//
//   node tools/shots.mjs [outDir] [port]     → <outDir>/<slug>-{mobile,desktop}.png
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '../..');
const require = createRequire(path.join(REPO, 'website-audit', 'package.json'));
const { chromium } = require('playwright');

const OUT = path.resolve(process.argv[2] || path.join(REPO, '.context/persona-shots'));
const PORT = Number(process.argv[3] || 8131);
const SCALE = Number(process.env.SHOT_SCALE || 1);
const SCHEME = process.env.SHOT_SCHEME || 'light';
const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE },
};

fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
const slugs = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).sort();

try {
  await new Promise((r) => setTimeout(r, 400));
  const browser = await chromium.launch();
  for (const slug of slugs) {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ ...vp, reducedMotion: 'reduce', colorScheme: SCHEME });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${slug}/`, { waitUntil: 'load' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const file = path.join(OUT, `${slug}-${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
      await ctx.close();
    }
  }
  await browser.close();
} finally {
  server.kill();
}
