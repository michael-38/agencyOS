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
import { CostTracker } from './utils/cost.js';
import { scrapeSite, ScrapedPage } from './extractors/scrape.js';
import { extractClinicInfo } from './extractors/clinic-info.js';
import { buildCorpus } from './extractors/corpus.js';
import { captureScreenshots } from './extractors/screenshots.js';
import { runLighthouseModule } from './modules/lighthouse.js';
import { runSeoOnPageModule } from './modules/seo-onpage.js';
import { runSeoRankingModule } from './modules/seo-ranking.js';
import { runTrafficMetricsModule } from './modules/traffic-metrics.js';
import { runRubricMergedModule } from './modules/rubric-merged.js';
import { runLlmDiscoverabilityModule } from './modules/llm-discoverability.js';
import { runDesignReviewModule } from './modules/design-review.js';
import { runUxMedspaModule } from './modules/ux-medspa.js';
import { renderReport, renderIndex } from './reporter/render.js';

const ALL_MODULES: ModuleId[] = [
  'lighthouse',
  'seo-onpage',
  'seo-ranking',
  'traffic-metrics',
  'llm-copy-aeo',
  'llm-discoverability',
  'copy-conversion',
  'design-review',
  'ux-medspa',
];

// Modules that don't run unless explicitly enabled via --enable. They stay in
// the codebase and can be turned back on by passing e.g. --enable llm-discoverability.
const DEFAULT_DISABLED: ModuleId[] = ['design-review', 'ux-medspa', 'llm-discoverability'];

function effectiveSkip(skip: ModuleId[], enable: ModuleId[]): Set<ModuleId> {
  const out = new Set<ModuleId>([...DEFAULT_DISABLED, ...skip]);
  for (const e of enable) out.delete(e);
  return out;
}

function shouldRun(id: ModuleId, skip: Set<ModuleId>): boolean {
  return !skip.has(id);
}

function skippedModule(id: ModuleId, label: string, reason: string): ModuleResult {
  return { id, label, status: 'skipped', score: null, summary: `Skipped — ${reason}.`, issues: [], skipReason: reason };
}

// Pick a representative service page + booking/contact page from the crawl.
function pickJourneyPages(pages: ScrapedPage[], preferredServices: string[]): { service?: string; booking?: string; contact?: string } {
  const urls = pages.map((p) => p.url);
  const pathOf = (u: string) => { try { return new URL(u).pathname.toLowerCase(); } catch { return u; } };

  let service: string | undefined;
  for (const svc of preferredServices) {
    const slug = svc.toLowerCase().replace(/\s+/g, '-');
    service = urls.find((u) => pathOf(u).includes(slug));
    if (service) break;
  }
  if (!service) {
    service = urls.find((u) => /\/(services?|treatments?|menu)\/.+/i.test(pathOf(u)))
      || urls.find((u) => /\/(services?|treatments?|menu)\/?$/i.test(pathOf(u)));
  }

  const booking = urls.find((u) => /\/(book|booking|consultation|appointment)/i.test(pathOf(u)));
  const contact = urls.find((u) => /\/contact/i.test(pathOf(u)));

  return { service, booking, contact };
}

