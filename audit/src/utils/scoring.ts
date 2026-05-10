import { Issue, ModuleId, ModuleResult, Severity } from '../types.js';

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
  info: 0,
};

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const MODULE_WEIGHT: Record<ModuleId, number> = {
  lighthouse: 1.5,
  'seo-onpage': 1.2,
  'seo-ranking': 1.0,
  'llm-copy-aeo': 1.0,
  'llm-discoverability': 1.3,
  'copy-conversion': 1.3,
  'design-review': 1.0,
  'ux-medspa': 1.5,
};

export const MODULE_LABEL: Record<ModuleId, string> = {
  lighthouse: 'Lighthouse',
  'seo-onpage': 'SEO (on-page)',
  'seo-ranking': 'SEO (Google rank)',
  'llm-copy-aeo': 'LLM copy / AEO',
  'llm-discoverability': 'LLM discoverability',
  'copy-conversion': 'Copy & conversion',
  'design-review': 'Design',
  'ux-medspa': 'UX (med spa)',
};

export function scoreFromIssues(issues: Issue[], baseline = 100): number {
  let score = baseline;
  for (const issue of issues) {
    score -= SEVERITY_WEIGHT[issue.severity];
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function overallScore(modules: ModuleResult[]): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const m of modules) {
    if (m.status !== 'ok' || m.score === null) continue;
    const w = MODULE_WEIGHT[m.id] ?? 1;
    weightedSum += m.score * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return 0;
  return Math.round(weightedSum / weightTotal);
}

export function severityCounts(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const i of issues) counts[i.severity] += 1;
  return counts;
}

export function scoreBand(score: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (score === null) return 'none';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}
