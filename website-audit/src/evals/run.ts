// Eval runner: runs the pipeline against evals/sites/*.yaml, diffs verdicts, and reports agreement,
// industry/home-rule accuracy, probe fallbacks, and the candidate miss rate.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { MODELS } from '../config.js';
import { defaultModules, resolveModules } from '../modules.js';
import { runAudit } from '../pipeline.js';
import type { Report } from '../report/schema.js';
import { urlsEqual } from '../urls.js';

const SiteSchema = z.object({
  url: z.string().min(1),
  expected_industry: z.string().min(1),
  expected_resolved_origin: z.string().optional(),
  expected_home_url: z.string().optional(),
  expected_home_rule: z.string().optional(),
  industry_override: z.string().optional(),
  modules: z.record(z.string(), z.boolean()).optional(),
  skip_items: z.array(z.string()).default([]),
  expected_items: z
    .record(
      z.string(),
      z.object({ verdict: z.enum(['pass', 'partial', 'fail']), satisfied_at_url: z.string().optional() }),
    )
    .default({}),
  notes: z.string().optional(),
});
type SiteSpec = z.infer<typeof SiteSchema>;

export interface EvalOptions {
  repo: string;
  site: string | null;
  refresh: boolean;
}

interface SiteResult {
  name: string;
  spec: SiteSpec;
  report: Report | null;
  error: string | null;
  rows: { id: string; expected: string; actual: string; match: boolean; expected_url?: string; actual_url?: string | null }[];
  industryOk: boolean | null;
  homeRuleOk: boolean | null;
  originOk: boolean | null;
  homeUrlOk: boolean | null;
  selectorMisses: { id: string; url: string }[];
  lostToFailures: { id: string; url: string; status: string }[];
  subpathLabeled: number;
  probeFallbackPages: number;
  confusion: Record<string, number>;
}

function md(s: unknown): string {
  return String(s ?? '').replace(/\|/g, '\\|');
}

