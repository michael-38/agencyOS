import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalReport, overallVerdict, rankGaps, renderMarkdown } from '../src/steps/report.js';
import type { Report, ReportItem } from '../src/report/schema.js';
import { defaultModules } from '../src/modules.js';
import type { Verdict, Weight } from '../src/personas/schema.js';

function item(id: string, weight: Weight, verdict: Verdict, extra: Partial<ReportItem> = {}): ReportItem {
  return {
    id,
    source: 'persona',
    criterion: `criterion ${id}`,
    scope: 'home',
    check: 'deterministic',
    weight,
    verdict,
    evidence: { method: 'deterministic', summary: `summary ${id}` },
    candidates_checked: [],
    satisfied_at_url: verdict === 'fail' ? null : 'https://www.example.com/',
    note: '',
    candidates_selected: [],
    candidate_log: [],
    unverified: null,
    extra: {},
    ...extra,
  };
}

function report(items: ReportItem[], over: Partial<Report['summary']> = {}): Report {
  return {
    input_url: 'example.com',
    resolved_origin: 'https://www.example.com',
    home_url: 'https://www.example.com/',
    home_rule: 'root-2xx',
    rules_fired: [],
    industry: { slug: 'landscaping', confidence: 0.93, raw_slug: 'landscaping', rationale: 'r', source: 'llm' },
    persona_file: 'personas/landscaping.md',
    persona_fallback: false,
    items,
    summary: {
      pass: items.filter((i) => i.verdict === 'pass').length,
      partial: items.filter((i) => i.verdict === 'partial').length,
      fail: items.filter((i) => i.verdict === 'fail').length,
      top_gaps: rankGaps(items).slice(0, 5).map((i) => i.id),
      verdict: overallVerdict(items),
      partial_audit: false,
      skipped: { modules: [], item_ids: [] },
      ...over,
    },
    facts: null,
    pages: [],
    run_meta: {
      timestamps: { started: '2026-09-14T00:00:00Z', finished: '2026-09-14T00:01:00Z' },
      models: { judgment: 'claude-opus-5' },
      credits_used: 12,
      anthropic_usd: 0.58,
      viewports: { mobile: [390, 844], desktop: [1366, 768] },
      run_dir: '/tmp/x',
      cache_source: null,
      cache_stats: { hits: 1, misses: 2, source_hits: 0 },
      persona_hashes: { 'personas/landscaping.md': 'abc' },
      probe_version: 2,
      pipeline_version: '0.1.0',
      modules: defaultModules(),
      launched_from: 'cli',
      flags: { markdown_truncated_pages: [], probe_fallback_pages: [], second_map: false, subdomain_share: 0 },
    },
  };
}

test('rankGaps: weight → fail before partial → persona before common → checklist order; passes excluded', () => {
  const items = [
    item('a-low-fail', 'low', 'fail'),
    item('b-high-partial-common', 'high', 'partial', { source: 'common' }),
    item('c-high-partial', 'high', 'partial'),
    item('d-high-fail', 'high', 'fail'),
    item('e-pass', 'high', 'pass'),
    item('f-med-fail', 'med', 'fail'),
  ];
  assert.deepEqual(
    rankGaps(items).map((i) => i.id),
    ['d-high-fail', 'c-high-partial', 'b-high-partial-common', 'f-med-fail', 'a-low-fail'],
  );
});

test('overallVerdict rules', () => {
  assert.equal(overallVerdict([]), 'n/a');
  assert.equal(overallVerdict([item('a', 'high', 'fail'), item('b', 'low', 'pass')]), 'weak');
  assert.equal(overallVerdict([item('a', 'low', 'fail'), item('b', 'low', 'fail'), item('c', 'med', 'fail')]), 'weak');
  assert.equal(overallVerdict([item('a', 'low', 'fail'), item('b', 'high', 'pass')]), 'fair');
  assert.equal(overallVerdict([item('a', 'high', 'partial'), item('b', 'high', 'partial')]), 'fair');
  assert.equal(overallVerdict([item('a', 'high', 'partial'), item('b', 'high', 'pass')]), 'strong');
  assert.equal(overallVerdict([item('a', 'high', 'pass')]), 'strong');
});

