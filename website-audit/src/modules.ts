// Module registry: every optional part of the audit is a toggle. Resolve, map, and the home mobile
// scrape are the always-on core. Skipped work is always declared in report.json / report.md.

export const MODULE_IDS = [
  'classify',
  'common-checklist',
  'persona-checklist',
  'deterministic',
  'judgment',
  'subpath',
  'desktop',
  'facts',
  'lighthouse',
  // OpenSEO enrichment. Off by default: each one needs a connected OpenSEO account, and the
  // dataforseo-billed ones spend real money per call.
  'openseo-crawl',
  'openseo-search-console',
  'openseo-analytics',
  'openseo-project-context',
  'openseo-lighthouse',
  'openseo-keywords',
  'openseo-rankings',
  'openseo-serp',
  'openseo-competitors',
  'openseo-backlinks',
  'openseo-local-pack',
  'openseo-local-grid',
  'openseo-reviews',
  'openseo-rank-tracking',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Which half of the interface a module belongs to. */
export type ModuleGroup = 'audit' | 'openseo';

/**
 * Who gets paid when a module runs.
 * - `none`       — this repo's own pipeline (Firecrawl/Anthropic, already covered by `cost`).
 * - `openseo`    — needs a connected OpenSEO account but spends no DataForSEO credits.
 * - `dataforseo` — bills your DataForSEO key per call. Always off by default.
 */
export type ModuleBilling = 'none' | 'openseo' | 'dataforseo';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  default: boolean;
  cost: string;
  built: boolean;
  group: ModuleGroup;
  billing: ModuleBilling;
  /** Connection the module needs beyond an OpenSEO login, shown in the UI. */
  requires?: string;
  /** OpenSEO MCP tools this module maps to, in call order. */
  tools?: string[];
}

export function isOpenSeoModule(id: string): boolean {
  return id.startsWith('openseo-');
}

export const OPENSEO_MODULE_IDS = MODULE_IDS.filter(isOpenSeoModule);

