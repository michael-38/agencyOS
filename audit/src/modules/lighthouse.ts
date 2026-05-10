import fs from 'fs';
import path from 'path';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';

interface LighthouseRun {
  formFactor: 'mobile' | 'desktop';
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  failedAudits: { id: string; title: string; description: string; score: number | null; displayValue?: string }[];
}

async function runLighthouse(url: string, formFactor: 'mobile' | 'desktop'): Promise<LighthouseRun> {
  const chromeLauncher = await import('chrome-launcher');
  const lighthouseModule: any = await import('lighthouse');
  const lighthouse = lighthouseModule.default || lighthouseModule;

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const config: any = {
      extends: 'lighthouse:default',
      settings: {
        formFactor,
        screenEmulation:
          formFactor === 'desktop'
            ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
            : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        throttling:
          formFactor === 'desktop'
            ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 }
            : undefined,
        emulatedUserAgent:
          formFactor === 'desktop'
            ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            : undefined,
      },
    };

    const runnerResult = await lighthouse(
      url,
      { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] },
      config
    );

    const lhr = runnerResult.lhr;
    const cats = lhr.categories;
    const audits = lhr.audits;

    const failedAudits: LighthouseRun['failedAudits'] = [];
    for (const id of Object.keys(audits)) {
      const a = audits[id];
      if (a.score === null) continue;
      if (a.score < 0.9) {
        failedAudits.push({
          id,
          title: a.title,
          description: a.description?.split('[')[0]?.trim() || '',
          score: a.score,
          displayValue: a.displayValue,
        });
      }
    }

    return {
      formFactor,
      scores: {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
      },
      failedAudits,
    };
  } finally {
    await chrome.kill();
  }
}

function severityForScore(score: number): Severity {
  if (score < 0.5) return 'high';
  if (score < 0.75) return 'medium';
  return 'low';
}

export async function runLighthouseModule(url: string, rawDir: string): Promise<ModuleResult<{ mobile: LighthouseRun; desktop: LighthouseRun }>> {
  const start = Date.now();
  try {
    const [mobile, desktop] = await Promise.all([runLighthouse(url, 'mobile'), runLighthouse(url, 'desktop')]);

    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'lighthouse-mobile.json'), JSON.stringify(mobile, null, 2));
    fs.writeFileSync(path.join(rawDir, 'lighthouse-desktop.json'), JSON.stringify(desktop, null, 2));

    const issues: Issue[] = [];
    const seen = new Set<string>();

    for (const run of [mobile, desktop]) {
      for (const audit of run.failedAudits) {
        const key = `${run.formFactor}:${audit.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          severity: severityForScore(audit.score ?? 1),
          title: `${run.formFactor === 'mobile' ? '📱' : '🖥'} ${audit.title}`,
          description: audit.description || '',
          quickFix: audit.displayValue ? `Current: ${audit.displayValue}` : undefined,
          evidence: audit.id,
        });
      }
    }

    const overallScore = Math.round(
      (mobile.scores.performance +
        mobile.scores.accessibility +
        mobile.scores.bestPractices +
        mobile.scores.seo +
        desktop.scores.performance +
        desktop.scores.accessibility +
        desktop.scores.bestPractices +
        desktop.scores.seo) /
        8
    );

    return {
      id: 'lighthouse',
      label: 'Lighthouse',
      status: 'ok',
      score: overallScore,
      summary: `Mobile perf ${mobile.scores.performance}, desktop perf ${desktop.scores.performance}. ${issues.length} audit(s) below 90.`,
      issues: sortIssues(issues),
      evidence: { mobile, desktop },
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'lighthouse',
      label: 'Lighthouse',
      status: 'error',
      score: null,
      summary: 'Lighthouse run failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  }
}
