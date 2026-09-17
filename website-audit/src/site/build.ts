// site:build — the SiteRedesign orchestrator.
//
// Stages run in the order assets → plan → design → render → validate, and each writes its artifact
// beside report.json so a later stage can be re-run on its own (`--stage render`) without paying for
// the earlier ones. Validation failures are fed back into the render stage; whatever survives the
// repair budget is reported rather than quietly shipped.
import fs from 'node:fs';
import path from 'node:path';
import { PRICING, SITE_LIMITS, SITE_MODELS, loadEnv, requireEnv } from '../config.js';
import { RunCache } from '../cache.js';
import { Progress } from '../progress.js';
import { LlmClient, type LlmParser } from '../llm/client.js';
import { REGISTERED_CHECK_IDS } from '../checks/registry.js';
import { loadChecklist, loadIndustries } from '../personas/load.js';
import type { Report } from '../report/schema.js';
import { assetsToPrompt, availableRoles, harvestAssets } from './assets.js';
import { buildCorpus } from './corpus.js';
import { buildCopyMap, indexCopy, type CopyIndex } from './copy.js';
import { runDesignStage } from './design.js';
import { installFonts, loadFonts } from './fonts.js';
import { fileForPath, markdownForPath, outputFile } from './paths.js';
import { runPlanStage } from './plan.js';
import { findSection, loadBuildReferences, referenceToPrompt } from './reference.js';
import { AssetAllocator, assembleDocument, buildRenderInput, renderPageMarkup } from './render.js';
import {
  buildHeadersFile,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildPageMarkdown,
  buildRobots,
  buildSitemap,
  type SeoContext,
} from './seo.js';
import { repairNotesFor, validateSiteTree, type SiteValidation } from './validate.js';
import { writeSeoReport } from './report.js';
import type { AssetManifest, BuildProfile, CopyMap, DesignSpec, RenderedPage, SitePlan } from './types.js';

export const STAGES = ['assets', 'plan', 'design', 'render', 'validate'] as const;
export type Stage = (typeof STAGES)[number];

export interface BuildOptions {
  reportPath: string;
  repo: string;
  profile: BuildProfile;
  baseUrl: string | null;
  slug: string | null;
  maxPages: number;
  maxAssets: number;
  useAssets: boolean;
  startStage: Stage;
  repairPasses: number;
  maxUsd: number;
  fromCache: string | null;
  offline: boolean;
  models: { plan: string; design: string; render: string };
  verbose: boolean;
  dryRun: boolean;
  /**
   * Replaces the Anthropic client. Supplied by the offline end-to-end test so the whole orchestrator
   * — corpus, plan normalisation, copy provenance, assembly, validation, report — can be exercised
   * from recorded stage outputs without a single API call.
   */
  llm?: LlmParser;
}

export interface BuildResult {
  siteDir: string;
  validation: SiteValidation | null;
  usd: number;
  pagesWritten: string[];
  notes: string[];
  /** Set when the build stopped early because it hit --max-usd. */
  budgetStop: string | null;
}

/** Thrown before the stage that would have spent, so nothing is billed once the budget is reached. */
class BudgetExceeded extends Error {
  constructor(readonly spent: number, readonly projected: number, readonly limit: number, readonly stage: string) {
    super(
      `--max-usd $${limit.toFixed(2)} would be exceeded by the ${stage} stage: $${spent.toFixed(4)} spent, ~$${projected.toFixed(2)} projected. Raise --max-usd or reduce --max-pages.`,
    );
    this.name = 'BudgetExceeded';
  }
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function requireArtifact<T>(file: string, stage: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(`--stage ${stage} needs ${path.basename(file)}, which does not exist. Run an earlier stage first.`);
  }
  return readJson<T>(file);
}

