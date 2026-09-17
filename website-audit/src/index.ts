#!/usr/bin/env node
// website-audit CLI. Subcommands: audit | validate-personas | list-checks | list-modules | check-html | eval | site:*
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { MODELS, PIPELINE_VERSION, SITE_LIMITS, repoRoot } from './config.js';
import { CHECKS, REGISTERED_CHECK_IDS } from './checks/registry.js';
import { MODULES, parseList, resolveModules } from './modules.js';
import { validateAllPersonas } from './personas/load.js';
import { runAudit } from './pipeline.js';
import { checkHtmlCommand } from './site/check-html.js';
import { evalCommand } from './evals/run.js';
import { siteScaffold, sitePreview, siteValidate } from './site/commands.js';
import { DEFAULT_LIMITS, DEFAULT_MODELS, STAGES, runBuild, type Stage } from './site/build.js';

const program = new Command();
program.name('website-audit').description('URL → industry persona audit → gap report').version(PIPELINE_VERSION);

program
  .command('audit')
  .description('Audit one URL')
  .argument('<url>', 'any page on the site; scheme optional')
  .option('--industry <slug>', 'skip classification and use this industry')
  .option('--enable <ids>', 'comma-separated module ids to turn on')
  .option('--disable <ids>', 'comma-separated module ids to turn off')
  .option('--exclude-items <ids>', 'comma-separated checklist ids to skip')
  .option('--config-json <json>', 'full options object (UI): {industry, modules:{id:bool}, exclude_items:[], judge_model, tiles, max_candidate_pages, lenient}')
  .option('--from-cache <runDir>', 'reuse cached Firecrawl/LLM responses from a previous run')
  .option('--offline', 'fail on any cache miss (no network)', false)
  .option('--judge-model <model>', 'judgment model', MODELS.judgment)
  .option('--tiles <n>', 'mobile tiles sent to the judge', (v) => parseInt(v, 10), 4)
  .option('--max-candidate-pages <n>', 'top-level pages linked from home to judge for unmet subpath items (default 8, 0 = none)', (v) => parseInt(v, 10))
  .option('--judge-text <mode>', 'candidate-page judge text: lean (strip link targets/images, drop home-duplicate blocks) | full', 'lean')
  .option('--lenient', 'mark invalid judge output as fail/unverified instead of aborting', false)
  .option('--json-progress', 'emit JSON-lines progress on stdout (used by the UI)', false)
  .option('--dry-run', 'print the effective config and checklist; no network', false)
  .option('--out <dir>', 'runs directory', path.join(repoRoot(), 'runs'))
  .option('--repo-root <dir>', 'repo root (where config/ and personas/ live)')
  .option('--run-dir <dir>', 'use this exact run directory (UI)')
  .option('--launched-from <src>', 'cli|ui', 'cli')
  .option('--verbose', 'debug logging', false)
  .action(async (url: string, o) => {
    const repo = repoRoot(o.repoRoot);
    let cfg: { industry?: string; modules?: Record<string, boolean>; exclude_items?: string[]; judge_model?: string; tiles?: number; max_candidate_pages?: number | null; lenient?: boolean } = {};
    if (o.configJson) cfg = JSON.parse(o.configJson);
    const industry = o.industry ?? cfg.industry ?? null;
    const resolved = resolveModules({ enable: parseList(o.enable), disable: parseList(o.disable), config: cfg.modules, industry });
    for (const w of resolved.warnings) process.stderr.write(`warning: ${w}\n`);
    if (resolved.errors.length) {
      for (const e of resolved.errors) process.stderr.write(`error: ${e}\n`);
      process.exit(2);
    }
    if (o.judgeText !== 'lean' && o.judgeText !== 'full') {
      process.stderr.write(`error: --judge-text must be lean or full (got "${o.judgeText}")\n`);
      process.exit(2);
    }
    try {
      const res = await runAudit({
        url,
        repoRoot: repo,
        outDir: path.resolve(o.out),
        industry,
        modules: resolved.modules,
        excludeItems: [...parseList(o.excludeItems), ...(cfg.exclude_items ?? [])],
        fromCache: o.fromCache ? path.resolve(o.fromCache) : null,
        offline: !!o.offline,
        judgeModel: cfg.judge_model ?? o.judgeModel,
        tiles: cfg.tiles ?? o.tiles,
        maxCandidatePages: cfg.max_candidate_pages ?? (Number.isFinite(o.maxCandidatePages) ? o.maxCandidatePages : null),
        lenient: cfg.lenient ?? !!o.lenient,
        judgeText: o.judgeText,
        jsonProgress: !!o.jsonProgress,
        verbose: !!o.verbose,
        launchedFrom: o.launchedFrom === 'ui' ? 'ui' : 'cli',
        dryRun: !!o.dryRun,
        runDir: o.runDir ? path.resolve(o.runDir) : undefined,
      });
      if (res.dryRun) {
        process.stdout.write(`${JSON.stringify(res.dryRun, null, 2)}\n`);
        return;
      }
      if (!o.jsonProgress) {
        process.stdout.write(`\n${fs.readFileSync(path.join(res.runDir, 'report.md'), 'utf8')}\n`);
        process.stdout.write(`report: ${res.reportPath}\n`);
      }
    } catch (e) {
      const err = e as Error;
      process.stderr.write(`\n${err.name}: ${err.message}\n`);
      if (o.verbose && err.stack) process.stderr.write(`${err.stack}\n`);
      process.exit(1);
    }
  });