export async function runSingle(input: AuditInput, options: CLIOptions): Promise<AuditReport> {
  const startedAt = new Date().toISOString();
  const slug = slugForRun(input.url);
  const outputDir = path.resolve(options.output, slug);
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const costTracker = new CostTracker();
  const skipSet = effectiveSkip(options.skip, options.enable);

  log.header(`Auditing ${input.url}`);

  log.info(`Crawling site (Firecrawl, max ${options.maxPages} pages)…`);
  const site = await scrapeSite(input.url, { maxPages: options.maxPages });
  log.result('Pages crawled', String(site.pages.length));

  // Persist raw per-page artifacts
  fs.writeFileSync(path.join(rawDir, 'page.md'), site.markdown);
  fs.writeFileSync(path.join(rawDir, 'page.html'), site.html);
  const pagesDir = path.join(rawDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  for (let i = 0; i < site.pages.length; i++) {
    const p = site.pages[i];
    const safe = String(i).padStart(2, '0') + '-' + (p.url.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_').slice(0, 80));
    fs.writeFileSync(path.join(pagesDir, `${safe}.md`), `# ${p.url}\n\n${p.markdown}`);
  }

  log.info('Extracting clinic info (Claude)…');
  const clinic: ClinicInfo = await extractClinicInfo(
    site,
    { name: input.nameOverride, city: input.cityOverride },
    costTracker
  );
  log.result('Name', clinic.name);
  log.result('City', clinic.city || '(unknown)');
  log.result('Services', clinic.services.slice(0, 5).join(', ') || '(none detected)');

  // Build the cross-module corpus once. Single source of truth for rubric modules.
  const corpus = buildCorpus(site.pages, {
    maxChars: options.maxCorpus,
    preferredServices: clinic.services,
  });
  fs.writeFileSync(path.join(rawDir, 'corpus.md'), corpus.text);
  log.result('Corpus', `${corpus.includedPages.length} pages, ${(corpus.totalChars / 1000).toFixed(1)}K chars (~${Math.round(corpus.totalChars / 4)} tokens)`);
  if (corpus.droppedPages.length > 0) {
    log.result('Dropped', `${corpus.droppedPages.length} page(s) (${Array.from(new Set(corpus.droppedPages.map((d) => d.reason))).join(', ')})`);
  }

  // Budget pre-check. Empirical baselines from live runs:
  //   - clinic-info (Haiku): ~$0.01
  //   - rubric write + 1 read + outputs: ~$0.12 per 20K corpus
  //   - design-review with 3 screenshot pairs (6 images): ~$0.08
  //   - llm-discoverability 6× Claude + web_search: ~$0.55 (web_search pulls ~25K tokens per call)
  if (options.budget > 0) {
    const approxCorpusTokens = corpus.totalChars / 4;
    const corpusWriteUsd = costTracker.estimatedNext('claude-sonnet-4-6', approxCorpusTokens * 1.25, 0);
    const corpusReadUsd = costTracker.estimatedNext('claude-sonnet-4-6', approxCorpusTokens * 0.1, 0);
    const rubricOutputUsd = costTracker.estimatedNext('claude-sonnet-4-6', 0, 4500 * 2);
    const estDesignUsd = shouldRun('design-review', skipSet) ? (options.shallowDesign ? 0.05 : 0.10) : 0;
    const estDiscoverabilityUsd = shouldRun('llm-discoverability', skipSet) && process.env.ANTHROPIC_API_KEY ? 0.60 : 0;
    const estClinicInfoUsd = 0.01;
    const estTotal = corpusWriteUsd + corpusReadUsd + rubricOutputUsd + estDesignUsd + estDiscoverabilityUsd + estClinicInfoUsd;
    if (estTotal > options.budget) {
      throw new Error(
        `Estimated audit cost $${estTotal.toFixed(2)} exceeds budget $${options.budget.toFixed(2)}. ` +
        `Lower --max-corpus, raise --budget, or pass --budget 0 to disable.`
      );
    }
    log.result('Cost estimate', `~$${estTotal.toFixed(2)} (budget $${options.budget.toFixed(2)})`);
  }

  // Pick journey pages for screenshots + UX probes
  const journey = pickJourneyPages(site.pages, clinic.services);
  if (journey.service) log.result('Service page', journey.service);
  if (journey.booking) log.result('Booking page', journey.booking);
  if (journey.contact) log.result('Contact page', journey.contact);

  let screenshotsPromise: Promise<any> | null = null;
  if (shouldRun('design-review', skipSet)) {
    log.info('Capturing screenshots (Playwright)…');
    const targets = options.shallowDesign
      ? { home: site.finalUrl }
      : { home: site.finalUrl, service: journey.service, booking: journey.booking || journey.contact };
    screenshotsPromise = captureScreenshots(targets, rawDir).catch((err) => {
      log.warn(`Screenshots failed: ${err.message}`);
      return null;
    });
  }

  const moduleResults: ModuleResult[] = [];
  const tasks: Promise<ModuleResult>[] = [];

  if (shouldRun('lighthouse', skipSet)) {
    tasks.push(runLighthouseModule(input.url, rawDir));
  } else {
    moduleResults.push(skippedModule('lighthouse', 'Lighthouse', 'skipped via --skip'));
  }

  if (shouldRun('seo-onpage', skipSet)) {
    tasks.push(runSeoOnPageModule(site));
  } else {
    moduleResults.push(skippedModule('seo-onpage', 'SEO (on-page)', 'skipped via --skip'));
  }

  if (shouldRun('seo-ranking', skipSet)) {
    tasks.push(runSeoRankingModule(clinic, rawDir, options.keywords));
  } else {
    moduleResults.push(skippedModule('seo-ranking', 'SEO (Google rank)', 'skipped via --skip'));
  }

  if (shouldRun('traffic-metrics', skipSet)) {
    tasks.push(runTrafficMetricsModule(clinic, site, rawDir));
  } else {
    moduleResults.push(skippedModule('traffic-metrics', 'Traffic & authority', 'skipped via --skip'));
  }

  // Merged rubric: one Anthropic call returns BOTH the AEO and copy-conversion
  // audits. Saves a duplicate corpus send + cache write. Two ModuleResults come
  // back from one call so the dashboard tabs are unchanged.
  const runAeo = shouldRun('llm-copy-aeo', skipSet);
  const runCopy = shouldRun('copy-conversion', skipSet);
  if (runAeo && runCopy) {
    tasks.push(
      (async () => {
        const merged = await runRubricMergedModule(site, clinic, corpus.text, costTracker);
        return { ...merged.aeo, _extraResults: [merged.copy] } as any;
      })()
    );
  } else if (runAeo || runCopy) {
    // Only one of the two enabled — still run the merged call (cheap enough)
    // and surface the requested half. The unused half is dropped.
    tasks.push(
      (async () => {
        const merged = await runRubricMergedModule(site, clinic, corpus.text, costTracker);
        return runAeo ? merged.aeo : merged.copy;
      })()
    );
    if (!runAeo) moduleResults.push(skippedModule('llm-copy-aeo', 'LLM copy / AEO', 'skipped via --skip'));
    if (!runCopy) moduleResults.push(skippedModule('copy-conversion', 'Copy & conversion', 'skipped via --skip'));
  } else {
    moduleResults.push(skippedModule('llm-copy-aeo', 'LLM copy / AEO', 'skipped via --skip'));
    moduleResults.push(skippedModule('copy-conversion', 'Copy & conversion', 'skipped via --skip'));
  }

  if (shouldRun('llm-discoverability', skipSet)) {
    tasks.push(runLlmDiscoverabilityModule(clinic, rawDir, costTracker));
  } else {
    const reason = DEFAULT_DISABLED.includes('llm-discoverability') && !options.enable.includes('llm-discoverability')
      ? 'disabled by default — re-enable with --enable llm-discoverability'
      : 'skipped via --skip';
    moduleResults.push(skippedModule('llm-discoverability', 'LLM discoverability', reason));
  }

  if (shouldRun('ux-medspa', skipSet)) {
    tasks.push(
      runUxMedspaModule({
        home: site.finalUrl,
        booking: journey.booking,
        contact: journey.contact,
      })
    );
  } else {
    const reason = DEFAULT_DISABLED.includes('ux-medspa') && !options.enable.includes('ux-medspa')
      ? 'disabled by default — re-enable with --enable ux-medspa'
      : 'skipped via --skip';
    moduleResults.push(skippedModule('ux-medspa', 'UX (med spa)', reason));
  }

  if (shouldRun('design-review', skipSet)) {
    tasks.push(
      (async () => {
        const shots = await screenshotsPromise;
        if (!shots || (Array.isArray(shots) && shots.length === 0)) {
          return skippedModule('design-review', 'Design', 'screenshots unavailable');
        }
        return runDesignReviewModule(shots, costTracker);
      })()
    );
  } else {
    const reason = DEFAULT_DISABLED.includes('design-review') && !options.enable.includes('design-review')
      ? 'disabled by default — re-enable with --enable design-review'
      : 'skipped via --skip';
    moduleResults.push(skippedModule('design-review', 'Design', reason));
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      const r = s.value as any;
      moduleResults.push(r);
      if (Array.isArray(r._extraResults)) {
        for (const extra of r._extraResults) moduleResults.push(extra);
        delete r._extraResults;
      }
    } else {
      log.error(`Module failed: ${s.reason?.message || s.reason}`);
    }
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

  const costSummary = costTracker.summary();
  costTracker.print();

  const report: AuditReport = {
    input,
    clinic,
    startedAt,
    finishedAt,
    overallScore: overall,
    modules: moduleResults,
    outputDir,
    cost: { totalUsd: costSummary.totalUsd, byLabel: costSummary.byLabel },
    corpusStats: { includedPages: corpus.includedPages.length, droppedPages: corpus.droppedPages.length, totalChars: corpus.totalChars },
  };

  fs.writeFileSync(path.join(outputDir, 'audit.json'), JSON.stringify(report, null, 2));
  const reportPath = await renderReport(report, outputDir);

  log.divider();
  log.success(`Overall score: ${overall}/100  ·  Anthropic cost $${costSummary.totalUsd.toFixed(4)}`);
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
  let totalCostUsd = 0;

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
          totalCostUsd += report.cost?.totalUsd ?? 0;
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

  log.divider();
  log.success(`Total Anthropic spend across batch: $${totalCostUsd.toFixed(4)}`);

  if (options.index) {
    const indexPath = path.join(path.resolve(options.output), 'index.html');
    await renderIndex(entries, indexPath);
    log.url('Batch index', indexPath);
  }

  return entries;
}
