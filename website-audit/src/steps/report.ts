// Step 8: report.json assembly, ranking, overall verdict, report.md rendering, and the canonical form
// used for replay equality and evals.
import type { Report, ReportItem } from '../report/schema.js';
import type { Verdict, Weight } from '../personas/schema.js';

const WEIGHT_RANK: Record<Weight, number> = { high: 3, med: 2, low: 1 };
const VERDICT_RANK: Record<Verdict, number> = { fail: 0, partial: 1, pass: 2 };

/** Ranking for gaps: weight (high first) → fail before partial → persona before common → checklist order. */
export function rankGaps(items: ReportItem[]): ReportItem[] {
  const order = new Map(items.map((it, i) => [it.id, i]));
  return items
    .filter((it) => it.verdict !== 'pass')
    .sort(
      (a, b) =>
        WEIGHT_RANK[b.weight] - WEIGHT_RANK[a.weight] ||
        VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
        (a.source === 'persona' ? 0 : 1) - (b.source === 'persona' ? 0 : 1) ||
        order.get(a.id)! - order.get(b.id)!,
    );
}

/** Rule-based overall verdict over evaluated items only. */
export function overallVerdict(items: ReportItem[]): Report['summary']['verdict'] {
  if (!items.length) return 'n/a';
  const fails = items.filter((it) => it.verdict === 'fail');
  const highFail = fails.some((it) => it.weight === 'high');
  const highPartial = items.filter((it) => it.verdict === 'partial' && it.weight === 'high').length;
  if (highFail || fails.length >= 3) return 'weak';
  if (fails.length >= 1 || highPartial >= 2) return 'fair';
  return 'strong';
}

function moduleLabel(id: string): string {
  return (
    {
      classify: 'industry classification',
      'common-checklist': 'cross-industry checklist',
      'persona-checklist': 'industry persona checklist',
      deterministic: 'deterministic checks',
      judgment: 'judgment checks',
      subpath: 'subpath search',
      desktop: 'desktop screenshot',
      facts: 'facts extraction',
      lighthouse: 'lighthouse',
    }[id] ?? id
  );
}

export interface MarkdownExtras {
  displayName: string;
  placeholderRatio?: { placeholder: number; total: number } | null;
}

export function renderMarkdown(report: Report, extras: MarkdownExtras): string {
  const host = new URL(report.home_url).hostname;
  const verdict = report.summary.verdict === 'n/a' ? 'N/A' : report.summary.verdict.toUpperCase();
  const lines: string[] = [];
  lines.push(`# ${host} — ${extras.displayName} persona audit`);
  lines.push(
    `Verdict: ${verdict}${report.summary.partial_audit ? ' (partial audit)' : ''} · industry: ${report.industry.slug} (${report.industry.confidence.toFixed(2)}${report.industry.source === 'override' ? ', override' : ''}) · home: ${report.home_url} (rule: ${report.home_rule})`,
  );
  const skippedBits: string[] = [];
  for (const m of report.summary.skipped.modules) skippedBits.push(`${moduleLabel(m)} (module off)`);
  if (report.summary.skipped.item_ids.length) skippedBits.push(`items ${report.summary.skipped.item_ids.join(', ')} (excluded)`);
  if (skippedBits.length) lines.push(`Not evaluated: ${skippedBits.join(', ')}`);
  lines.push('');
  lines.push('## Gaps');
  const gaps = rankGaps(report.items);
  if (!gaps.length) {
    lines.push(report.items.length ? 'None. Every evaluated item passed.' : 'No items were evaluated.');
  } else {
    gaps.forEach((g, i) => {
      const where = g.satisfied_at_url && g.verdict === 'partial' && g.satisfied_at_url !== report.home_url ? ` (at ${g.satisfied_at_url})` : '';
      const unverified = g.unverified ? ` [unverified: ${g.unverified}]` : '';
      lines.push(`${i + 1}. [${g.weight}] ${g.id} — ${g.verdict} — ${g.evidence.summary}${where}${unverified}`);
    });
  }
  if (extras.placeholderRatio && extras.placeholderRatio.total > 0) {
    const r = extras.placeholderRatio;
    lines.push('');
    lines.push(`Placeholder copy: ${r.placeholder} of ${r.total} paragraphs (${Math.round((100 * r.placeholder) / r.total)}%).`);
    lines.push('Note: the single-page preview is a layout/content mockup, not the SEO page-architecture recommendation.');
  }
  lines.push('');
  return lines.join('\n');
}

/** Strip run-specific fields so two runs of the same inputs compare equal. */
export function canonicalReport(report: Report): unknown {
  const { run_meta, ...rest } = report;
  const { timestamps: _t, run_dir: _r, cache_source: _c, cache_stats: _s, anthropic_usd: _u, credits_used: _cr, launched_from: _l, ...metaRest } = run_meta;
  // Error text differs between a live failure and an offline cache miss; the status is what matters.
  const items = rest.items.map((it) => ({ ...it, candidate_log: it.candidate_log.map(({ error: _e, ...c }) => c) }));
  return { ...rest, items, run_meta: metaRest };
}