/** Run up to `limit` promises at a time, preserving input order in the result. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runBuild(o: BuildOptions): Promise<BuildResult> {
  const reportPath = path.resolve(o.reportPath);
  if (!fs.existsSync(reportPath)) throw new Error(`report not found: ${reportPath}`);
  const runDir = path.dirname(reportPath);
  const siteDir = path.join(runDir, 'site');
  const report = readJson<Report>(reportPath);
  const slug = o.slug ?? report.industry.slug;

  const industries = loadIndustries(o.repo);
  const refs = loadBuildReferences(o.repo, industries, slug);
  const checklist = loadChecklist(o.repo, industries, slug, { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  if (!checklist.persona) throw new Error(`no persona could be loaded for slug "${slug}"`);

  const baseUrl = (o.baseUrl ?? new URL(report.home_url).origin).replace(/\/+$/, '');
  if (o.profile === 'production' && !o.baseUrl) {
    throw new Error('--profile production requires --base-url (canonical, Open Graph, sitemap, and llms.txt all need the real origin)');
  }

  const progress = new Progress(runDir, false, o.verbose);
  const notes: string[] = [...refs.gaps.map((g) => `build reference: ${g}`)];

  const { fonts, warnings: fontWarnings } = loadFonts(o.repo);
  notes.push(...fontWarnings.map((w) => `fonts: ${w}`));

  if (o.dryRun) {
    const corpus = buildCorpus(report, runDir, { maxCharsPerPage: SITE_LIMITS.corpusMaxCharsPerPage });
    const est = estimateCost({ corpusChars: corpus.total_chars, maxPages: o.maxPages, repairPasses: o.repairPasses, models: o.models });
    progress.info(`dry run — slug=${slug} profile=${o.profile} base=${baseUrl} pages<=${o.maxPages} assets<=${o.maxAssets}`);
    progress.info(`corpus ${corpus.pages.length} page(s), ${corpus.total_chars} chars (~${Math.round(corpus.total_chars / CHARS_PER_TOKEN)} tokens)`);
    for (const line of est.lines) progress.info(`  ${line}`);
    progress.info(
      `expected $${est.expectedUsd.toFixed(2)}, worst case $${est.usd.toFixed(2)} (budget --max-usd $${o.maxUsd.toFixed(2)}${est.expectedUsd >= o.maxUsd ? ' — this build would be refused' : ''})`,
    );
    return { siteDir, validation: null, usd: 0, pagesWritten: [], notes, budgetStop: null };
  }

  fs.mkdirSync(siteDir, { recursive: true });
  loadEnv(o.repo);
  const cache = new RunCache(runDir, o.fromCache, o.offline);
  const llm: LlmParser = o.llm ?? new LlmClient(requireEnv('ANTHROPIC_API_KEY'), cache, runDir, progress);

  const stageIndex = STAGES.indexOf(o.startStage);
  const runs = (s: Stage) => STAGES.indexOf(s) >= stageIndex;
  let budgetStop: string | null = null;
  /**
   * Checks spend *plus what the next stage is about to cost*. Checking the running total alone makes
   * the budget useless for the first and largest batch — it can only ever notice the money after it
   * is gone.
   */
  const checkBudget = (stage: string, projected: number) => {
    if (llm.usd + projected >= o.maxUsd) throw new BudgetExceeded(llm.usd, projected, o.maxUsd, stage);
  };

  const corpus = buildCorpus(report, runDir, { maxCharsPerPage: SITE_LIMITS.corpusMaxCharsPerPage });
  if (!corpus.pages.length) throw new Error('the run has no scraped markdown to rewrite (raw/pages/*/page.md is empty)');
  progress.step(1, 'corpus', 'done', `${corpus.pages.length} page(s), ${corpus.total_chars} chars`);
  const estimate = estimateCost({ corpusChars: corpus.total_chars, maxPages: o.maxPages, repairPasses: o.repairPasses, models: o.models });

  // Refuse before doing any work at all, not just before the first billed call: downloading a
  // client's whole image library for a build that cannot finish is wasted time either way.
  if (runs('plan')) checkBudget('plan', estimate.expectedUsd);

  // ---- stage: assets -------------------------------------------------------------------------
  const assetsPath = path.join(siteDir, 'assets.json');
  let assets: AssetManifest;
  if (runs('assets') && o.useAssets) {
    assets = await harvestAssets({ report, runDir, siteDir, cache, progress, maxAssets: o.maxAssets });
    writeJson(assetsPath, assets);
    progress.step(2, 'assets', 'done', `${assets.downloaded} of ${assets.harvested} image(s) kept`);
  } else if (runs('assets')) {
    assets = { assets: [], skipped: [], harvested: 0, downloaded: 0 };
    writeJson(assetsPath, assets);
    progress.step(2, 'assets', 'skip', '--assets placeholder');
  } else {
    assets = fs.existsSync(assetsPath) ? readJson<AssetManifest>(assetsPath) : { assets: [], skipped: [], harvested: 0, downloaded: 0 };
    progress.step(2, 'assets', 'skip', 'reused assets.json');
  }
  const unlicensed = assets.assets.filter((a) => a.verify_license);
  if (unlicensed.length) notes.push(`${unlicensed.length} image(s) came from a host other than the audited domain; confirm the client's licence before publishing (see assets.json)`);

  // ---- stage: plan ---------------------------------------------------------------------------
  const planPath = path.join(siteDir, 'plan.json');
  let plan: SitePlan;
  if (runs('plan')) {
    checkBudget('plan', estimate.expectedUsd);
    const res = await runPlanStage({
      llm,
      model: o.models.plan,
      persona: {
        industryDisplayName: refs.industry.display_name,
        personaName: checklist.persona.frontmatter.persona_name,
        primaryGoal: checklist.persona.frontmatter.primary_goal,
        deviceBias: checklist.persona.frontmatter.device_bias,
        goalsProse: [checklist.persona.goals_prose, checklist.common?.goals_prose ?? ''].filter(Boolean).join('\n\n'),
      },
      guidance: {
        archetype: referenceToPrompt(refs.archetypeDoc),
        industry: referenceToPrompt(refs.industryDoc),
      },
      report,
      corpus,
      availableImageRoles: availableRoles(assets),
      profile: o.profile,
      maxPages: o.maxPages,
    });
    plan = res.plan;
    notes.push(...res.adjustments.map((a) => `plan: ${a}`));
    writeJson(planPath, plan);
    progress.step(3, 'plan', 'done', `${plan.pages.length} page(s), $${res.usd.toFixed(4)}`);
  } else {
    plan = requireArtifact<SitePlan>(planPath, o.startStage);
    progress.step(3, 'plan', 'skip', 'reused plan.json');
  }
  notes.push(...plan.notes.map((n) => `unsourced: ${n}`));

  const copyIndex: CopyIndex = indexCopy(plan, corpus);
  notes.push(...copyIndex.issues.map((i) => `provenance: ${i}`));
  const copyMap: CopyMap = buildCopyMap(copyIndex);
  writeJson(path.join(siteDir, 'copy_map.json'), copyMap);

  // ---- stage: design -------------------------------------------------------------------------
  const designPath = path.join(siteDir, 'design.json');
  let design: DesignSpec;
  if (runs('design')) {
    checkBudget('design', estimate.stages.design + estimate.stages.render);
    const direction = findSection(refs.industryDoc, 'Design direction');
    const res = await runDesignStage({
      llm,
      model: o.models.design,
      persona: {
        industryDisplayName: refs.industry.display_name,
        personaName: checklist.persona.frontmatter.persona_name,
        primaryGoal: checklist.persona.frontmatter.primary_goal,
        deviceBias: checklist.persona.frontmatter.device_bias,
        goalsProse: checklist.persona.goals_prose,
      },
      designSystem: refs.designSystem,
      directionGuidance: direction ? direction.body : '',
      fonts,
      imagery: assetsToPrompt(assets),
      profile: o.profile,
    });
    design = res.spec;
    notes.push(...res.issues.map((i) => `design: ${i}`));
    writeJson(designPath, design);
    progress.step(4, 'design', 'done', design.direction);
  } else {
    design = requireArtifact<DesignSpec>(designPath, o.startStage);
    progress.step(4, 'design', 'skip', 'reused design.json');
  }
  const installedFonts = installFonts(fonts, siteDir);
  fs.writeFileSync(path.join(siteDir, 'assets', 'site.css'), design.css);
  fs.writeFileSync(path.join(siteDir, 'design.md'), design.design_md);

  const seo: SeoContext = {
    profile: o.profile,
    baseUrl,
    jsonldType: refs.jsonldType,
    facts: report.facts,
    plan,
    assets: assets.assets,
    themeColor: design.theme_color,
    buildDate: new Date().toISOString().slice(0, 10),
  };
  const phone = report.facts?.phones?.[0] ?? null;
  const renderCtx = {
    llm,
    model: o.models.render,
    seo,
    copy: copyIndex,
    assets: assets.assets,
    designMd: design.design_md,
    telHref: phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null,
    telLabel: phone,
    addressText: report.facts?.address ? (typeof report.facts.address === 'string' ? report.facts.address : formatAddress(report.facts.address)) : null,
    hoursText: report.facts?.hours ? formatHours(report.facts.hours) : null,
  };

  // ---- stage: render + validate (with repair) -------------------------------------------------
  const pagesWritten: string[] = [];
  let validation: SiteValidation | null = null;

  if (runs('render')) {
    const validateOnce = () =>
      validateSiteTree({
        siteDir,
        repo: o.repo,
        slug,
        profile: o.profile,
        plan,
        copyMap,
        copyIndex,
        report,
        installedFonts,
        jsonldType: refs.jsonldType,
      });

    let previousErrors = Number.POSITIVE_INFINITY;
    for (let attempt = 1; attempt <= o.repairPasses + 1; attempt++) {
      const targets = attempt === 1 ? plan.pages : plan.pages.filter((p) => repairNotesFor(validation!, p.path).length > 0);
      if (!targets.length) break;
      try {
        checkBudget(attempt === 1 ? 'render' : `repair ${attempt - 1}`, targets.length * estimate.stages.renderPerPage);
      } catch (e) {
        budgetStop = (e as Error).message;
        break;
      }
      const allocator = new AssetAllocator(assets.assets);
      await pool(targets, SITE_LIMITS.renderConcurrency, async (page) => {
        const repairNotes = attempt === 1 ? [] : repairNotesFor(validation!, page.path);
        const { input, lcpImage, headChecklistIds, faqChecklistIds, internalLinks } = buildRenderInput(page, renderCtx, allocator, plan.pages, repairNotes);
        const rendered: RenderedPage = (await renderPageMarkup(renderCtx, input, attempt)).page;
        const pageCopy = copyIndex.byPath.get(page.path)!;
        const hasPlaceholders = [...pageCopy.sections.flatMap((s) => [s.opener, ...s.blocks]), ...pageCopy.faq].some((s) => !s.verified);
        const html = assembleDocument({ page, rendered, ctx: renderCtx, lcpImage, hasPlaceholders, headChecklistIds, faqChecklistIds, internalLinks });
        const file = outputFile(siteDir, page.path);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
        if (!pagesWritten.includes(fileForPath(page.path))) pagesWritten.push(fileForPath(page.path));
      });
      writeSeoFiles(siteDir, seo, o.profile);
      validation = validateOnce();
      const errorCount = validation.findings.filter((f) => f.level === 'error').length;
      progress.step(5, attempt === 1 ? 'render' : `repair ${attempt - 1}`, validation.ok ? 'done' : 'error', `${errorCount} error(s)`);
      if (validation.ok) break;
      // A repair pass that did not reduce the error count will not reduce it next time either, and
      // each pass re-renders every failing page. Stop paying for it and report what is left.
      if (attempt > 1 && errorCount >= previousErrors) {
        notes.push(`repair stopped after pass ${attempt - 1}: the error count went ${previousErrors} → ${errorCount}, so further passes were not spent`);
        break;
      }
      previousErrors = errorCount;
    }
  } else {
    pagesWritten.push(...plan.pages.map((p) => fileForPath(p.path)).filter((f) => fs.existsSync(path.join(siteDir, f))));
    writeSeoFiles(siteDir, seo, o.profile);
    validation = validateSiteTree({
      siteDir,
      repo: o.repo,
      slug,
      profile: o.profile,
      plan,
      copyMap,
      copyIndex,
      report,
      installedFonts,
      jsonldType: refs.jsonldType,
    });
    progress.step(5, 'validate', validation.ok ? 'done' : 'error', `${validation.findings.filter((f) => f.level === 'error').length} error(s)`);
  }

  if (validation) {
    writeJson(path.join(siteDir, 'validate.json'), validation);
    writeJson(path.join(siteDir, 'self-test.json'), validation.selfTest);
  }
  writeSeoReport({
    file: path.join(siteDir, 'seo-report.md'),
    plan,
    profile: o.profile,
    baseUrl,
    slug,
    assets,
    copyMap,
    validation,
    notes,
    usd: llm.usd,
  });

  if (budgetStop) notes.push(budgetStop);
  return { siteDir, validation, usd: llm.usd, pagesWritten, notes, budgetStop };
}

