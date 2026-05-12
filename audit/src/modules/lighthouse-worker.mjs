// Lighthouse worker — must run under plain `node`, not `tsx`.
// `tsx`'s loader interferes with Lighthouse's performance instrumentation
// ("start lh:runner:gather" mark never gets set).
//
// Usage: node lighthouse-worker.mjs <url> <mobile|desktop>
// Prints a single line of JSON to stdout: { ok: true, run } or { ok: false, error }
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.argv[2];
const formFactor = process.argv[3] || 'mobile';

if (!url) {
  console.log(JSON.stringify({ ok: false, error: 'Missing URL argument' }));
  process.exit(1);
}

let chrome;
try {
  chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  let config;
  if (formFactor === 'desktop') {
    const m = await import('lighthouse/core/config/desktop-config.js');
    config = m.default || m;
  }

  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    },
    config
  );

  if (!result || !result.lhr) {
    throw new Error('Lighthouse returned no result');
  }

  const lhr = result.lhr;
  const cats = lhr.categories;
  const audits = lhr.audits;

  const failedAudits = [];
  for (const id of Object.keys(audits)) {
    const a = audits[id];
    if (a.score === null) continue;
    if (a.score < 0.9) {
      failedAudits.push({
        id,
        title: a.title,
        description: (a.description || '').split('[')[0].trim(),
        score: a.score,
        displayValue: a.displayValue,
      });
    }
  }

  const run = {
    formFactor,
    scores: {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
    },
    failedAudits,
  };

  // Newline-delimited JSON sentinel keeps Lighthouse's stderr from polluting result parsing.
  process.stdout.write('\n__LH_RESULT__:' + JSON.stringify({ ok: true, run }) + '\n');
} catch (err) {
  process.stdout.write('\n__LH_RESULT__:' + JSON.stringify({ ok: false, error: err.message || String(err) }) + '\n');
} finally {
  if (chrome) await chrome.kill();
}
