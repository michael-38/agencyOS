// site:build — the templated-site orchestrator.
//
// Stages run assets → content → fill → validate, and each writes its artifact beside report.json so
// a later stage can be re-run on its own without repeating the earlier ones. Only `content` costs
// money, which makes `--stage fill` the loop this design exists for: edit the template, re-fill,
// re-validate, spend nothing.
//
// There is no repair pass. A validation failure is now either a template bug — fix the template and
// re-fill for free — or a content problem, which is one call to re-ask. Feeding errors back into a
// generation pass was worth it when a model wrote the markup; with a deterministic fill it would only
// be re-running the same pure function against the same inputs.
import fs from 'node:fs';
import path from 'node:path';
import { PRICING, SITE_LIMITS, SITE_MODELS, loadEnv, requireEnv } from '../config.js';
import { RunCache } from '../cache.js';
import { Progress } from '../progress.js';
import { LlmClient, type LlmParser } from '../llm/client.js';
import { REGISTERED_CHECK_IDS } from '../checks/registry.js';
import { loadChecklist, loadIndustries } from '../personas/load.js';
import { loadHtml } from '../checks/html.js';
import type { Report } from '../report/schema.js';
import { harvestAssets } from './assets.js';
import { decideBrand, logoAccent, readTemplateColours } from './brand.js';
import { buildCorpus, corpusToPrompt, factsToPrompt } from './corpus.js';
import { buildFilledCopyMap, indexFilledCopy, type CopyIndex } from './copy.js';
import { ContentPackSchema, entitiesOf, runContentStage, type ContentPack } from './content.js';
import { fill, markUnverified } from './fill.js';
import { buildHeadersFile, buildRobots, buildSitemap, pageLlmsTxt, pageMarkdown, patchHead, type PageSeoContext } from './page-seo.js';
import { findSection, loadBuildReferences, referenceToPrompt } from './reference.js';
import { readTemplate, type TemplateManifest } from './template.js';
import { promptedSlots } from '../llm/prompts/site-content.js';
import { validateSiteTree, type SiteValidation } from './validate.js';
import { writeSeoReport } from './report.js';
import type { AssetManifest, BuildProfile, CopyMap } from './types.js';

export const STAGES = ['assets', 'content', 'fill', 'validate'] as const;
export type Stage = (typeof STAGES)[number];

export interface BuildOptions {
  reportPath: string;
  repo: string;
  profile: BuildProfile;
  baseUrl: string | null;
  slug: string | null;
  /** Read this template instead of the industry's registered one. */
  templatePath: string | null;
  /** `auto` (from the client's logo) | `off` | a hex colour. */
  brand: string;
  maxAssets: number;
  useAssets: boolean;
  startStage: Stage;
  maxUsd: number;
  fromCache: string | null;
  offline: boolean;
  model: string;
  verbose: boolean;
  dryRun: boolean;
  /**
   * Replaces the Anthropic client. Supplied by the offline end-to-end test so the whole orchestrator
   * — corpus, pack validation, provenance, fill, head, sidecars, gates, report — can be exercised
   * from a recorded pack without a single API call.
   */
  llm?: LlmParser;
}

export interface BuildResult {
  siteDir: string;
  validation: SiteValidation | null;
  usd: number;
  pagesWritten: string[];
  notes: string[];
  /** Set when the build stopped before spending because it hit --max-usd. */
  budgetStop: string | null;
}

/** Thrown before the call that would have spent, so nothing is billed once the budget is reached. */
export class BudgetExceeded extends Error {
  constructor(readonly spent: number, readonly projected: number, readonly limit: number, readonly stage: string) {
    super(
      `--max-usd $${limit.toFixed(2)} would be exceeded by the ${stage} stage: $${spent.toFixed(4)} spent, ~$${projected.toFixed(2)} projected. Raise --max-usd, or check the template's slot count.`,
    );
    this.name = 'BudgetExceeded';
  }
}

const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

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