test('renderMarkdown: gaps only, ranked, one evidence line each, no preamble', () => {
  const r = report([item('x-pass', 'high', 'pass'), item('y-fail', 'high', 'fail'), item('z-partial', 'med', 'partial', { satisfied_at_url: 'https://www.example.com/gallery' })]);
  const md = renderMarkdown(r, { displayName: 'Landscaping & lawn care' });
  const lines = md.trim().split('\n');
  assert.equal(lines[0], '# www.example.com — Landscaping & lawn care persona audit');
  assert.match(lines[1], /^Verdict: WEAK · industry: landscaping \(0\.93\) · home: https:\/\/www\.example\.com\/ \(rule: root-2xx\)$/);
  assert.equal(lines[2], '');
  assert.equal(lines[3], '## Gaps');
  assert.equal(lines[4], '1. [high] y-fail — fail — summary y-fail');
  assert.equal(lines[5], '2. [med] z-partial — partial — summary z-partial (at https://www.example.com/gallery)');
  assert.ok(!md.includes('x-pass'));
  assert.ok(!md.includes('Not evaluated'));
  assert.ok(!md.includes('Placeholder copy'));
});

test('renderMarkdown: Not evaluated line, (partial audit) suffix, [unverified] tag, empty states', () => {
  const r = report([item('y-fail', 'high', 'fail', { unverified: 'judge-output-invalid' })], {
    partial_audit: true,
    skipped: { modules: ['judgment', 'subpath'], item_ids: ['LS-x'] },
  });
  const md = renderMarkdown(r, { displayName: 'L' });
  assert.match(md, /Verdict: WEAK \(partial audit\)/);
  assert.match(md, /^Not evaluated: judgment checks \(module off\), subpath search \(module off\), items LS-x \(excluded\)$/m);
  assert.match(md, /y-fail — fail — summary y-fail \[unverified: judge-output-invalid\]/);

  const allPass = renderMarkdown(report([item('a', 'high', 'pass')]), { displayName: 'L' });
  assert.match(allPass, /None\. Every evaluated item passed\./);
  assert.match(allPass, /Verdict: STRONG/);
  const none = renderMarkdown(report([]), { displayName: 'L' });
  assert.match(none, /Verdict: N\/A/);
  assert.match(none, /No items were evaluated\./);

  const v2 = renderMarkdown(report([item('a', 'high', 'pass')]), { displayName: 'L', placeholderRatio: { placeholder: 6, total: 21 } });
  assert.match(v2, /Placeholder copy: 6 of 21 paragraphs \(29%\)\./);
  assert.match(v2, /layout\/content mockup/);
});

test('canonicalReport strips run-specific fields and candidate_log error text', () => {
  const r = report([item('a', 'high', 'fail', { candidate_log: [{ url: 'https://www.example.com/g', status: 'scrape-failed', error: 'timeout' }] })]);
  const c = canonicalReport(r) as { run_meta: Record<string, unknown>; items: ReportItem[]; home_url: string };
  for (const k of ['timestamps', 'run_dir', 'cache_source', 'cache_stats', 'anthropic_usd', 'credits_used', 'launched_from']) assert.ok(!(k in c.run_meta), k);
  for (const k of ['models', 'viewports', 'persona_hashes', 'probe_version', 'pipeline_version', 'modules', 'flags']) assert.ok(k in c.run_meta, k);
  assert.deepEqual(c.items[0].candidate_log, [{ url: 'https://www.example.com/g', status: 'scrape-failed' }]);
  assert.equal(c.home_url, r.home_url);
  // Two reports that differ only in stripped fields are canonically equal.
  const r2 = report(r.items);
  r2.run_meta.run_dir = '/elsewhere';
  r2.run_meta.credits_used = 0;
  r2.items[0].candidate_log[0].error = 'offline miss';
  assert.deepEqual(canonicalReport(r), canonicalReport(r2));
});
