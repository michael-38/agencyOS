#!/usr/bin/env node
// Accessibility audit in BOTH colour schemes. Lighthouse only exercises whichever scheme the
// headless browser happens to prefer, so dark mode would otherwise ship unverified.
//
//   node tools/axe.mjs [port]      → violations per page per scheme, exit 1 if any
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
const AXE = fs.readFileSync(path.join(REPO, '.context/lh/node_modules/axe-core/axe.min.js'), 'utf8');

const PORT = Number(process.argv[2] || 8190);
const slugs = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).sort();
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });

let failed = 0;
try {
  await new Promise((r) => setTimeout(r, 500));
  const browser = await chromium.launch();
  for (const slug of slugs) {
    const line = [];
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${slug}/`, { waitUntil: 'load' });
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () =>
        // wcag2aa is the bar the pages claim; best-practice rules are advisory and excluded.
        await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      const v = res.violations;
      line.push(`${scheme}: ${v.length ? v.map((x) => `${x.id}(${x.nodes.length})`).join(' ') : 'clean'}`);
      if (v.length) {
        failed += v.length;
        for (const x of v.slice(0, 3)) {
          process.stderr.write(`  ${slug} ${scheme} ${x.id}: ${x.nodes[0].failureSummary?.split('\n')[1]?.trim().slice(0, 120)}\n`);
        }
      }
      await ctx.close();
    }
    process.stdout.write(`${slug.padEnd(16)} ${line.join('   |   ')}\n`);
  }
  await browser.close();
} finally {
  server.kill();
}
process.stdout.write(failed ? `\n${failed} violation group(s)\n` : '\nno WCAG A/AA violations in either scheme\n');
process.exit(failed ? 1 : 0);