program
  .command('validate-personas')
  .description('Validate config/industries.yaml, config/detectors.yaml, and every persona file')
  .option('--repo-root <dir>')
  .action((o) => {
    const res = validateAllPersonas(repoRoot(o.repoRoot), REGISTERED_CHECK_IDS);
    for (const w of res.warnings) process.stdout.write(`warning: ${w.file}:${w.line} ${w.message}\n`);
    for (const v of res.violations) process.stdout.write(`error: ${v.file}:${v.line} ${v.message}\n`);
    process.stdout.write(`${res.ok ? 'OK' : 'FAILED'} — checked ${res.checked.length} industr${res.checked.length === 1 ? 'y' : 'ies'}: ${res.checked.join(', ')}\n`);
    process.exit(res.ok ? 0 : 1);
  });

program
  .command('list-checks')
  .description('Print the deterministic check catalog (ids persona authors can use)')
  .option('--json', 'JSON output', false)
  .action((o) => {
    if (o.json) {
      process.stdout.write(`${JSON.stringify(CHECKS.map((c) => ({ id: c.id, description: c.description, needs_probe: c.needsProbe })), null, 2)}\n`);
      return;
    }
    for (const c of CHECKS) process.stdout.write(`${c.id.padEnd(24)} ${c.needsProbe ? '[probe] ' : '        '}${c.description}\n`);
  });

program
  .command('list-modules')
  .description('Print module ids, defaults, and cost hints')
  .option('--json', 'JSON output', false)
  .action((o) => {
    if (o.json) {
      process.stdout.write(`${JSON.stringify(MODULES, null, 2)}\n`);
      return;
    }
    for (const m of MODULES) process.stdout.write(`${m.id.padEnd(20)} ${m.default ? 'on ' : 'off'} ${m.built ? '' : '(not built) '}${m.label} — ${m.cost}\n`);
  });

program
  .command('check-html')
  .description('Run the deterministic checks against a local HTML file (v2 self-test)')
  .argument('<file>', 'path to index.html')
  .requiredOption('--slug <slug>', 'industry slug (for the archetype JSON-LD type and persona items)')
  .option('--repo-root <dir>')
  .option('--out <file>', 'write JSON results here (default: <dir of file>/self-test.json)')
  .action((file: string, o) => {
    const code = checkHtmlCommand({ file: path.resolve(file), slug: o.slug, repo: repoRoot(o.repoRoot), out: o.out ? path.resolve(o.out) : null });
    process.exit(code);
  });

program
  .command('eval')
  .description('Run the eval set (evals/sites/*.yaml) and diff verdicts against expectations')
  .option('--site <name>', 'run one site only')
  .option('--refresh', 'ignore evals/cache and re-fetch', false)
  .option('--judge-text <mode>', 'candidate-page judge text: lean | full', 'lean')
  .option('--repo-root <dir>')
  .action(async (o) => {
    if (o.judgeText !== 'lean' && o.judgeText !== 'full') {
      process.stderr.write(`error: --judge-text must be lean or full (got "${o.judgeText}")\n`);
      process.exit(2);
    }
    const code = await evalCommand({ repo: repoRoot(o.repoRoot), site: o.site ?? null, refresh: !!o.refresh, judgeText: o.judgeText });
    process.exit(code);
  });

program
  .command('site:scaffold')
  .description('v2: write the archetype skeleton for a run (site/index.html + copy_map.json)')
  .requiredOption('--slug <slug>')
  .requiredOption('--report <path>', 'path to report.json')
  .option('--repo-root <dir>')
  .action((o) => process.exit(siteScaffold({ slug: o.slug, report: path.resolve(o.report), repo: repoRoot(o.repoRoot) })));

program
  .command('site:validate')
  .description('v2: validate a generated site directory')
  .argument('<dir>', 'site directory containing index.html and copy_map.json')
  .option('--slug <slug>', 'industry slug (default: read from the run\'s report.json)')
  .option('--repo-root <dir>')
  .action((dir: string, o) => process.exit(siteValidate({ dir: path.resolve(dir), repo: repoRoot(o.repoRoot), slug: o.slug ?? null })));

