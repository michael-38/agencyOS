// site:shot — turn a generated page into the images an outreach email actually carries.
//
// This is deliberately a screenshot of real HTML rather than a generated mockup image. A mockup image
// would have to invent its own text, which is exactly what the fabrication gate in validate.ts exists
// to prevent, and it would be thrown away the moment the prospect says yes. Screenshotting the built
// page keeps one artifact doing both jobs.
//
// The comparison image uses the fold, not the full page: a 7,700px-tall "before" beside a differently
// tall "after" is unreadable at email size, and the first screen is what the audit judges anyway.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VIEWPORTS } from '../config.js';
import type { Report } from '../report/schema.js';

export type ShotViewport = keyof typeof VIEWPORTS;

export interface ShotOptions {
  /** Directory holding the built index.html. */
  dir: string;
  /** The run's report.json, read for the audited site's own "before" screenshots. */
  reportPath: string | null;
  outDir: string;
  viewports: ShotViewport[];
  /** Also write the before/after comparison, when the run has a home-page screenshot. */
  compare: boolean;
  /** Device pixel ratio for the generated page. 2 is what a retina mail client wants. */
  scale: number;
  /**
   * Drop the unverified-copy banner from the standalone `after-*.png` shots. Off by default, so the
   * record of what was built shows what was built. The before/after comparison never carries the
   * banner regardless: it is an internal QA device, not part of the design, and on a 390px fold it
   * covers a quarter of the screen — including it would make the rebuild lose a comparison on the
   * strength of a label the finished site will not have.
   */
  hideNotice: boolean;
}

export interface ShotResult {
  files: string[];
  notes: string[];
}

const LABEL_H = 48;
const GUTTER = 24;
const PAD = 20;

/** A label strip rendered above one column of the comparison. */
function labelSvg(width: number, text: string, accent: string): Buffer {
  const safe = text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_H}">
      <rect width="${width}" height="${LABEL_H}" fill="#ffffff"/>
      <rect x="0" y="${LABEL_H - 3}" width="${width}" height="3" fill="${accent}"/>
      <text x="0" y="30" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#111827">${safe}</text>
    </svg>`,
  );
}

/** Home-page screenshots the audit already captured, if this run has them. */
export function beforeShots(reportPath: string | null): { mobile: string | null; desktop: string | null; host: string } | null {
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Report;
  const home = report.pages?.find((p) => p.role === 'home') ?? report.pages?.find((p) => p.role === 'root');
  if (!home) return null;
  const runDir = path.dirname(path.resolve(reportPath));
  const abs = (rel: string | null) => (rel && fs.existsSync(path.join(runDir, rel)) ? path.join(runDir, rel) : null);
  return {
    mobile: abs(home.screenshots.mobile_fold) ?? abs(home.screenshots.mobile),
    desktop: abs(home.screenshots.desktop_fold) ?? abs(home.screenshots.desktop),
    host: new URL(report.home_url).hostname,
  };
}

/**
 * Side-by-side, both columns at the viewport's own width so nothing is stretched, cropped to the
 * shorter of the two so neither side gets free white space the other does not.
 */
async function compose(o: { before: string; after: Buffer; width: number; height: number; beforeLabel: string; afterLabel: string; out: string }): Promise<void> {
  // `cover` + `top` crops the overhang off the bottom, which is what "the first screen" means. A
  // full-page shot passed in as a fallback is cropped to the fold here rather than squashed into it.
  const fit = (src: string | Buffer) => sharp(src).resize({ width: o.width, height: o.height, fit: 'cover', position: 'top', background: '#ffffff' }).png().toBuffer();
  const [beforeBuf, afterBuf] = await Promise.all([fit(o.before), fit(o.after)]);
  const totalW = PAD * 2 + o.width * 2 + GUTTER;
  const totalH = PAD * 2 + LABEL_H + o.height;
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: '#ffffff' } })
    .composite([
      { input: labelSvg(o.width, o.beforeLabel, '#9ca3af'), left: PAD, top: PAD },
      { input: labelSvg(o.width, o.afterLabel, '#1f6f43'), left: PAD + o.width + GUTTER, top: PAD },
      { input: beforeBuf, left: PAD, top: PAD + LABEL_H },
      { input: afterBuf, left: PAD + o.width + GUTTER, top: PAD + LABEL_H },
    ])
    .png()
    .toFile(o.out);
}

async function loadChromium(): Promise<typeof import('playwright').chromium> {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch {
    throw new Error('site:shot needs Playwright. Run `npm install` in website-audit/, then `npx playwright install chromium`.');
  }
}

export async function siteShot(o: ShotOptions): Promise<ShotResult> {
  const index = path.join(o.dir, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`${index} not found — run site:build first`);
  fs.mkdirSync(o.outDir, { recursive: true });

  const files: string[] = [];
  const notes: string[] = [];
  const before = o.compare ? beforeShots(o.reportPath) : null;
  if (o.compare && !before) notes.push('no before/after: the run has no home-page screenshot to compare against');

  const chromium = await loadChromium();
  const browser = await chromium.launch();
  try {
    for (const vp of o.viewports) {
      const size = VIEWPORTS[vp];
      const ctx = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: o.scale,
        // The page ships a reduced-motion branch; taking the shot inside it is what makes two runs of
        // this command produce byte-identical images instead of catching an animation mid-flight.
        reducedMotion: 'reduce',
        isMobile: vp === 'mobile',
        hasTouch: vp === 'mobile',
      });
      const page = await ctx.newPage();
      await page.goto(`file://${index}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready.then(() => true));
      const placeholders = await page.locator('[data-copy="placeholder"]').count();
      const hideNoticeCss = '[data-placeholder-notice]{display:none !important}';
      if (o.hideNotice) await page.addStyleTag({ content: hideNoticeCss });
      await page.waitForTimeout(250);

      const full = path.join(o.outDir, `after-${vp}.png`);
      await page.screenshot({ path: full, fullPage: true });
      files.push(full);
      const fold = path.join(o.outDir, `after-${vp}-fold.png`);
      await page.screenshot({ path: fold, fullPage: false });
      files.push(fold);

      if (placeholders) {
        notes.push(
          `${vp}: ${placeholders} placeholder block(s) are on this page — unverified copy. ${
            o.hideNotice ? 'You hid the banner, so nothing in the image says so.' : 'The banner naming them is in after-' + vp + '.png (pass --hide-notice to drop it).'
          } Read seo-report.md before sending this to anyone.`,
        );
      }

      const beforeFile = before?.[vp] ?? null;
      if (before && beforeFile) {
        if (!o.hideNotice) await page.addStyleTag({ content: hideNoticeCss });
        const afterFold = await page.screenshot({ fullPage: false });
        const out = path.join(o.outDir, `before-after-${vp}.png`);
        await compose({
          before: beforeFile,
          after: afterFold,
          width: size.width,
          height: size.height,
          beforeLabel: `Today — ${before.host}`,
          afterLabel: 'Rebuilt — preview',
          out,
        });
        files.push(out);
      } else if (before) {
        notes.push(`no before/after for ${vp}: the audit captured no ${vp} screenshot of the home page`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return { files, notes };
}