export const MODULES: ModuleDef[] = [
  { id: 'classify', label: 'Industry classification', description: 'Detect the industry with one Haiku call. Off = you must pick the industry.', default: true, cost: 'One Haiku call, < $0.01', built: true, group: 'audit', billing: 'none' },
  { id: 'common-checklist', label: 'Cross-industry checklist', description: 'Machine-readability items from personas/_common.md.', default: true, cost: 'No extra cost by itself', built: true, group: 'audit', billing: 'none' },
  { id: 'persona-checklist', label: 'Industry persona checklist', description: 'Visitor-goal items from personas/<slug>.md.', default: true, cost: 'No extra cost by itself', built: true, group: 'audit', billing: 'none' },
  { id: 'deterministic', label: 'Deterministic checks', description: 'Code checks against the scraped HTML and layout probe.', default: true, cost: 'Free (no API calls)', built: true, group: 'audit', billing: 'none' },
  { id: 'judgment', label: 'Judgment checks (vision)', description: 'Opus 5 evaluates judgment items from screenshots + text.', default: true, cost: 'About $0.10-0.30 per page on Opus 5', built: true, group: 'audit', billing: 'none' },
  { id: 'subpath', label: 'Subpath candidate search', description: 'For unmet subpath items, judge the top-level pages linked from the home page (up to 8) and stop once every item has passed.', default: true, cost: 'Up to 8 Firecrawl credits + up to 8 judgment calls', built: true, group: 'audit', billing: 'none' },
  { id: 'desktop', label: 'Desktop screenshot', description: 'Secondary 1366x768 full-page screenshot of the home page.', default: true, cost: '1 Firecrawl credit', built: true, group: 'audit', billing: 'none' },
  { id: 'facts', label: 'Facts extraction', description: 'Business name, phones, address, hours, services for the v2 builder.', default: true, cost: 'Free', built: true, group: 'audit', billing: 'none' },
  { id: 'lighthouse', label: 'Lighthouse scores', description: 'Reserved: mobile + desktop Lighthouse categories run locally (not built yet). For Lighthouse today, use the OpenSEO module.', default: false, cost: 'Local Chrome, no API cost', built: false, group: 'audit', billing: 'none' },

  // ---- OpenSEO enrichment: free with an OpenSEO account (no DataForSEO spend) ----
  {
    id: 'openseo-crawl',
    label: 'Whole-site technical crawl',
    description: 'OpenSEO crawls the whole site (robots-aware, same-origin) and returns prioritized technical issues: broken links, duplicate/missing titles and descriptions, redirect chains, orphan pages, canonical conflicts, thin content. Complements this audit, which judges the home page and its linked pages in depth.',
    default: false,
    cost: 'Free — OpenSEO crawls on its own compute, no DataForSEO call',
    built: true,
    group: 'openseo',
    billing: 'openseo',
    tools: ['run_site_audit', 'get_audit_status', 'get_audit_issues', 'get_audit_pages'],
  },
  {
    id: 'openseo-search-console',
    label: 'Search Console performance',
    description: 'Clicks, impressions, CTR and average position from the client\'s own Search Console, plus URL inspection and striking-distance opportunities (positions 4-20).',
    default: false,
    cost: 'Free — reads the connected Google property',
    built: true,
    group: 'openseo',
    billing: 'openseo',
    requires: 'Search Console connected in OpenSEO (client-owned data)',
    tools: ['get_search_console_performance', 'get_search_opportunities', 'inspect_urls'],
  },
  {
    id: 'openseo-analytics',
    label: 'GA4 organic performance',
    description: 'Organic sessions, engagement, key events and revenue by landing page from the connected GA4 property, with a previous-period comparison.',
    default: false,
    cost: 'Free — reads the connected Google property',
    built: true,
    group: 'openseo',
    billing: 'openseo',
    requires: 'GA4 connected in OpenSEO (client-owned data)',
    tools: ['get_google_analytics_organic_overview', 'get_google_analytics_organic_landing_pages'],
  },
  {
    id: 'openseo-project-context',
    label: 'Project context sync',
    description: 'Create or match the OpenSEO project for this domain and write what the audit learned (business overview, key pages) into its shared memory, so every later OpenSEO run is grounded in the same brief.',
    default: false,
    cost: 'Free — OpenSEO database only',
    built: true,
    group: 'openseo',
    billing: 'openseo',
    tools: ['list_projects', 'get_project_context', 'update_project_context'],
  },

  // ---- OpenSEO enrichment: billed to your DataForSEO key ----
  {
    id: 'openseo-lighthouse',
    label: 'Lighthouse / Core Web Vitals',
    description: 'Lighthouse on a sample of crawled pages, mobile + desktop: performance, accessibility, best-practices and SEO scores plus LCP, CLS, INP and TTFB.',
    default: false,
    cost: 'DataForSEO — samples up to 10 pages x 2 devices (~20 checks)',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    requires: 'Whole-site technical crawl (runs as part of it)',
    tools: ['run_site_audit'],
  },
  {
    id: 'openseo-keywords',
    label: 'Keyword research',
    description: 'Search volume, difficulty, CPC, intent and related ideas for the services this audit found, so the rebuild targets demand that exists.',
    default: false,
    cost: 'DataForSEO — per seed keyword',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    tools: ['research_keywords', 'get_keyword_metrics', 'save_keywords'],
  },
  {
    id: 'openseo-rankings',
    label: 'Organic footprint',
    description: 'Estimated organic traffic, organic keyword count and the keywords the domain already ranks for, with position and volume. The "what you are leaving on the table" number for outreach.',
    default: false,
    cost: 'DataForSEO — ~100-300 credits per domain (cached 12h)',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    tools: ['get_domain_overview', 'get_ranked_keywords'],
  },
  {
    id: 'openseo-serp',
    label: 'SERP snapshot',
    description: 'Live Google results for the target keywords: who actually ranks, and where this business sits against them.',
    default: false,
    cost: 'DataForSEO — ~5 credits per keyword at depth 20',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    tools: ['get_serp_results'],
  },
  {
    id: 'openseo-competitors',
    label: 'SERP competitor set',
    description: 'Which domains compete for the same keyword set, and how their footprint compares. Names the real local competitors instead of the ones the client assumes.',
    default: false,
    cost: 'DataForSEO — per keyword set, plus ~100-300 per competitor looked up',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    tools: ['find_serp_competitors', 'get_domain_overview'],
  },
  {
    id: 'openseo-backlinks',
    label: 'Backlink profile',
    description: 'Total backlinks, referring domains, top referrers, and authority/spam signals — the usual deciding evidence for whether content or links are the constraint.',
    default: false,
    cost: 'DataForSEO — ~50 credits per domain, ~30 per detail page',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    requires: 'Backlinks API enabled on the DataForSEO account',
    tools: ['get_backlinks_overview', 'get_backlinks_profile'],
  },
  {
    id: 'openseo-local-pack',
    label: 'Google Business Profile + local pack',
    description: 'Reads the business\'s Google profile (categories, rating, review count, hours, claimed status, photos) and the Maps/local-finder results near it. The highest-value module for local service businesses.',
    default: false,
    cost: 'DataForSEO — per profile and per local SERP',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    requires: 'Facts extraction on (business name + address come from the audit)',
    tools: ['get_business_profile', 'get_local_serp_results', 'search_local_businesses'],
  },
  {
    id: 'openseo-local-grid',
    label: 'Local rank grid (Maps)',
    description: 'Runs one Maps search per point of a grid around the business and maps where it does and does not show up. The single most persuasive visual in a local pitch — and the most expensive module here.',
    default: false,
    cost: 'DataForSEO — one Maps search per grid point per keyword (a 5x5 grid = 25)',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    requires: 'Facts extraction on (needs the business location)',
    tools: ['get_local_rank_grid'],
  },
  {
    id: 'openseo-reviews',
    label: 'Review gap analysis',
    description: 'Google reviews with rating, text and whether the owner replied — for the review-count and unanswered-review gap against local competitors.',
    default: false,
    cost: 'DataForSEO — per business',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    requires: 'Facts extraction on (business name + address come from the audit)',
    tools: ['get_business_reviews', 'get_business_updates'],
  },
  {
    id: 'openseo-rank-tracking',
    label: 'Rank tracker setup',
    description: 'Create a rank tracker for the target keywords so position changes are measurable after the rebuild. Setup itself is free; only the checks cost.',
    default: false,
    cost: 'Free to set up — DataForSEO per scheduled or live check afterwards',
    built: true,
    group: 'openseo',
    billing: 'dataforseo',
    tools: ['create_rank_tracker', 'add_rank_tracking_keywords', 'estimate_rank_tracker_cost'],
  },
];