program
  .command('site:build')
  .description('SiteRedesign: rewrite a finished audit run into an SEO/AEO-optimised, persona-designed site')
  .requiredOption('--report <path>', 'path to a finished run\'s report.json')
  .option('--profile <name>', 'mockup (offline preview, default) | production (deployable)', 'mockup')
  .option('--base-url <url>', 'origin for canonical/OG/sitemap/llms.txt (required by --profile production)')
  .option('--slug <slug>', 'industry slug (default: read from report.json)')
  .option('--max-pages <n>', 'total pages to generate, including home', (v) => parseInt(v, 10), DEFAULT_LIMITS.maxPages)
  .option('--max-assets <n>', 'images to reuse from the source site', (v) => parseInt(v, 10), DEFAULT_LIMITS.maxAssets)
  .option('--assets <mode>', 'reuse (download the source site\'s own images) | placeholder', 'reuse')
  .option('--stage <name>', `start at this stage, reusing earlier artifacts: ${STAGES.join(' | ')}`, 'assets')
  .option('--repair-passes <n>', 'times to feed validation errors back into the render stage', (v) => parseInt(v, 10), DEFAULT_LIMITS.repairPasses)
  .option('--max-usd <n>', 'stop the build once Anthropic spend reaches this', (v) => parseFloat(v), DEFAULT_LIMITS.maxUsd)
  .option('--from-cache <runDir>', 'reuse cached downloads and LLM responses from another run')
  .option('--offline', 'fail on any cache miss (no network)', false)
  .option('--plan-model <model>', 'model for the plan stage', DEFAULT_MODELS.plan)
  .option('--design-model <model>', 'model for the design stage', DEFAULT_MODELS.design)
  .option('--render-model <model>', 'model for the render stage', DEFAULT_MODELS.render)
  .option('--repo-root <dir>')
  .option('--dry-run', 'print the effective config and exit', false)
  .option('--verbose', 'debug logging', false)
  .action(async (o) => {
    if (o.profile !== 'mockup' && o.profile !== 'production') {
      process.stderr.write(`error: --profile must be mockup or production (got "${o.profile}")\n`);
      process.exit(2);
    }
    if (o.assets !== 'reuse' && o.assets !== 'placeholder') {
      process.stderr.write(`error: --assets must be reuse or placeholder (got "${o.assets}")\n`);
      process.exit(2);
    }
    if (!STAGES.includes(o.stage as Stage)) {
      process.stderr.write(`error: --stage must be one of ${STAGES.join(', ')} (got "${o.stage}")\n`);
      process.exit(2);
    }
    if (o.maxPages > SITE_LIMITS.maxPages) {
      process.stderr.write(`warning: --max-pages ${o.maxPages} exceeds the ${SITE_LIMITS.maxPages}-page ceiling in config.ts; building ${SITE_LIMITS.maxPages}\n`);
    }
    try {
      const res = await runBuild({
        reportPath: path.resolve(o.report),
        repo: repoRoot(o.repoRoot),
        profile: o.profile,
        baseUrl: o.baseUrl ?? null,
        slug: o.slug ?? null,
        maxPages: Math.max(1, Math.min(o.maxPages, SITE_LIMITS.maxPages)),
        maxAssets: Math.max(0, o.maxAssets),
        useAssets: o.assets === 'reuse',
        startStage: o.stage as Stage,
        repairPasses: Math.max(0, o.repairPasses),
        maxUsd: Number.isFinite(o.maxUsd) && o.maxUsd > 0 ? o.maxUsd : DEFAULT_LIMITS.maxUsd,
        fromCache: o.fromCache ? path.resolve(o.fromCache) : null,
        offline: !!o.offline,
        models: { plan: o.planModel, design: o.designModel, render: o.renderModel },
        verbose: !!o.verbose,
        dryRun: !!o.dryRun,
      });
      if (o.dryRun) return;
      const errors = res.validation?.findings.filter((f) => f.level === 'error') ?? [];
      for (const f of errors) process.stdout.write(`error: ${f.page} [${f.gate}] ${f.message}\n`);
      if (res.budgetStop) process.stdout.write(`error: ${res.budgetStop}\n`);
      process.stdout.write(`${res.validation?.ok && !res.budgetStop ? 'OK' : 'FAILED'} — ${res.pagesWritten.length} page(s) in ${res.siteDir}, $${res.usd.toFixed(4)}\n`);
      process.stdout.write(`report: ${path.join(res.siteDir, 'seo-report.md')}\n`);
      process.exit(res.validation?.ok && !res.budgetStop ? 0 : 1);
    } catch (e) {
      const err = e as Error;
      process.stderr.write(`\n${err.name}: ${err.message}\n`);
      if (o.verbose && err.stack) process.stderr.write(`${err.stack}\n`);
      process.exit(1);
    }
  });

program
  .command('site:preview')
  .description('v2: open a generated site in the default browser')
  .argument('<dir>')
  .action((dir: string) => process.exit(sitePreview({ dir: path.resolve(dir) })));

program.parseAsync(process.argv);