/** Hosts the audited site links out to, so a real booking system survives the structure gate. */
function outboundHosts(report: Report, runDir: string): string[] {
  const hosts = new Set<string>();
  for (const page of report.pages) {
    if (!page.html_path) continue;
    const file = path.join(runDir, page.html_path);
    if (!fs.existsSync(file)) continue;
    const $ = loadHtml(fs.readFileSync(file, 'utf8'));
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (!/^(https?:)?\/\//i.test(href)) return;
      try {
        hosts.add(new URL(href.startsWith('//') ? `https:${href}` : href).hostname.toLowerCase().replace(/^www\./, ''));
      } catch {
        // Not a URL worth allowing.
      }
    });
  }
  return [...hosts];
}

export async function runBuild(o: BuildOptions): Promise<BuildResult> {
  const reportPath = path.resolve(o.reportPath);
  if (!fs.existsSync(reportPath)) throw new Error(`report not found: ${reportPath}`);
  const runDir = path.dirname(reportPath);
  const siteDir = path.join(runDir, 'site');
  const report = readJson<Report>(reportPath);
  const slug = o.slug ?? report.industry.slug;

  const industries = loadIndustries(o.repo);
  const industry = industries.industries.find((i) => i.slug === slug);
  if (!industry) throw new Error(`unknown industry slug "${slug}"; valid: ${industries.industries.map((i) => i.slug).join(', ')}`);
  const refs = loadBuildReferences(o.repo, industries, slug);
  const checklist = loadChecklist(o.repo, industries, slug, { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  if (!checklist.persona) throw new Error(`no persona could be loaded for slug "${slug}"`);

  const templateRel = o.templatePath ?? industry.template_file;
  const templateAbs = path.isAbsolute(templateRel) ? templateRel : path.join(o.repo, templateRel);
  const manifest = readTemplate(templateAbs, slug, templateRel);
  const templateHtml = fs.readFileSync(templateAbs, 'utf8');

  const baseUrl = (o.baseUrl ?? new URL(report.home_url).origin).replace(/\/+$/, '');
  if (o.profile === 'production' && !o.baseUrl) {
    throw new Error('--profile production requires --base-url (canonical, Open Graph, sitemap, and llms.txt all need the real origin)');
  }

  const progress = new Progress(runDir, false, o.verbose);
  const notes: string[] = [...refs.gaps.map((g) => `build reference: ${g}`)];

  const corpus = buildCorpus(report, runDir, { maxCharsPerPage: SITE_LIMITS.corpusMaxCharsPerPage });
  // The prompted slots, not every declared one: `fact.*` values and mirrors are filled by code and
  // never reach the request, so counting them would overstate both halves of the estimate.
  const promptedCount = promptedSlots(manifest).length;
  const estimate = estimateCost({ corpusChars: corpus.total_chars, slotCount: promptedCount, model: o.model });

  if (o.dryRun) {
    progress.info(`dry run — slug=${slug} profile=${o.profile} base=${baseUrl} template=${templateRel} brand=${o.brand} assets<=${o.useAssets ? o.maxAssets : 0}`);
    progress.info(
      `template: ${promptedCount} prompted slot(s) of ${manifest.slots.length} declared, ${manifest.repeats.length} repeat group(s), ${manifest.sections.length} section(s), covers ${manifest.coveredChecklistIds.length} checklist id(s)`,
    );
    progress.info(`corpus ${corpus.pages.length} page(s), ${corpus.total_chars} chars (~${Math.round(corpus.total_chars / CHARS_PER_TOKEN)} tokens)`);
    for (const line of estimate.lines) progress.info(`  ${line}`);
    progress.info(
      `expected $${estimate.expectedUsd.toFixed(2)}, worst case $${estimate.usd.toFixed(2)} (budget --max-usd $${o.maxUsd.toFixed(2)}${
        estimate.expectedUsd >= o.maxUsd ? ' — this build would be refused' : ''
      })`,
    );
    return { siteDir, validation: null, usd: 0, pagesWritten: [], notes, budgetStop: null };
  }

  if (!corpus.pages.length) throw new Error('the run has no scraped markdown to rewrite (raw/pages/*/page.md is empty)');

  fs.mkdirSync(siteDir, { recursive: true });
  loadEnv(o.repo);
  const cache = new RunCache(runDir, o.fromCache, o.offline);
  const llm: LlmParser = o.llm ?? new LlmClient(requireEnv('ANTHROPIC_API_KEY'), cache, runDir, progress);

  const stageIndex = STAGES.indexOf(o.startStage);
  const runs = (s: Stage) => STAGES.indexOf(s) >= stageIndex;
  progress.step(1, 'corpus', 'done', `${corpus.pages.length} page(s), ${corpus.total_chars} chars`);

  // Refuse before doing any work at all, not just before the billed call: downloading a client's
  // whole image library for a build that cannot finish is wasted time either way.
  if (runs('content') && llm.usd + estimate.expectedUsd >= o.maxUsd) {
    throw new BudgetExceeded(llm.usd, estimate.expectedUsd, o.maxUsd, 'content');
  }

  // ---- stage: assets ---------------------------------------------------------------------------
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
  const stockish = assets.assets.filter((a) => a.likely_stock);
  if (stockish.length) notes.push(`${stockish.length} harvested image(s) look like stock-library downloads and were not placed; the template's labelled stand-in was kept instead`);

  // ---- stage: content --------------------------------------------------------------------------
  const contentPath = path.join(siteDir, 'content.json');
  let pack: ContentPack;
  if (runs('content')) {
    const res = await runContentStage({
      llm,
      model: o.model,
      persona: {
        industryDisplayName: industry.display_name,
        personaName: checklist.persona.frontmatter.persona_name,
        primaryGoal: checklist.persona.frontmatter.primary_goal,
        deviceBias: checklist.persona.frontmatter.device_bias,
        goalsProse: [checklist.persona?.goals_prose, checklist.common?.goals_prose].filter(Boolean).join('\n\n'),
      },
      guidance: {
        archetype: referenceToPrompt(refs.archetypeDoc),
        industry: referenceToPrompt(refs.industryDoc),
      },
      gaps: report.items
        .filter((i) => i.verdict !== 'pass')
        .map((i) => ({ id: i.id, criterion: i.criterion, verdict: i.verdict, weight: i.weight, scope: i.scope, note: i.note ?? '' })),
      manifest,
      corpus: corpusToPrompt(corpus),
      facts: factsToPrompt(report.facts),
      profile: o.profile,
    });
    pack = res.pack;
    writeJson(contentPath, pack);
    progress.step(3, 'content', 'done', `${pack.slots.length} slot value(s), $${res.usd.toFixed(4)}${res.cacheHit ? ' (cache hit)' : ''}`);
  } else {
    pack = ContentPackSchema.parse(requireArtifact<unknown>(contentPath, o.startStage));
    progress.step(3, 'content', 'skip', 'reused content.json');
  }
  notes.push(...pack.notes.map((n) => `content: ${n}`));

  // ---- stage: fill -----------------------------------------------------------------------------
  const pagesWritten: string[] = [];
  let copyMap: CopyMap = { paragraphs: [], placeholder_ratio: 0 };
  let copyIndex: CopyIndex = { slots: [], byPath: new Map(), issues: [], placeholderIds: new Set(), entityQuotes: [] };
  const entities = entitiesOf(pack);

  if (runs('fill')) {
    // Brand: the accent, and only the accent, comes from the client.
    const colours = readTemplateColours(templateHtml);
    let brandCss: string | null = null;
    if (!colours) {
      notes.push(`brand: ${templateRel} does not declare --brand-accent / --brand-accent-fg, so its own accent was kept`);
    } else {
      const extracted = o.brand === 'auto' ? await logoAccent(assets.assets, siteDir) : null;
      const decision = decideBrand({ mode: o.brand, extracted, templateAccent: colours.templateAccent, surfaces: colours.surfaces });
      brandCss = decision.css;
      notes.push(
        ...decision.notes.map((n) => `brand: ${n}`),
        ...(decision.css
          ? [
              `brand: accent ${decision.accent} from ${decision.origin}, contrast ${decision.ratios
                .map((r) => `${r.ratio.toFixed(2)}:1 (${r.scheme}, needs ${r.required})`)
                .join(', ')}`,
            ]
          : []),
      );
    }

    const filled = fill({ manifest, templateHtml, pack, facts: report.facts, assets: o.useAssets ? assets.assets : [], brandCss });
    notes.push(...filled.notes.map((n) => `fill: ${n}`));

    // Head and structured data, in code, from the filled page.
    const $ = loadHtml(filled.html);
    const seoCtx: PageSeoContext = {
      profile: o.profile,
      baseUrl,
      jsonldType: refs.jsonldType,
      facts: report.facts,
      businessName: report.facts?.business_name ?? pack.business_name,
      siteSummary: pack.site_summary,
      title: pack.title,
      metaDescription: pack.meta_description,
      entities,
      assets: o.useAssets ? assets.assets : [],
      buildDate: new Date().toISOString().slice(0, 10),
    };
    const head = patchHead($, seoCtx);

    // Provenance is decided here, not in the fill: a quote the model declared but the scraped pages
    // do not contain loses its credit, and the page has to say so.
    copyIndex = indexFilledCopy(filled.copy, entities, corpus);
    const unverified = markUnverified($, copyIndex.placeholderIds);
    copyMap = buildFilledCopyMap(copyIndex);

    const html = $.html();
    fs.writeFileSync(path.join(siteDir, 'index.html'), html);
    pagesWritten.push('/');
    writeJson(path.join(siteDir, 'copy_map.json'), copyMap);
    notes.push(...copyIndex.issues.map((i) => `provenance: ${i}`));
    writeJson(path.join(siteDir, 'template.json'), {
      slug,
      file: manifest.file,
      sha256: manifest.sha256,
      slots_declared: manifest.slots.length,
      slots_filled: filled.copy.length,
      slots_dropped: filled.droppedSlots,
      slots_unknown: filled.unknownSlots,
      groups_empty: filled.emptyGroups,
      regions_omitted: filled.omittedRegions,
      checklist_ids_covered: manifest.coveredChecklistIds,
    });

    writeSidecars({ siteDir, $, ctx: seoCtx, faq: head.faq, profile: o.profile, baseUrl, buildDate: seoCtx.buildDate });
    progress.step(
      4,
      'fill',
      'done',
      `${filled.copy.length} block(s), ${unverified} unverified, ${filled.omittedRegions.length} region(s) omitted`,
    );
  } else {
    progress.step(4, 'fill', 'skip', 'reused index.html');
    if (fs.existsSync(path.join(siteDir, 'copy_map.json'))) copyMap = readJson<CopyMap>(path.join(siteDir, 'copy_map.json'));
    if (fs.existsSync(path.join(siteDir, 'index.html'))) pagesWritten.push('/');
  }

  // ---- stage: validate -------------------------------------------------------------------------
  let validation: SiteValidation | null = null;
  if (runs('validate') && pagesWritten.length) {
    validation = validateSiteTree({
      siteDir,
      repo: o.repo,
      slug,
      profile: o.profile,
      page: { path: '/', title: pack.title, meta_description: pack.meta_description },
      copyMap,
      copyIndex,
      report,
      installedFonts: [],
      jsonldType: refs.jsonldType,
      residue: { mockTokens: manifest.mockTokens, demoLexicon: manifest.demoLexicon },
      allowedLinkHosts: outboundHosts(report, runDir),
      templateCoveredIds: manifest.coveredChecklistIds,
    });
    progress.step(5, 'validate', validation.ok ? 'done' : 'error', `${validation.findings.filter((f) => f.level === 'error').length} error(s)`);
    writeJson(path.join(siteDir, 'validate.json'), validation);
    writeJson(path.join(siteDir, 'self-test.json'), validation.selfTest);
  }

  writeSeoReport({
    file: path.join(siteDir, 'seo-report.md'),
    profile: o.profile,
    baseUrl,
    slug,
    manifest,
    pack,
    assets,
    copyMap,
    validation,
    checklist: report.items.filter((i) => i.verdict !== 'pass').map((i) => ({ id: i.id, criterion: i.criterion, verdict: i.verdict, weight: i.weight, scope: i.scope })),
    notes,
    usd: llm.usd,
  });

  return { siteDir, validation, usd: llm.usd, pagesWritten, notes, budgetStop: null };
}

function writeSidecars(o: {
  siteDir: string;
  $: ReturnType<typeof loadHtml>;
  ctx: PageSeoContext;
  faq: { q: string; a: string }[];
  profile: BuildProfile;
  baseUrl: string;
  buildDate: string;
}): void {
  if (o.profile !== 'production') return;
  fs.writeFileSync(path.join(o.siteDir, 'sitemap.xml'), buildSitemap(o.baseUrl, o.buildDate));
  fs.writeFileSync(path.join(o.siteDir, 'robots.txt'), buildRobots(o.baseUrl));
  fs.writeFileSync(path.join(o.siteDir, 'llms.txt'), pageLlmsTxt(o.$, o.ctx, o.faq));
  fs.writeFileSync(path.join(o.siteDir, '_headers'), buildHeadersFile());
  fs.writeFileSync(path.join(o.siteDir, 'index.md'), pageMarkdown(o.$, o.ctx, o.faq));
}

// ---------------------------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------------------------

export interface CostEstimate {
  /** Worst case: the corpus at its cap and the output at its ceiling. */
  usd: number;
  /** What a build like this usually costs, and what the pre-flight refusal is gated on. */
  expectedUsd: number;
  lines: string[];
}

/**
 * Calibrated against the per-call logs of real builds rather than guessed: this markdown-and-URL
 * heavy content runs about 2.6 characters per token, not the usual 4, and output sizes are observed
 * medians rather than the token ceiling, which overstates by roughly 3x.
 */
const CHARS_PER_TOKEN = 2.6;
/** System prompt, facts, persona prose, audit gaps and the build reference, in tokens. */
const OVERHEAD_TOKENS = 4_200;
/** A slot costs roughly this much output: its sentence, its verbatim quote, and the JSON around it. */
const TOKENS_PER_SLOT = 130;
/** The slot table itself, per slot: id, kind, rules and intent. */
const TABLE_TOKENS_PER_SLOT = 58;

export function estimateCost(o: { corpusChars: number; slotCount: number; model: string }): CostEstimate {
  const p = PRICING[o.model] ?? PRICING[Object.keys(PRICING).find((k) => o.model.startsWith(k)) ?? ''] ?? { input: 5, output: 25 };
  const corpusTokens = Math.round(o.corpusChars / CHARS_PER_TOKEN);
  const tableTokens = o.slotCount * TABLE_TOKENS_PER_SLOT;
  const inTok = corpusTokens + tableTokens + OVERHEAD_TOKENS;
  const outTok = Math.min(SITE_LIMITS.packMaxTokens, o.slotCount * TOKENS_PER_SLOT + 1_200);
  const thinking = 4_000;

  const cost = (input: number, output: number) => (input * p.input + output * p.output) / 1_000_000;
  const expectedUsd = cost(inTok, outTok + thinking);
  const worstIn = Math.round((SITE_LIMITS.corpusMaxCharsPerPage * 1) / CHARS_PER_TOKEN) + tableTokens + OVERHEAD_TOKENS;
  const usd = cost(Math.max(inTok, worstIn), SITE_LIMITS.packMaxTokens + 8_000);

  return {
    expectedUsd,
    usd,
    lines: [
      `content: 1 call on ${o.model}`,
      `  input  ~${inTok.toLocaleString()} tok (corpus ${corpusTokens.toLocaleString()} + slot table ${tableTokens.toLocaleString()} + overhead ${OVERHEAD_TOKENS.toLocaleString()})`,
      `  output ~${outTok.toLocaleString()} tok for ${o.slotCount} slot(s), plus ~${thinking.toLocaleString()} thinking`,
      `  assets, fill, head, sidecars and every gate are code: $0.00`,
    ],
  };
}

export const DEFAULT_MODEL = SITE_MODELS.plan;
export const DEFAULT_LIMITS = { maxAssets: SITE_LIMITS.maxAssets, maxUsd: SITE_LIMITS.templateMaxUsd };
