import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
console.log('chrome launched on port', chrome.port);
try {
  const r = await lighthouse('https://example.com', {
    port: chrome.port,
    output: 'json',
    logLevel: 'info',
    onlyCategories: ['performance'],
  });
  console.log('result?', !!r, '  lhr?', !!r?.lhr, '  perf:', r?.lhr?.categories?.performance?.score);
} catch (e) {
  console.error('ERROR:', e.message);
  console.error(e.stack?.split('\n').slice(0, 8).join('\n'));
} finally {
  await chrome.kill();
}
