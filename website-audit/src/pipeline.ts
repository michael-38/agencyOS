// The pipeline: steps 1-8 in fixed order, each gated by the resolved module set. LLM calls happen only in
// classification, home choice (fallback), candidate selection, and judgment. Runs without Claude Code.
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS, MODELS, PIPELINE_VERSION, PROBE_VERSION, VIEWPORTS, loadEnv, requireEnv } from './config.js';
import { RunCache } from './cache.js';
import { FirecrawlService, loadProbeScript } from './firecrawl.js';
import { LlmClient } from './llm/client.js';
import { homeChooserSchema, type HomeChooserOutput } from './llm/schemas.js';
import { homeChooserSystem, homeChooserUser } from './llm/prompts/home.js';
import type { ModuleSet } from './modules.js';
import { Progress } from './progress.js';
import { loadChecklist, loadDetectors, loadIndustries, type LoadedChecklist } from './personas/load.js';
import { REGISTERED_CHECK_IDS } from './checks/registry.js';
import { extractFacts, type Facts } from './checks/facts.js';
import type { PageContext } from './checks/registry.js';
import { pathSlugs } from './urls.js';
import { decideHome, detectSplash, resolveInput, type HomeDecision, type ResolveResult, type SplashResult } from './steps/resolve.js';
import { runMap, type MapStepResult } from './steps/map.js';
import { addDesktopShot, scrapePage, type PageRecord } from './steps/scrape.js';
import { classifyIndustry, type ClassifyResult } from './steps/classify.js';
import { evaluateChecklist, type EvaluationResult } from './steps/evaluate.js';
import { canonicalReport, overallVerdict, rankGaps, renderMarkdown } from './steps/report.js';
import type { Report, ReportItem, ReportPage } from './report/schema.js';

export interface RunOptions {
  url: string;
  repoRoot: string;
  outDir: string;
  industry: string | null;
  modules: ModuleSet;
  excludeItems: string[];
  fromCache: string | null;
  offline: boolean;
  judgeModel: string;
  tiles: number;
  maxCandidatePages: number | null;
  lenient: boolean;
  jsonProgress: boolean;
  verbose: boolean;
  launchedFrom: 'cli' | 'ui';
  dryRun: boolean;
  /** Pre-created run dir (UI passes one so it can stream before the pipeline starts). */
  runDir?: string;
}

export interface RunResult {
  runDir: string;
  report: Report | null;
  reportPath: string | null;
  dryRun?: unknown;
}

