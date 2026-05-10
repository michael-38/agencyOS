import fs from 'fs';
import path from 'path';
import { ClinicInfo, Issue, ModuleResult } from '../types.js';
import { sortIssues } from '../utils/scoring.js';

interface KeywordResult {
  keyword: string;
  rank: number | null;
  topThree: { title: string; url: string; snippet?: string }[];
}

interface RankingEvidence {
  keywords: KeywordResult[];
  domain: string;
}

function deriveKeywords(clinic: ClinicInfo, override?: string[]): string[] {
  if (override && override.length > 0) return override.slice(0, 10);
  const city = clinic.city;
  const out: string[] = [];
  if (city) {
    out.push(`med spa ${city}`);
    out.push(`medical spa ${city}`);
    out.push(`botox ${city}`);
    out.push(`lip filler ${city}`);
    out.push(`microneedling ${city}`);
    out.push(`laser hair removal ${city}`);
  }
  out.push(clinic.name);
  for (const svc of clinic.services.slice(0, 3)) {
    if (city) out.push(`${svc.toLowerCase()} ${city}`);
  }
  return Array.from(new Set(out)).slice(0, 8);
}

async function searchKeyword(keyword: string, domain: string, apiKey: string): Promise<KeywordResult> {
  const { getJson } = await import('serpapi');
  const data: any = await getJson({ engine: 'google', q: keyword, num: 100, api_key: apiKey, hl: 'en', gl: 'us' });
  const results: any[] = data.organic_results || [];
  const topThree = results.slice(0, 3).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
  let rank: number | null = null;
  for (let i = 0; i < results.length; i += 1) {
    const link = results[i].link || '';
    try {
      const host = new URL(link).hostname.replace(/^www\./, '');
      if (host === domain || host.endsWith(`.${domain}`)) {
        rank = i + 1;
        break;
      }
    } catch {
      /* noop */
    }
  }
  return { keyword, rank, topThree };
}

export async function runSeoRankingModule(
  clinic: ClinicInfo,
  rawDir: string,
  keywordsOverride?: string[]
): Promise<ModuleResult<RankingEvidence>> {
  const start = Date.now();
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return {
      id: 'seo-ranking',
      label: 'SEO (Google rank)',
      status: 'skipped',
      score: null,
      summary: 'Skipped — SERPAPI_API_KEY not set.',
      issues: [],
      skipReason: 'Set SERPAPI_API_KEY in .env to run Google ranking checks.',
      durationMs: Date.now() - start,
    };
  }

  const keywords = deriveKeywords(clinic, keywordsOverride);
  const results: KeywordResult[] = [];
  for (const k of keywords) {
    try {
      results.push(await searchKeyword(k, clinic.domain, apiKey));
    } catch (err: any) {
      results.push({ keyword: k, rank: null, topThree: [] });
    }
  }

  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, 'serp-results.json'), JSON.stringify(results, null, 2));

  const issues: Issue[] = [];
  let scoreSum = 0;
  for (const r of results) {
    let pts = 0;
    if (r.rank === null) {
      pts = 0;
      issues.push({
        severity: 'high',
        title: `Not in top 100 for "${r.keyword}"`,
        description: `Top result: ${r.topThree[0]?.url || 'n/a'}`,
        quickFix: 'Build a dedicated page targeting this keyword with on-page SEO + local backlinks.',
      });
    } else if (r.rank > 20) {
      pts = 25;
      issues.push({
        severity: 'high',
        title: `Ranked #${r.rank} for "${r.keyword}" (page 3+)`,
        description: 'Effectively invisible — searchers rarely scroll past page 2.',
        quickFix: `Page beating you: ${r.topThree[0]?.url}. Match its depth + add local schema.`,
      });
    } else if (r.rank > 10) {
      pts = 50;
      issues.push({
        severity: 'medium',
        title: `Ranked #${r.rank} for "${r.keyword}" (page 2)`,
        description: 'Within striking distance of page 1.',
        quickFix: 'Improve title/H1 keyword match, add internal links, build 2–3 local citations.',
      });
    } else if (r.rank > 3) {
      pts = 80;
      issues.push({
        severity: 'low',
        title: `Ranked #${r.rank} for "${r.keyword}" (page 1)`,
        description: 'On page 1 but below the fold of organic results.',
        quickFix: 'Push to top 3: refresh content, gather reviews, earn one local link.',
      });
    } else {
      pts = 100;
    }
    scoreSum += pts;
  }
  const score = results.length === 0 ? 0 : Math.round(scoreSum / results.length);

  return {
    id: 'seo-ranking',
    label: 'SEO (Google rank)',
    status: 'ok',
    score,
    summary: `${results.filter((r) => r.rank && r.rank <= 10).length} of ${results.length} keywords rank on page 1.`,
    issues: sortIssues(issues),
    evidence: { keywords: results, domain: clinic.domain },
    durationMs: Date.now() - start,
  };
}