export type ModuleSet = Record<ModuleId, boolean>;

export interface ResolveModulesInput {
  enable?: string[];
  disable?: string[];
  config?: Partial<Record<string, boolean>>;
  industry?: string | null;
}

export interface ResolvedModules {
  modules: ModuleSet;
  warnings: string[];
  errors: string[];
}

export function defaultModules(): ModuleSet {
  return Object.fromEntries(MODULES.map((m) => [m.id, m.default])) as ModuleSet;
}

export function isModuleId(id: string): id is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(id);
}

export function resolveModules(input: ResolveModulesInput): ResolvedModules {
  const modules = defaultModules();
  const warnings: string[] = [];
  const errors: string[] = [];
  const apply = (id: string, on: boolean, via: string) => {
    if (!isModuleId(id)) {
      errors.push(`unknown module "${id}" (${via}); valid: ${MODULE_IDS.join(', ')}`);
      return;
    }
    const def = MODULES.find((m) => m.id === id)!;
    if (on && !def.built) {
      errors.push(`module "${id}" is not built yet`);
      return;
    }
    modules[id] = on;
  };
  for (const [id, on] of Object.entries(input.config ?? {})) apply(id, !!on, 'config');
  for (const id of input.enable ?? []) apply(id, true, '--enable');
  for (const id of input.disable ?? []) apply(id, false, '--disable');

  if (!modules.classify && !input.industry) errors.push('module "classify" is off but no --industry <slug> was given');
  if (!modules.deterministic && !modules.judgment) warnings.push('both "deterministic" and "judgment" are off: no checklist items will be evaluated');
  if (!modules['common-checklist'] && !modules['persona-checklist']) warnings.push('both checklists are off: no items will be loaded');
  if (modules.subpath && !modules.deterministic && !modules.judgment) warnings.push('"subpath" has no effect while both check modules are off');

  if (modules['openseo-lighthouse'] && !modules['openseo-crawl']) {
    warnings.push('"openseo-lighthouse" runs as part of the OpenSEO crawl: enabling "openseo-crawl" too');
    modules['openseo-crawl'] = true;
  }
  const needsFacts = OPENSEO_MODULE_IDS.filter((id) => modules[id] && MODULES.find((m) => m.id === id)?.requires?.startsWith('Facts extraction'));
  if (needsFacts.length && !modules.facts) {
    warnings.push(`${needsFacts.map((id) => `"${id}"`).join(', ')} need the business name and address from "facts", which is off: their requests will have no location pre-filled`);
  }
  return { modules, warnings, errors };
}

export function parseList(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