function writeSeoFiles(siteDir: string, seo: SeoContext, profile: BuildProfile): void {
  if (profile !== 'production') return;
  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), buildSitemap(seo));
  fs.writeFileSync(path.join(siteDir, 'robots.txt'), buildRobots(seo));
  fs.writeFileSync(path.join(siteDir, 'llms.txt'), buildLlmsTxt(seo));
  fs.writeFileSync(path.join(siteDir, 'llms-full.txt'), buildLlmsFullTxt(seo));
  fs.writeFileSync(path.join(siteDir, '_headers'), buildHeadersFile());
  for (const page of seo.plan.pages) {
    const md = path.join(siteDir, markdownForPath(page.path));
    fs.mkdirSync(path.dirname(md), { recursive: true });
    fs.writeFileSync(md, buildPageMarkdown(page, seo));
  }
}

function formatAddress(address: Record<string, unknown>): string {
  const a = address;
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ');
}

function formatHours(hours: unknown): string {
  if (typeof hours === 'string') return hours;
  if (!Array.isArray(hours)) return JSON.stringify(hours);
  return hours
    .map((h) => {
      const o = h as Record<string, unknown>;
      const days = Array.isArray(o.dayOfWeek) ? o.dayOfWeek.join(', ') : String(o.dayOfWeek ?? '');
      return `${days} ${o.opens ?? ''}–${o.closes ?? ''}`.trim();
    })
    .join('; ');
}

