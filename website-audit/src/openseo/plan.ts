// OpenSEO enrichment plan.
//
// The audit runs as a plain node script, so it cannot call MCP tools itself — those live in the
// agent session. What this module does instead is turn the enabled OpenSEO toggles into concrete,
// pre-filled tool calls: the domain, the business identity and the keyword seeds all come from the
// audit that just ran, so the operator agent (or the /openseo:* skills) executes them without
// re-deriving anything. Nothing here spends money; it decides what *would* be spent and says so.
import { MODULES, OPENSEO_MODULE_IDS, type ModuleBilling, type ModuleId, type ModuleSet } from '../modules.js';
import type { Facts } from '../checks/facts.js';

export interface OpenSeoRequest {
  module: ModuleId;
  label: string;
  billing: ModuleBilling;
  cost: string;
  requires: string | null;
  tools: string[];
  /** Pre-filled arguments, derived from this audit. `null` means the agent must supply it. */
  args: Record<string, unknown>;
  note: string;
}

export interface OpenSeoPlan {
  /** Modules the operator switched on, in registry order. */
  enabled: ModuleId[];
  free: ModuleId[];
  dataforseo: ModuleId[];
  /** `not-run` until an agent session executes the requests and writes results back. */
  status: 'not-run';
  executed_by: 'agent';
  target: {
    domain: string;
    url: string;
    business_name: string | null;
    locality: string | null;
    phone: string | null;
  };
  keyword_seeds: string[];
  requests: OpenSeoRequest[];
}

/** Pull a city/region out of JSON-LD PostalAddress or a free-text address line. */
export function localityOf(address: Facts['address']): string | null {
  if (!address) return null;
  if (typeof address === 'string') {
    // "123 Main St, Provo, UT 84601" → "Provo, UT"
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const region = (parts[parts.length - 1] ?? '').replace(/\s*\d{5}(-\d{4})?$/, '').trim();
    const city = parts[parts.length - 2] ?? '';
    return [city, region].filter(Boolean).join(', ') || null;
  }
  const city = typeof address['addressLocality'] === 'string' ? address['addressLocality'].trim() : '';
  const region = typeof address['addressRegion'] === 'string' ? address['addressRegion'].trim() : '';
  return [city, region].filter(Boolean).join(', ') || null;
}

/** Service names + locality make the seed set a local business would actually be searched by. */
export function keywordSeeds(facts: Facts | null, industrySlug: string, locality: string | null, max = 5): string[] {
  const seeds: string[] = [];
  const push = (s: string) => {
    const v = s.trim().replace(/\s+/g, ' ');
    if (v && v.length <= 60 && !seeds.some((x) => x.toLowerCase() === v.toLowerCase())) seeds.push(v);
  };
  for (const service of facts?.services ?? []) push(locality ? `${service} ${locality.split(',')[0]}` : service);
  if (!seeds.length) {
    const industry = industrySlug.replace(/-/g, ' ');
    push(locality ? `${industry} ${locality.split(',')[0]}` : industry);
  }
  return seeds.slice(0, max);
}

export interface BuildPlanInput {
  modules: ModuleSet;
  homeUrl: string;
  industrySlug: string;
  facts: Facts | null;
}

export function buildOpenSeoPlan(input: BuildPlanInput): OpenSeoPlan | null {
  const enabled = OPENSEO_MODULE_IDS.filter((id) => input.modules[id]);
  if (!enabled.length) return null;

  const domain = new URL(input.homeUrl).hostname;
  const locality = localityOf(input.facts?.address ?? null);
  const businessName = input.facts?.business_name ?? null;
  const phone = input.facts?.phones?.[0] ?? null;
  const seeds = keywordSeeds(input.facts, input.industrySlug, locality);
  const business = { businessName, locality, note: businessName ? null : 'no business name in the audit — confirm with the client' };

  const args: Partial<Record<ModuleId, Record<string, unknown>>> = {
    'openseo-crawl': { url: input.homeUrl, runLighthouse: !!input.modules['openseo-lighthouse'] },
    'openseo-search-console': { domain, days: 28 },
    'openseo-analytics': { domain, days: 28 },
    'openseo-project-context': { domain, name: businessName ?? domain },
    'openseo-lighthouse': { url: input.homeUrl, runLighthouse: true },
    'openseo-keywords': { seedKeywords: seeds },
    'openseo-rankings': { target: domain },
    'openseo-serp': { keywords: seeds },
    'openseo-competitors': { keywords: seeds },
    'openseo-backlinks': { target: domain, scope: 'domain' },
    'openseo-local-pack': { ...business, keywords: seeds },
    'openseo-local-grid': { ...business, keywords: seeds.slice(0, 2), gridSize: 5 },
    'openseo-reviews': business,
    'openseo-rank-tracking': { domain, keywords: seeds, scheduleInterval: 'manual' },
  };

  const requests: OpenSeoRequest[] = enabled.map((id) => {
    const def = MODULES.find((m) => m.id === id)!;
    return {
      module: id,
      label: def.label,
      billing: def.billing,
      cost: def.cost,
      requires: def.requires ?? null,
      tools: def.tools ?? [],
      args: args[id] ?? {},
      note:
        def.billing === 'dataforseo'
          ? 'Spends DataForSEO credits. Confirm the estimate with the client before running.'
          : 'No DataForSEO spend.',
    };
  });

  return {
    enabled,
    free: enabled.filter((id) => MODULES.find((m) => m.id === id)!.billing === 'openseo'),
    dataforseo: enabled.filter((id) => MODULES.find((m) => m.id === id)!.billing === 'dataforseo'),
    status: 'not-run',
    executed_by: 'agent',
    target: { domain, url: input.homeUrl, business_name: businessName, locality, phone },
    keyword_seeds: seeds,
    requests,
  };
}