export async function evalCommand(o: EvalOptions): Promise<number> {
  const sitesDir = path.join(o.repo, 'evals', 'sites');
  if (!fs.existsSync(sitesDir)) {
    process.stderr.write(`no eval set: ${sitesDir} does not exist\n`);
    return 2;
  }
  const files = fs
    .readdirSync(sitesDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .filter((f) => !o.site || path.basename(f, path.extname(f)) === o.site)
    .sort();
  if (!files.length) {
    process.stderr.write(`no eval sites matched${o.site ? ` "${o.site}"` : ''}\n`);
    return 2;
  }
  const results: SiteResult[] = [];
  for (const f of files) {
    const name = path.basename(f, path.extname(f));
    const spec = SiteSchema.parse(parseYaml(fs.readFileSync(path.join(sitesDir, f), 'utf8')));
    const runDir = path.join(o.repo, 'evals', 'cache', name);
    if (o.refresh && fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
    process.stderr.write(`\n=== ${name}: ${spec.url}\n`);
    const modules = resolveModules({ config: spec.modules ?? {}, industry: spec.industry_override ?? null });
    const res: SiteResult = {
      name, spec, report: null, error: null, rows: [], industryOk: null, homeRuleOk: null, originOk: null, homeUrlOk: null,
      selectorMisses: [], lostToFailures: [], subpathLabeled: 0, probeFallbackPages: 0, confusion: {},
    };
    try {
      const run = await runAudit({
        url: spec.url,
        repoRoot: o.repo,
        outDir: path.join(o.repo, 'evals', 'cache'),
        industry: spec.industry_override ?? null,
        modules: modules.errors.length ? defaultModules() : modules.modules,
        excludeItems: spec.skip_items,
        fromCache: null,
        offline: false,
        judgeModel: MODELS.judgment,
        tiles: 4,
        maxCandidatePages: null,
        lenient: true,
        jsonProgress: false,
        verbose: false,
        launchedFrom: 'cli',
        dryRun: false,
        runDir,
      });
      res.report = run.report;
    } catch (e) {
      res.error = (e as Error).message;
      process.stderr.write(`  error: ${res.error}\n`);
    }
    const rep = res.report;
    if (rep) {
      res.industryOk = rep.industry.slug === spec.expected_industry;
      res.homeRuleOk = spec.expected_home_rule ? rep.home_rule === spec.expected_home_rule : null;
      res.originOk = spec.expected_resolved_origin ? urlsEqual(rep.resolved_origin, spec.expected_resolved_origin) : null;
      res.homeUrlOk = spec.expected_home_url ? urlsEqual(rep.home_url, spec.expected_home_url) : null;
      res.probeFallbackPages = rep.run_meta.flags.probe_fallback_pages.length;
      for (const [id, exp] of Object.entries(spec.expected_items)) {
        const item = rep.items.find((it) => it.id === id);
        const actual = item ? item.verdict : 'missing';
        const match = actual === exp.verdict;
        res.rows.push({ id, expected: exp.verdict, actual, match, expected_url: exp.satisfied_at_url, actual_url: item?.satisfied_at_url ?? null });
        res.confusion[`${exp.verdict}→${actual}`] = (res.confusion[`${exp.verdict}→${actual}`] ?? 0) + 1;
        if (item && item.scope === 'subpath' && exp.satisfied_at_url && exp.verdict !== 'fail') {
          res.subpathLabeled++;
          const human = exp.satisfied_at_url;
          if (urlsEqual(human, rep.home_url)) continue;
          const selected = item.candidates_selected.some((u) => urlsEqual(u, human));
          if (!selected) {
            res.selectorMisses.push({ id, url: human });
          } else {
            const log = item.candidate_log.find((c) => urlsEqual(c.url, human));
            if (log && log.status !== 'evaluated') res.lostToFailures.push({ id, url: human, status: log.status });
          }
        }
      }
    }
    results.push(res);
  }

  // --- report ---
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const resultsDir = path.join(o.repo, 'evals', 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const lines: string[] = [`# Eval results ${ts}`, ''];
  const allRows = results.flatMap((r) => r.rows);
  const agreement = allRows.length ? (100 * allRows.filter((r) => r.match).length) / allRows.length : 0;
  const industryAcc = results.filter((r) => r.industryOk !== null);
  const misses = results.flatMap((r) => r.selectorMisses);
  const lost = results.flatMap((r) => r.lostToFailures);
  const subpathLabeled = results.reduce((a, r) => a + r.subpathLabeled, 0);
  lines.push(`- Sites: ${results.length} (${results.filter((r) => r.error).length} errored)`);
  lines.push(`- Verdict agreement: ${agreement.toFixed(1)}% over ${allRows.length} labeled item(s)`);
  lines.push(`- Industry accuracy: ${industryAcc.filter((r) => r.industryOk).length}/${industryAcc.length}`);
  const hr = results.filter((r) => r.homeRuleOk !== null);
  if (hr.length) lines.push(`- Home-rule accuracy: ${hr.filter((r) => r.homeRuleOk).length}/${hr.length}`);
  lines.push(`- Candidate miss rate (selector): ${subpathLabeled ? `${misses.length}/${subpathLabeled} = ${((100 * misses.length) / subpathLabeled).toFixed(0)}%` : 'n/a (no labeled subpath URLs)'}`);
  lines.push(`- Lost to scrape-failed/skipped-cap: ${lost.length}`);
  lines.push(`- Pages with probe fallback: ${results.reduce((a, r) => a + r.probeFallbackPages, 0)}`);
  const confusion: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.confusion)) confusion[k] = (confusion[k] ?? 0) + v;
  lines.push(`- Confusion (expected→actual): ${Object.entries(confusion).map(([k, v]) => `${k}: ${v}`).join(', ') || 'n/a'}`);
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.name} — ${r.spec.url}`);
    if (r.error) lines.push(`Error: ${r.error}`);
    if (r.report) {
      lines.push(`Industry: ${r.report.industry.slug} (${r.report.industry.confidence.toFixed(2)}) expected ${r.spec.expected_industry} → ${r.industryOk ? 'ok' : 'MISMATCH'}`);
      lines.push(`Home: ${r.report.home_url} rule ${r.report.home_rule}${r.spec.expected_home_rule ? ` (expected ${r.spec.expected_home_rule} → ${r.homeRuleOk ? 'ok' : 'MISMATCH'})` : ''}`);
      lines.push(`Verdict: ${r.report.summary.verdict}; credits ${r.report.run_meta.credits_used}; $${r.report.run_meta.anthropic_usd}`);
    }
    if (r.rows.length) {
      lines.push('', '| id | expected | actual | ok | expected url | actual url |', '|---|---|---|---|---|---|');
      for (const row of r.rows) lines.push(`| ${md(row.id)} | ${row.expected} | ${row.actual} | ${row.match ? 'yes' : 'NO'} | ${md(row.expected_url)} | ${md(row.actual_url)} |`);
    }
    if (r.selectorMisses.length) lines.push('', `Selector missed: ${r.selectorMisses.map((m) => `${m.id} → ${m.url}`).join('; ')}`);
    if (r.lostToFailures.length) lines.push(`Lost to failures: ${r.lostToFailures.map((m) => `${m.id} → ${m.url} (${m.status})`).join('; ')}`);
    lines.push('');
  }
  const outFile = path.join(resultsDir, `${ts}.md`);
  fs.writeFileSync(outFile, lines.join('\n'));
  process.stdout.write(`${lines.slice(0, 10).join('\n')}\n\nfull results: ${outFile}\n`);
  return results.some((r) => r.error) ? 1 : 0;
}