export interface CostEstimate {
  /** Worst case: every repair pass fires. Shown as the ceiling. */
  usd: number;
  /**
   * What a build like this usually costs. Most pages pass validation first time, so gating the
   * pre-flight refusal on the worst case would block builds that were never going to be expensive.
   * Refuse on this; the per-batch checks below stop the build on what is actually spent.
   */
  expectedUsd: number;
  lines: string[];
  stages: { architecture: number; copy: number; design: number; render: number; renderPerPage: number };
}

/**
 * A cost estimate for --dry-run. Calibrated against the per-call logs of a real 6-page build rather
 * than guessed: that build's copy calls sent ~74k characters of prompt for ~29.7k input tokens, so
 * this markdown-and-URL-heavy content runs about 2.6 characters per token, not the usual 4. Output
 * sizes are observed medians, not the token ceilings, which overstate by roughly 3x.
 *
 * The copy pass is modelled with prompt caching on: the first call pays for the corpus, the rest
 * read it at a tenth. Render is modelled at the full repair budget, which is the worst case.
 */
const CHARS_PER_TOKEN = 2.6;
/** System prompt plus the non-corpus part of a plan-stage user message, in tokens. */
const PLAN_OVERHEAD_TOKENS = 9_500;

export function estimateCost(o: { corpusChars: number; maxPages: number; repairPasses: number; models: BuildOptions['models'] }): CostEstimate {
  const price = (model: string) => PRICING[model] ?? PRICING[Object.keys(PRICING).find((k) => model.startsWith(k)) ?? ''] ?? { input: 5, output: 25 };
  const corpusTokens = Math.round(o.corpusChars / CHARS_PER_TOKEN);
  const call = (model: string, inTok: number, outTok: number, cachedInTok = 0) => {
    const p = price(model);
    return (inTok * p.input + cachedInTok * p.input * 0.1 + outTok * p.output) / 1_000_000;
  };
  const lines: string[] = [];

  const arch = call(o.models.plan, corpusTokens + PLAN_OVERHEAD_TOKENS, 14_000);
  lines.push(`architecture: 1 call on ${o.models.plan} ≈ $${arch.toFixed(2)}`);

  const firstCopy = call(o.models.plan, corpusTokens + PLAN_OVERHEAD_TOKENS, 5_500);
  const cachedCopy = call(o.models.plan, PLAN_OVERHEAD_TOKENS, 5_500, corpusTokens);
  const copy = firstCopy + Math.max(0, o.maxPages - 1) * cachedCopy;
  lines.push(`copy: ${o.maxPages} calls on ${o.models.plan} ≈ $${copy.toFixed(2)} (corpus cached after the first, saving ~$${(o.maxPages * firstCopy - copy).toFixed(2)})`);

  const design = call(o.models.design, 12_000, 20_000);
  lines.push(`design: 1 call on ${o.models.design} ≈ $${design.toFixed(2)}`);

  const perRender = call(o.models.render, 12_000, 7_500);
  const renders = o.maxPages * (1 + o.repairPasses);
  const render = renders * perRender;
  // Observed: a clean build re-renders roughly a third of one page per page planned.
  const expectedRenders = o.maxPages * Math.min(1 + o.repairPasses, 1.3);
  const expectedRender = expectedRenders * perRender;
  lines.push(`render: ~${Math.round(expectedRenders)} calls on ${o.models.render} ≈ $${expectedRender.toFixed(2)}, up to ${renders} ≈ $${render.toFixed(2)} if every repair pass fires`);

  const base = arch + copy + design;
  return {
    usd: base + render,
    expectedUsd: base + expectedRender,
    lines,
    stages: { architecture: arch, copy, design, render, renderPerPage: perRender },
  };
}

export const DEFAULT_MODELS = { plan: SITE_MODELS.plan, design: SITE_MODELS.design, render: SITE_MODELS.render };
export const DEFAULT_LIMITS = { maxPages: SITE_LIMITS.maxPages, maxAssets: SITE_LIMITS.maxAssets, repairPasses: SITE_LIMITS.repairPasses, maxUsd: SITE_LIMITS.maxUsd };