function timestampSlug(d = new Date()): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function writeJson(dir: string, name: string, data: unknown): void {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

export async function runAudit(opts: RunOptions): Promise<RunResult> {
  const started = new Date();
  loadEnv(opts.repoRoot);
  const industries = loadIndustries(opts.repoRoot);
  const slugs = industries.industries.map((i) => i.slug);
  if (opts.industry && !slugs.includes(opts.industry)) throw new Error(`--industry "${opts.industry}" is not in config/industries.yaml (${slugs.join(', ')})`);

  // --- dry run: resolve config + checklist without network ---
  if (opts.dryRun) {
    const slug = opts.industry ?? 'generic';
    const checklist = loadChecklist(opts.repoRoot, industries, slug, {
      includePersona: opts.modules['persona-checklist'],
      includeCommon: opts.modules['common-checklist'],
      registeredCheckIds: REGISTERED_CHECK_IDS,
      excludeItems: opts.excludeItems,
    });
    const items = checklist.items.filter((it) => (it.check === 'deterministic' ? opts.modules.deterministic : opts.modules.judgment));
    const skipped = checklist.items.filter((it) => !items.includes(it)).map((it) => it.id);
    return {
      runDir: '',
      report: null,
      reportPath: null,
      dryRun: {
        url: opts.url,
        industry: opts.industry ?? '(auto)',
        modules: opts.modules,
        models: { ...MODELS, judgment: opts.judgeModel },
        persona_file: checklist.personaFile,
        items: items.map((it) => ({ id: it.id, source: it.source, scope: it.scope, check: it.check, weight: it.weight })),
        skipped_item_ids: [...skipped, ...opts.excludeItems],
        exclude_items: opts.excludeItems,
      },
    };
  }

  const firecrawlKey = requireEnv('FIRECRAWL_API_KEY');
  const anthropicKey = opts.modules.classify || opts.modules.judgment || opts.modules.subpath ? requireEnv('ANTHROPIC_API_KEY') : null;

  // Provisional run dir keyed by the input host; renamed to the resolved host after step 2.
  const provisionalHost = (() => {
    try {
      return new URL(/^[a-z]+:\/\//i.test(opts.url) ? opts.url : `https://${opts.url}`).hostname;
    } catch {
      return 'unknown-host';
    }
  })();
  const ts = timestampSlug(started);
  let runDir = opts.runDir ?? path.join(opts.outDir, provisionalHost, ts);
  fs.mkdirSync(path.join(runDir, 'raw', 'pages'), { recursive: true });
  const progress = new Progress(runDir, opts.jsonProgress, opts.verbose);
  const cache = new RunCache(runDir, opts.fromCache, opts.offline);
  const fc = new FirecrawlService(firecrawlKey, cache, runDir, progress);
  const llm = anthropicKey ? new LlmClient(anthropicKey, cache, runDir, progress) : null;
  const probeScript = loadProbeScript();
  const models = { ...MODELS, judgment: opts.judgeModel };

  writeJson(runDir, 'input.json', {
    input_url: opts.url,
    started: started.toISOString(),
    modules: opts.modules,
    industry_override: opts.industry,
    exclude_items: opts.excludeItems,
    from_cache: opts.fromCache,
    offline: opts.offline,
    models,
    viewports: VIEWPORTS,
    limits: LIMITS,
    tiles: opts.tiles,
    max_candidate_pages: opts.maxCandidatePages,
    lenient: opts.lenient,
    probe_version: PROBE_VERSION,
    pipeline_version: PIPELINE_VERSION,
    launched_from: opts.launchedFrom,
  });
  progress.meta({ run_dir: runDir, modules: opts.modules, models });

  let resolve: ResolveResult | null = null;
  let mapRes: MapStepResult | null = null;
  let home: PageRecord | null = null;
  let root: PageRecord | null = null;
  let decision: HomeDecision | null = null;
  let classify: ClassifyResult | null = null;
  let checklist: LoadedChecklist | null = null;
  let evaluation: EvaluationResult | null = null;
  let facts: Facts | null = null;
  let splash: SplashResult | null = null;
  let homeUrl = '';
  let effectiveSlug = opts.industry ?? 'generic';
  let industrySource: 'llm' | 'override' = opts.industry ? 'override' : 'llm';

  try {
    // ---- 1-2 resolve ----
    progress.step(1, 'resolve', 'start', opts.url);
    resolve = await resolveInput(opts.url);
    if (resolve.error) progress.info(`resolve: ${resolve.error} (continuing; Firecrawl decides the root status)`);
    const originHost = new URL(resolve.resolved_origin).hostname;
    if (!opts.runDir && originHost !== provisionalHost) {
      const newDir = path.join(opts.outDir, originHost, ts);
      fs.mkdirSync(path.dirname(newDir), { recursive: true });
      fs.renameSync(runDir, newDir);
      runDir = newDir;
      // Re-point helpers at the new directory.
      (progress as unknown as { logPath: string }).logPath = path.join(runDir, 'run.log');
      (cache as unknown as { runDir: string }).runDir = runDir;
      (fc as unknown as { runDir: string }).runDir = runDir;
      if (llm) (llm as unknown as { runDir: string }).runDir = runDir;
    }
    homeUrl = `${resolve.resolved_origin}/`;
    progress.step(1, 'resolve', 'done', `${resolve.resolved_origin} (${resolve.chain.length} hop${resolve.chain.length === 1 ? '' : 's'}, host differs: ${resolve.input_host_differs})`);

    // ---- 3 map ----
    progress.step(3, 'map', 'start', resolve.resolved_origin);
    mapRes = await runMap(fc, resolve.resolved_origin, runDir, progress);
    progress.step(3, 'map', 'done', `${mapRes.normalized.same_origin.length} same-origin, ${mapRes.normalized.subdomain.length} subdomain${mapRes.second_map ? ', second map issued' : ''}`);

    // ---- 4 scrape root (mobile) ----
    progress.step(4, 'scrape-home', 'start', homeUrl);
    let rootError: string | null = null;
    try {
      root = await scrapePage(fc, homeUrl, 'root', { desktop: false, probeScript, runDir, progress });
      splash = detectSplash(root.rawHtml);
    } catch (e) {
      rootError = (e as Error).message;
      progress.info(`root scrape failed: ${rootError}`);
    }

    // ---- 2 (deferred) home rules ----
    const candidates = mapRes.normalized.same_origin.filter((l) => l.url !== homeUrl && l.url !== `${homeUrl}`);
    decision = decideHome({
      rootStatus: root?.statusCode ?? null,
      rootScrapeError: rootError,
      splash,
      inputHostDiffers: resolve.input_host_differs,
      hasCandidates: candidates.length > 0,
    });
    progress.log(`home rule: ${decision.home_rule} (${decision.reason})${decision.rules_fired.length ? `; fired: ${decision.rules_fired.join(', ')}` : ''}`);
    let chooser: { output: HomeChooserOutput; model: string } | null = null;
    if (decision.needs_chooser) {
      if (!llm) throw new Error(`home page needs the LLM chooser (${decision.reason}) but no ANTHROPIC_API_KEY / modules are off`);
      const urls = candidates.slice(0, 60).map((l) => ({ url: l.url, title: l.title, description: l.description }));
      const res = await llm.parse<HomeChooserOutput>({
        step: '02-home',
        label: 'chooser',
        model: models.home,
        system: homeChooserSystem(),
        content: [
          {
            type: 'text',
            text: homeChooserUser({
              reason: decision.reason,
              resolvedOrigin: resolve.resolved_origin,
              rootStatus: root?.statusCode ?? null,
              rootExcerpt: (root?.markdown ?? '').slice(0, 2000),
              urls,
            }),
          },
        ],
        schema: homeChooserSchema([homeUrl, ...urls.map((u) => u.url)]),
        maxTokens: LIMITS.smallMaxTokens,
      });
      chooser = { output: res.parsed, model: res.model };
      homeUrl = res.parsed.home_url;
      progress.info(`home chooser picked ${homeUrl}: ${res.parsed.reason}`);
    } else if (decision.home_rule === 'input-page-fallback') {
      homeUrl = resolve.final_url;
    }
    writeJson(runDir, 'resolve.json', { ...resolve, root_status: root?.statusCode ?? null, root_error: rootError, splash, ...decision, chooser, home_url: homeUrl });

    // ---- 4 scrape final home (reuse root if unchanged), then desktop ----
    if (root && root.url === homeUrl) {
      home = root;
      home.role = 'home';
    } else {
      home = await scrapePage(fc, homeUrl, 'home', { desktop: false, probeScript, runDir, progress });
    }
    if (opts.modules.desktop) await addDesktopShot(fc, home, runDir, progress);
    progress.step(4, 'scrape-home', 'done', `${home.url} status ${home.statusCode ?? '?'}, ${home.files.tiles.length}/${home.tilesTotal} tiles${home.probe ? '' : ', no probe'}`);

    // ---- 5 classify ----
    if (opts.modules.classify) {
      progress.step(5, 'classify', 'start');
      if (!llm) throw new Error('classify module is on but no LLM client');
      const slugList = pathSlugs([...mapRes.normalized.same_origin.map((l) => l.url), ...mapRes.normalized.subdomain.map((l) => l.url)], LIMITS.classifySlugCount);
      classify = await classifyIndustry(llm, industries, home, slugList);
      effectiveSlug = classify.effective_slug;
      industrySource = 'llm';
      progress.step(5, 'classify', 'done', `${classify.raw_slug} (${classify.confidence.toFixed(2)}) → ${effectiveSlug}`);
    } else {
      progress.step(5, 'classify', 'skip', `industry override: ${effectiveSlug}`);
    }
    const industry = industries.industries.find((i) => i.slug === effectiveSlug)!;
    const archetype = industries.archetypes.find((a) => a.id === industry.archetype)!;
    const detectors = loadDetectors(opts.repoRoot, industry);

    // ---- 6 load checklists ----
    progress.step(6, 'load-checklist', 'start', effectiveSlug);
    checklist = loadChecklist(opts.repoRoot, industries, effectiveSlug, {
      includePersona: opts.modules['persona-checklist'],
      includeCommon: opts.modules['common-checklist'],
      registeredCheckIds: REGISTERED_CHECK_IDS,
      excludeItems: opts.excludeItems,
    });
    for (const w of checklist.warnings) progress.info(`${w.file}:${w.line} ${w.message}`);
    writeJson(runDir, 'checklist.json', { slug: effectiveSlug, persona_file: checklist.personaFile, persona_fallback: checklist.personaFallback, hashes: checklist.hashes, items: checklist.items, warnings: checklist.warnings });
    progress.step(6, 'load-checklist', 'done', `${checklist.items.length} item(s)`);

    // ---- 7 evaluate ----
    progress.step(7, 'evaluate', 'start');
    const personaFm = checklist.persona?.frontmatter ?? checklist.common?.frontmatter ?? { persona_name: 'Visitor', primary_goal: 'Find what they need', device_bias: 'mobile' as const, industry: effectiveSlug };
    evaluation = await evaluateChecklist({
      items: checklist.items,
      home,
      persona: {
        personaName: personaFm.persona_name,
        primaryGoal: personaFm.primary_goal,
        deviceBias: personaFm.device_bias,
        goalsProse: [checklist.persona?.goals_prose, checklist.common?.goals_prose].filter(Boolean).join('\n\n'),
        industryDisplayName: industry.display_name,
      },
      detectors,
      jsonldType: archetype.jsonld_type,
      modules: opts.modules,
      sameOrigin: mapRes.normalized.same_origin,
      llm,
      fc,
      probeScript,
      progress,
      runDir,
      judgeModel: opts.judgeModel,
      tilesSent: opts.tiles,
      lenient: opts.lenient,
      maxCandidatePages: opts.maxCandidatePages,
    });
    writeJson(runDir, 'evaluation.json', { flags: evaluation.flags, skipped_item_ids: evaluation.skippedItemIds, items: evaluation.items });
    progress.step(7, 'evaluate', 'done', `${evaluation.items.length} item(s), ${evaluation.flags.judge_calls} judge call(s), ${evaluation.flags.candidate_pages} candidate page(s)`);

    if (opts.modules.facts) {
      const ctx: PageContext = { url: home.url, rawHtml: home.rawHtml, markdown: home.markdown, links: home.links, probe: home.probe, viewport: { ...VIEWPORTS.mobile }, detectors, jsonldType: archetype.jsonld_type };
      facts = extractFacts(ctx, home.probe?.navText);
    }

    // ---- 8 report ----
    progress.step(8, 'report', 'start');
    const report = buildReport({ opts, started, runDir, resolve, decision, classify, effectiveSlug, industrySource, checklist, evaluation, facts, home, root, mapRes, fc, llm, cache, models });
    writeJson(runDir, 'report.json', report);
    fs.writeFileSync(path.join(runDir, 'report.md'), renderMarkdown(report, { displayName: industry.display_name }));
    writeJson(runDir, 'report.canonical.json', canonicalReport(report));
    progress.step(8, 'report', 'done', `${report.summary.verdict} — ${report.summary.fail} fail, ${report.summary.partial} partial, ${report.summary.pass} pass`);
    progress.done({ run_dir: runDir, verdict: report.summary.verdict, credits_used: report.run_meta.credits_used, anthropic_usd: report.run_meta.anthropic_usd });
    return { runDir, report, reportPath: path.join(runDir, 'report.json') };
  } catch (e) {
    const err = e as Error;
    progress.error(err.message);
    writeJson(runDir, 'error.json', { message: err.message, stack: err.stack, at: new Date().toISOString(), details: (err as { details?: unknown }).details ?? null });
    if (evaluation && checklist && home && resolve && decision && mapRes) {
      try {
        const industry = industries.industries.find((i) => i.slug === effectiveSlug)!;
        const report = buildReport({ opts, started, runDir, resolve, decision, classify, effectiveSlug, industrySource, checklist, evaluation, facts, home, root, mapRes, fc, llm, cache, models });
        writeJson(runDir, 'report.partial.json', report);
        fs.writeFileSync(path.join(runDir, 'report.md'), `${renderMarkdown(report, { displayName: industry.display_name })}\n\n> Run aborted: ${err.message}\n`);
      } catch {
        /* best effort */
      }
    }
    throw e;
  }
}

interface BuildReportInput {
  opts: RunOptions;
  started: Date;
  runDir: string;
  resolve: ResolveResult;
  decision: HomeDecision;
  classify: ClassifyResult | null;
  effectiveSlug: string;
  industrySource: 'llm' | 'override';
  checklist: LoadedChecklist;
  evaluation: EvaluationResult;
  facts: Facts | null;
  home: PageRecord;
  root: PageRecord | null;
  mapRes: MapStepResult;
  fc: FirecrawlService;
  llm: LlmClient | null;
  cache: RunCache;
  models: Record<string, string>;
}

function pageEntry(p: PageRecord, role: ReportPage['role']): ReportPage {
  return {
    url: p.url,
    role,
    page_key: p.key,
    markdown_path: p.markdownPath,
    html_path: p.htmlPath,
    judge_text_path: p.judgeTextPath,
    screenshots: { mobile: p.files.mobile, desktop: p.files.desktop, mobile_fold: p.files.mobileFold, desktop_fold: p.files.desktopFold, mobile_tiles: p.files.tiles },
    status_code: p.statusCode,
  };
}

function buildReport(b: BuildReportInput): Report {
  const { opts, evaluation } = b;
  const items: ReportItem[] = evaluation.items.map((ev) => ({
    id: ev.item.id,
    source: ev.item.source,
    criterion: ev.item.criterion,
    scope: ev.item.scope,
    check: ev.item.check,
    weight: ev.item.weight,
    verdict: ev.verdict,
    evidence: ev.evidence,
    candidates_checked: ev.candidates_checked,
    satisfied_at_url: ev.satisfied_at_url,
    note: ev.note,
    candidates_selected: ev.candidates_selected,
    candidate_log: ev.candidate_log,
    unverified: ev.unverified,
    extra: ev.item.extra,
  }));
  const skippedModules = Object.entries(opts.modules)
    .filter(([id, on]) => !on && id !== 'lighthouse')
    .map(([id]) => id);
  const skippedItemIds = [...new Set([...evaluation.skippedItemIds, ...opts.excludeItems])];
  const pages: ReportPage[] = [];
  if (b.root && b.root.key !== b.home.key) pages.push(pageEntry(b.root, 'root'));
  pages.push(pageEntry(b.home, 'home'));
  for (const c of evaluation.candidatePages) pages.push(pageEntry(c, 'candidate'));
  const finished = new Date();
  return {
    input_url: opts.url,
    resolved_origin: b.resolve.resolved_origin,
    home_url: b.home.url,
    home_rule: b.decision.home_rule,
    rules_fired: b.decision.rules_fired,
    industry: {
      slug: b.effectiveSlug,
      confidence: b.classify ? b.classify.confidence : 1,
      raw_slug: b.classify?.raw_slug ?? null,
      rationale: b.classify?.rationale ?? null,
      source: b.industrySource,
    },
    persona_file: b.checklist.personaFile,
    persona_fallback: b.checklist.personaFallback,
    items,
    summary: {
      pass: items.filter((i) => i.verdict === 'pass').length,
      partial: items.filter((i) => i.verdict === 'partial').length,
      fail: items.filter((i) => i.verdict === 'fail').length,
      top_gaps: rankGaps(items).slice(0, 5).map((i) => i.id),
      verdict: overallVerdict(items),
      partial_audit: skippedModules.some((m) => ['common-checklist', 'persona-checklist', 'deterministic', 'judgment', 'subpath'].includes(m)) || skippedItemIds.length > 0,
      skipped: { modules: skippedModules, item_ids: skippedItemIds },
    },
    facts: b.facts,
    pages,
    run_meta: {
      timestamps: { started: b.started.toISOString(), finished: finished.toISOString() },
      models: b.models,
      credits_used: b.fc.creditsUsed,
      anthropic_usd: Number((b.llm?.usd ?? 0).toFixed(4)),
      viewports: { mobile: [VIEWPORTS.mobile.width, VIEWPORTS.mobile.height], desktop: opts.modules.desktop ? [VIEWPORTS.desktop.width, VIEWPORTS.desktop.height] : null },
      run_dir: b.runDir,
      cache_source: opts.fromCache,
      cache_stats: { hits: b.cache.stats.hits, misses: b.cache.stats.misses, source_hits: b.cache.stats.sourceHits },
      persona_hashes: b.checklist.hashes,
      probe_version: PROBE_VERSION,
      pipeline_version: PIPELINE_VERSION,
      modules: opts.modules,
      launched_from: opts.launchedFrom,
      flags: {
        markdown_truncated_pages: evaluation.flags.markdown_truncated_pages,
        probe_fallback_pages: evaluation.flags.probe_fallback_pages,
        second_map: b.mapRes.second_map,
        subdomain_share: Number(b.mapRes.normalized.subdomain_share.toFixed(3)),
      },
    },
  };
}
