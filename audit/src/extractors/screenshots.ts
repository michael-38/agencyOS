import fs from 'fs';
import path from 'path';
import { chromium, Browser } from 'playwright';

export interface Screenshots {
  mobilePath: string;
  desktopPath: string;
  mobileBase64: string;
  desktopBase64: string;
}

export async function captureScreenshots(url: string, outDir: string): Promise<Screenshots> {
  fs.mkdirSync(outDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const mobilePath = path.join(outDir, 'screenshot-mobile.png');
    const desktopPath = path.join(outDir, 'screenshot-desktop.png');

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
    await mobilePage.screenshot({ path: mobilePath, fullPage: true });
    await mobileCtx.close();

    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopCtx.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({ path: desktopPath, fullPage: true });
    await desktopCtx.close();

    const mobileBase64 = fs.readFileSync(mobilePath).toString('base64');
    const desktopBase64 = fs.readFileSync(desktopPath).toString('base64');

    return { mobilePath, desktopPath, mobileBase64, desktopBase64 };
  } finally {
    await browser.close();
  }
}
