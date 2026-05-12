import fs from 'fs';
import path from 'path';
import { ClinicInfo, Issue, ModuleResult } from '../types.js';
import { ScrapedSite } from '../extractors/scrape.js';
import { sortIssues } from '../utils/scoring.js';
import { log } from '../utils/logger.js';

interface TopKeyword {
  keyword: string;
  position: number;
  searchVolume: number;
  traffic: number;
  cpc: number;
  url: string;
}

interface ApiCall {
  endpoint: string;
  ok: boolean;
  ms: number;
  error?: string;
}

interface TrafficEvidence {
  domain: string;
  estimatedMonthlyVisits: number;
  organicTrafficValueUsd: number;
  organicKeywordCount: number;
  paidKeywordCount: number;
  domainRank: number | null;
  backlinks: number;
  referringDomains: number;
  brokenPages: number;
  topKeywords: TopKeyword[];
  socialPlatforms: string[];
  domainCreatedAt: string | null;
  domainAgeDays: number | null;
  apiCalls: ApiCall[];
}

const DFS_BASE = 'https://api.dataforseo.com';

async function dfsPost(endpoint: string, body: unknown, auth: string, apiCalls: ApiCall[]): Promise<any> {
  const start = Date.now();
  try {
    const res = await fetch(`${DFS_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 401) {
      throw new Error(
        'HTTP 401 — DataForSEO rejected the credentials. Login must be your account email; password is the API password from https://app.dataforseo.com/api-access (not your dashboard login password).'
      );
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    const task = json.tasks?.[0];
    if (!task) throw new Error('no tasks in response');
    if (task.status_code !== 20000) throw new Error(`task status ${task.status_code}: ${task.status_message}`);
    apiCalls.push({ endpoint, ok: true, ms: Date.now() - start });
    return task;
  } catch (err: any) {
    apiCalls.push({ endpoint, ok: false, ms: Date.now() - start, error: err.message });
    throw err;
  }
}

async function getDomainOverview(domain: string, auth: string, apiCalls: ApiCall[]) {
  const endpoint = '/v3/dataforseo_labs/google/domain_rank_overview/live';
  const task = await dfsPost(
    endpoint,
    [{ target: domain, location_code: 2840, language_code: 'en' }],
    auth,
    apiCalls
  );
  return task.result?.[0]?.metrics ?? null;
}

async function getBacklinksSummary(domain: string, auth: string, apiCalls: ApiCall[]) {
  const endpoint = '/v3/backlinks/summary/live';
  const task = await dfsPost(
    endpoint,
    [{ target: domain, internal_list_limit: 10, backlinks_status_type: 'live' }],
    auth,
    apiCalls
  );
  return task.result?.[0] ?? null;
}

async function getRankedKeywords(domain: string, auth: string, apiCalls: ApiCall[]): Promise<TopKeyword[]> {
  const endpoint = '/v3/dataforseo_labs/google/ranked_keywords/live';
  const task = await dfsPost(
    endpoint,
    [
      {
        target: domain,
        location_code: 2840,
        language_code: 'en',
        limit: 100,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
    ],
    auth,
    apiCalls
  );
  const items: any[] = task.result?.[0]?.items ?? [];
  const mapped: TopKeyword[] = items
    .map((it) => {
      const ranked = it.ranked_serp_element?.serp_item ?? {};
      const kw = it.keyword_data?.keyword_info ?? {};
      const position = ranked.rank_absolute ?? ranked.rank_group ?? 0;
      const searchVolume = kw.search_volume ?? 0;
      const cpc = kw.cpc ?? 0;
      // Rough CTR by position; DataForSEO doesn't return per-keyword traffic in this endpoint.
      const ctr = position <= 0 ? 0 : position === 1 ? 0.28 : position === 2 ? 0.15 : position === 3 ? 0.1 : position <= 10 ? 0.04 : position <= 20 ? 0.01 : 0.003;
      return {
        keyword: it.keyword_data?.keyword ?? '',
        position,
        searchVolume,
        traffic: Math.round(searchVolume * ctr),
        cpc,
        url: ranked.url ?? '',
      };
    })
    .filter((k) => k.keyword && k.position > 0)
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, 25);
  return mapped;
}

async function getDomainAge(domain: string, apiCalls: ApiCall[]): Promise<{ createdAt: string | null; ageDays: number | null }> {
  const start = Date.now();
  const endpoint = `https://rdap.org/domain/${domain}`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    const reg = (json.events ?? []).find((e: any) => e.eventAction === 'registration');
    apiCalls.push({ endpoint: 'rdap.org/domain', ok: true, ms: Date.now() - start });
    if (!reg?.eventDate) return { createdAt: null, ageDays: null };
    const created = new Date(reg.eventDate);
    if (Number.isNaN(created.getTime())) return { createdAt: null, ageDays: null };
    const ageDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
    return { createdAt: created.toISOString(), ageDays };
  } catch (err: any) {
    apiCalls.push({ endpoint: 'rdap.org/domain', ok: false, ms: Date.now() - start, error: err.message });
    return { createdAt: null, ageDays: null };
  }
}

function detectSocialPlatforms(site: ScrapedSite): string[] {
  const haystack = `${site.markdown}\n${site.html}`.toLowerCase();
  const platforms: { name: string; rx: RegExp }[] = [
    { name: 'instagram', rx: /instagram\.com\/[a-z0-9_.\-]{2,}/ },
    { name: 'facebook', rx: /facebook\.com\/[a-z0-9.\-]{2,}/ },
    { name: 'tiktok', rx: /tiktok\.com\/@[a-z0-9_.\-]{2,}/ },
    { name: 'youtube', rx: /youtube\.com\/(@|c\/|channel\/|user\/)[a-z0-9_.\-]{2,}/ },
    { name: 'twitter', rx: /(?:twitter\.com|x\.com)\/[a-z0-9_]{2,}/ },
  ];
  const found = new Set<string>();
  for (const p of platforms) if (p.rx.test(haystack)) found.add(p.name);
  return Array.from(found);
}

function tier(value: number, thresholds: number[], scores: number[]): number {
  for (let i = thresholds.length - 1; i >= 0; i -= 1) {
    if (value >= thresholds[i]) return scores[i];
  }
  return scores[0];
}

export async function runTrafficMetricsModule(
  clinic: ClinicInfo,
  site: ScrapedSite,
  rawDir: string
): Promise<ModuleResult<TrafficEvidence>> {
  const start = Date.now();
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return {
      id: 'traffic-metrics',
      label: 'Traffic & authority',
      status: 'skipped',
      score: null,
      summary: 'Skipped — DataForSEO credentials not set.',
      issues: [],
      skipReason: 'Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env to run traffic-metrics.',
      durationMs: Date.now() - start,
    };
  }

  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  const domain = clinic.domain;
  const apiCalls: ApiCall[] = [];

  const [overviewRes, backlinksRes, keywordsRes, ageRes] = await Promise.allSettled([
    getDomainOverview(domain, auth, apiCalls),
    getBacklinksSummary(domain, auth, apiCalls),
    getRankedKeywords(domain, auth, apiCalls),
    getDomainAge(domain, apiCalls),
  ]);

  const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
  const backlinks = backlinksRes.status === 'fulfilled' ? backlinksRes.value : null;
  const topKeywords = keywordsRes.status === 'fulfilled' ? keywordsRes.value : [];
  const age = ageRes.status === 'fulfilled' ? ageRes.value : { createdAt: null, ageDays: null };

  if (overviewRes.status === 'rejected') log.warn(`traffic-metrics: domain_rank_overview failed — ${overviewRes.reason?.message}`);
  if (backlinksRes.status === 'rejected') log.warn(`traffic-metrics: backlinks_summary failed — ${backlinksRes.reason?.message}`);
  if (keywordsRes.status === 'rejected') log.warn(`traffic-metrics: ranked_keywords failed — ${keywordsRes.reason?.message}`);

  // Persist raw payloads for debugging
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(
    path.join(rawDir, 'traffic-metrics.json'),
    JSON.stringify(
      {
        domain,
        overview,
        backlinks,
        keywords: topKeywords,
        domainAge: age,
        apiCalls,
      },
      null,
      2
    )
  );

  // If DataForSEO has no record of this domain, skip gracefully.
  if (!overview && !backlinks && topKeywords.length === 0) {
    return {
      id: 'traffic-metrics',
      label: 'Traffic & authority',
      status: 'skipped',
      score: null,
      summary: 'Skipped — DataForSEO has no data for this domain.',
      issues: [],
      skipReason: 'No DataForSEO coverage. This often means the domain is new or extremely low-traffic.',
      evidence: {
        domain,
        estimatedMonthlyVisits: 0,
        organicTrafficValueUsd: 0,
        organicKeywordCount: 0,
        paidKeywordCount: 0,
        domainRank: null,
        backlinks: 0,
        referringDomains: 0,
        brokenPages: 0,
        topKeywords: [],
        socialPlatforms: detectSocialPlatforms(site),
        domainCreatedAt: age.createdAt,
        domainAgeDays: age.ageDays,
        apiCalls,
      },
      durationMs: Date.now() - start,
    };
  }

  const organicEtv = overview?.organic?.etv ?? 0;
  const organicCount = overview?.organic?.count ?? 0;
  const paidCount = overview?.paid?.count ?? 0;
  const sumKeywordTraffic = topKeywords.reduce((a, k) => a + k.traffic, 0);
  const weightedCpc = topKeywords.length
    ? topKeywords.reduce((a, k) => a + k.cpc, 0) / topKeywords.length
    : 0;
  const estimatedMonthlyVisits = sumKeywordTraffic > 0
    ? sumKeywordTraffic
    : Math.round(organicEtv / Math.max(weightedCpc, 1.5));

  const domainRank = backlinks?.rank ?? null;
  const referringDomains = backlinks?.referring_domains ?? 0;
  const totalBacklinks = backlinks?.backlinks ?? 0;
  const brokenPages = backlinks?.broken_pages ?? 0;

  const socialPlatforms = detectSocialPlatforms(site);

  const evidence: TrafficEvidence = {
    domain,
    estimatedMonthlyVisits,
    organicTrafficValueUsd: Math.round(organicEtv),
    organicKeywordCount: organicCount,
    paidKeywordCount: paidCount,
    domainRank,
    backlinks: totalBacklinks,
    referringDomains,
    brokenPages,
    topKeywords,
    socialPlatforms,
    domainCreatedAt: age.createdAt,
    domainAgeDays: age.ageDays,
    apiCalls,
  };

  // Scoring
  const visitsScore = estimatedMonthlyVisits >= 10000
    ? 100
    : tier(estimatedMonthlyVisits, [0, 500, 2000], [0, 25, 50, 75]);
  const rankScore = domainRank === null ? 0 : Math.max(0, Math.min(100, domainRank / 10));
  const backlinksScore = tier(referringDomains, [0, 1, 10, 50, 200], [0, 30, 60, 80, 100]);
  const keywordsScore = tier(organicCount, [0, 5, 25, 100, 500], [0, 25, 50, 75, 100]);
  const ageBonus = age.ageDays === null ? 0 : age.ageDays > 730 ? 50 : age.ageDays > 365 ? 25 : 0;
  const socialAgeBonus = Math.min(100, socialPlatforms.length * 15 + ageBonus);

  const score = Math.round(
    0.35 * visitsScore +
      0.25 * rankScore +
      0.2 * backlinksScore +
      0.15 * keywordsScore +
      0.05 * socialAgeBonus
  );

  // Issues
  const issues: Issue[] = [];
  if (estimatedMonthlyVisits === 0 && organicCount === 0) {
    issues.push({
      severity: 'critical',
      title: 'Site has no organic acquisition channel',
      description: 'DataForSEO sees zero ranking keywords and no estimated organic traffic.',
      quickFix: 'No one finds this on Google. Start with 5 city+service landing pages and a Google Business Profile.',
    });
  } else if (estimatedMonthlyVisits > 0 && estimatedMonthlyVisits < 500) {
    issues.push({
      severity: 'high',
      title: `Estimated <500 monthly organic visits (${estimatedMonthlyVisits.toLocaleString()})`,
      description: 'Bottom-quartile traffic for the med-spa peer set.',
      quickFix: 'Audit content depth on the top 3 service pages and rebuild around buyer intent.',
    });
  }

  if (referringDomains === 0) {
    issues.push({
      severity: 'critical',
      title: 'Zero referring domains',
      description: 'No external domains link to this site — the strongest single signal of SEO weakness.',
      quickFix: 'Build 3 local citations (Yelp, RealSelf, BBB) in week 1; pitch 2 local partner links.',
    });
  }

  if (domainRank !== null && domainRank < 100) {
    issues.push({
      severity: 'high',
      title: `Domain rank ${domainRank}/1000 (peer baseline ~200)`,
      description: 'DataForSEO domain rank is well below the typical med-spa peer baseline.',
      quickFix: 'Run a 90-day local link campaign — partners, press, charity events.',
    });
  }

  if (organicCount > 0 && organicCount < 5) {
    issues.push({
      severity: 'high',
      title: `Only ${organicCount} keywords ranking on Google`,
      description: 'Almost no organic surface area on Google.',
      quickFix: `Launch one service-page-per-treatment with local intent (e.g., "botox ${clinic.city || 'your city'}").`,
    });
  }

  if (socialPlatforms.length === 0) {
    issues.push({
      severity: 'medium',
      title: 'No social profile presence detected',
      description: 'No Instagram, Facebook, TikTok, YouTube, or Twitter/X links found on the site.',
      quickFix: 'Add Instagram + Facebook links in the footer. Med-spa buyers verify on IG before booking.',
    });
  } else if (socialPlatforms.length === 1) {
    issues.push({
      severity: 'low',
      title: `Only ${socialPlatforms[0]} linked from the site`,
      description: 'Limited social trust surface for buyer verification.',
      quickFix: 'Cross-link Instagram, Facebook, and TikTok minimum — 3 social trust signals.',
    });
  }

  if (age.ageDays !== null && age.ageDays < 365) {
    issues.push({
      severity: 'info',
      title: 'Domain registered <1 year ago',
      description: `Domain age is ${age.ageDays} days.`,
      quickFix: 'New domains rank slower. Front-load reviews + GBP signals to bootstrap trust.',
    });
  }

  if (brokenPages > 5) {
    issues.push({
      severity: 'medium',
      title: `${brokenPages} broken pages on the site`,
      description: 'Broken pages leak crawl budget and authority.',
      quickFix: 'Run a site-wide 301 cleanup — fix or redirect 404s in week 1.',
    });
  }

  const summary = `${estimatedMonthlyVisits.toLocaleString()} est. monthly visits · domain rank ${
    domainRank ?? '—'
  }/1000 · ${referringDomains.toLocaleString()} referring domains · ${organicCount.toLocaleString()} keywords.`;

  return {
    id: 'traffic-metrics',
    label: 'Traffic & authority',
    status: 'ok',
    score,
    summary,
    issues: sortIssues(issues),
    evidence,
    durationMs: Date.now() - start,
  };
}
