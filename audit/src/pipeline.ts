import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import {
  AuditInput,
  AuditReport,
  BatchEntry,
  CLIOptions,
  ClinicInfo,
  ModuleId,
  ModuleResult,
} from './types.js';
import { log } from './utils/logger.js';
import { overallScore } from './utils/scoring.js';
import { slugForRun } from './utils/url.js';
import { scrapeSite } from './extractors/scrape.js';
import { extractClinicInfo } from './extractors/clinic-info.js';
import { captureScreenshots } from './extractors/screenshots.js';
import { runLighthouseModule } from './modules/lighthouse.js';
import { runSeoOnPageModule } from './modules/seo-onpage.js';
import { runSeoRankingModule } from './modules/seo-ranking.js';
import { runLlmCopyAeoModule } from './modules/llm-copy-aeo.js';
import { runLlmDiscoverabilityModule } from './modules/llm-discoverability.js';
import { runCopyConversionModule } from './modules/copy-conversion.js';
import { runDesignReviewModule } from './modules/design-review.js';
import { runUxMedspaModule } from './modules/ux-medspa.js';
import { renderReport, renderIndex } from './reporter/render.js';

const ALL_MODULES: ModuleId[] = [
  'lighthouse',
  'seo-onpage',
  'seo-ranking',
  'llm-copy-aeo',
  'llm-discoverability',
  'copy-conversion',
  'design-review',
  'ux-medspa',
];

function shouldRun(id: ModuleId, skip: ModuleId[]): boolean {
  return !skip.includes(id);
}

function skippedModule(id: ModuleId, label: string, reason: string): ModuleResult {
  return { id, label, status: 'skipped', score: null, summary: `Skipped — ${reason}.`, issues: [], skipReason: reason };
}

export async function runSingle(input: AuditInput, options: CLIOptions): Promise<AuditReport> {
  const startedAt = new Date().toISOString();
  const slug = slugForRun(input.url);
  const outputDir = path.resolve(options.output, slug);
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  log.header(`Auditing ${input.url}`);

  log.info('Scraping site (Firecrawl)…');
  const site = await scrapeSite(input.url);

  log.info('Extracting clinic info (Claude)…');
  const clinic: ClinicInfo = await extractClinicInfo(site, {
    name: input.nameOverride,
    city: input.cityOverride,
  });
  log.result('Name', clinic.name);
  log.result('City', clinic.city || '(unknown)');
  log.result('Services', clinic.services.slice(0, 5).join(', ') || '(none detected)');

  let screenshotsPromise: Promise<any> | null = null;
  if (shouldRun('design-review', options.skip)) {
    log.info('Capturing screenshots (Playwright)…');
    screenshotsPromise = captureScreenshots(input.url, rawDir).catch((err) => {
      log.warn(`Screenshots failed: ${err.message}`);
      return null;
    });
  }

  const moduleResults: ModuleResult[] = [];

  const tasks: Promise<ModuleResult>[] = [];

  if (shouldRun('lighthouse', options.skip)) {
    tasks.push(runLighthouseModule(input.url, rawDir));
  } else {
    moduleResults.push(skippedModule('lighthouse', 'Lighthouse', 'skipped via --skip'));
  }

  if (shouldRun('seo-onpage', options.skip)) {
    tasks.push(runSeoOnPageModule(site));
  } else {
    moduleResults.push(skippedModule('seo-onpage', 'SEO (on-page)', 'skipped via --skip'));
  }

  if (shouldRun('seo-ranking', options.skip)) {
    tasks.push(runSeoRankingModule(clinic, rawDir, options.keywords));
  } else {
    moduleResults.push(skippedModule('seo-ranking', 'SEO (Google rank)', 'skipped via --skip'));
  }

  if (shouldRun('llm-copy-aeo', options.skip)) {
    tasks.push(runLlmCopyAeoModule(site));
  } else {
    moduleResults.push(skippedModule('llm-copy-aeo', 'LLM copy / AEO', 'skipped via --skip'));
  }

  if (shouldRun('llm-discoverability', options.skip)) {
    tasks.push(runLlmDiscoverabilityModule(clinic, rawDir));
  } else {
    moduleResults.push(skippedModule('llm-discoverability', 'LLM discoverability', 'skipped via --skip'));
  }

  if (shouldRun('copy-conversion', options.skip)) {
    tasks.push(runCopyConversionModule(site, clinic));
  } else {
    moduleResults.push(skippedModule('copy-conversion', 'Copy & conversion', 'skipped via --skip'));
  }

  if (shouldRun('ux-medspa', options.skip)) {
    tasks.push(runUxMedspaModule(input.url));
  } else {
    moduleResults.push(skippedModule('ux-medspa', 'UX (med spa)', 'skipped via --skip'));
  }

  if (shouldRun('design-review', options.skip)) {
    tasks.push(
      (async () => {
        const shots = await screenshotsPromise;
        if (!shots) {
          return skippedModule('design-review', 'Design', 'screenshots unavailable');
        }
        return runDesignReviewModule(shots);
      })()
    );
  } else {
    moduleResults.push(skippedModule('design-review', 'Design', 'skipped via --skip'));
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === 'fulfilled') moduleResults.push(s.value);
    else log.error(`Module failed: ${s.reason?.message || s.reason}`);
  }

  // Sort modules into stable canonical order
  moduleResults.sort((a, b) => ALL_MODULES.indexOf(a.id) - ALL_MODULES.indexOf(b.id));

  // Console summary
  log.divider();
  for (const m of moduleResults) {
    log.module(m.id, m.score, m.status === 'ok' ? `${m.issues.length} issue(s)` : (m.skipReason || m.errorMessage || m.status));
  }

  const finishedAt = new Date().toISOString();
  const overall = overallScore(moduleResults);

  const report: AuditReport = {
    input,
    clinic,
    startedAt,
    finishedAt,
    overallScore: overall,
    modules: moduleResults,
    outputDir,
  };

  // Write artifacts
  fs.writeFileSync(path.join(outputDir, 'audit.json'), JSON.stringify(report, null, 2));
  const reportPath = await renderReport(report, outputDir);

  log.divider();
  log.success(`Overall score: ${overall}/100`);
  log.url('Report', reportPath);

  if (options.open && !options.batch) {
    const { spawn } = await import('child_process');
    spawn('open', [reportPath], { detached: true, stdio: 'ignore' }).unref();
  }

  return report;
}

export async function runBatch(inputs: AuditInput[], options: CLIOptions): Promise<BatchEntry[]> {
  const limit = pLimit(options.concurrency);
  const entries: BatchEntry[] = [];
  let done = 0;

  await Promise.all(
    inputs.map((input) =>
      limit(async () => {
        try {
          const report = await runSingle(input, options);
          const moduleScores: Record<string, number | null> = {};
          for (const m of report.modules) moduleScores[m.id] = m.score;
          entries.push({
            input,
            status: 'success',
            outputDir: report.outputDir,
            reportPath: path.join(report.outputDir, 'report.html'),
            overallScore: report.overallScore,
            clinic: report.clinic,
            moduleScores: moduleScores as any,
          });
        } catch (err: any) {
          log.error(`Failed ${input.url}: ${err.message}`);
          entries.push({ input, status: 'failed', errorMessage: err.message });
        } finally {
          done += 1;
          log.info(`Progress: ${done}/${inputs.length}`);
        }
      })
    )
  );

  if (options.index) {
    const indexPath = path.join(path.resolve(options.output), 'index.html');
    await renderIndex(entries, indexPath);
    log.url('Batch index', indexPath);
  }

  return entries;
}
