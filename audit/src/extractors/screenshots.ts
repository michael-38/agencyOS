import fs from 'fs';
import path from 'path';
import { chromium, Browser, Page } from 'playwright';

export interface PageShots {
  label: 'home' | 'service' | 'booking';
  url: string;
  mobilePath: string;
  desktopPath: string;
  // Clipped JPEG variants under 7000 CSS-px tall so Claude vision can ingest them.
  mobileClippedBase64: string;
  desktopClippedBase64: string;
}

const MAX_VISION_HEIGHT = 7000;

async function shoot(page: Page, fullPath: string, deviceScale: number): Promise<string> {
  await page.screenshot({ path: fullPath, fullPage: true });

  const pageHeight: number = await page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
  );
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport set');

  const maxCssHeight = Math.floor(MAX_VISION_HEIGHT / deviceScale);
  const clipHeight = Math.min(pageHeight, maxCssHeight);

  const clippedBuffer = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    clip: { x: 0, y: 0, width: viewport.width, height: clipHeight },
  });
  return clippedBuffer.toString('base64');
}

async function captureOne(browser: Browser, url: string, label: PageShots['label'], outDir: string): Promise<PageShots> {
  const slug = label;
  const mobilePath = path.join(outDir, `screenshot-${slug}-mobile.png`);
  const desktopPath = path.join(outDir, `screenshot-${slug}-desktop.png`);

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await mobilePage.waitForTimeout(1500);
  const mobileClippedBase64 = await shoot(mobilePage, mobilePath, 2);
  await mobileCtx.close();

  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await desktopPage.waitForTimeout(1500);
  const desktopClippedBase64 = await shoot(desktopPage, desktopPath, 1);
  await desktopCtx.close();

  return { label, url, mobilePath, desktopPath, mobileClippedBase64, desktopClippedBase64 };
}

export interface ScreenshotTargets {
  home: string;
  service?: string;
  booking?: string;
}

export async function captureScreenshots(
  targets: ScreenshotTargets,
  outDir: string
): Promise<PageShots[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const out: PageShots[] = [];
    out.push(await captureOne(browser, targets.home, 'home', outDir));
    if (targets.service) {
      try {
        out.push(await captureOne(browser, targets.service, 'service', outDir));
      } catch {
        /* one inner-page failure must not kill the audit */
      }
    }
    if (targets.booking) {
      try {
        out.push(await captureOne(browser, targets.booking, 'booking', outDir));
      } catch {
        /* same */
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}
