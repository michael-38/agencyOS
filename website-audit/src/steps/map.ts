// Step 3: Firecrawl /map on the origin, optional second map when subdomains crowd the result,
// then normalize + dedupe. Raw responses persisted verbatim.
import fs from 'node:fs';
import path from 'node:path';
import type { MapData } from 'firecrawl';
import { LIMITS } from '../config.js';
import type { FirecrawlService } from '../firecrawl.js';
import type { Progress } from '../progress.js';
import { normalizeMap, type NormalizedMap } from '../urls.js';

export interface MapStepResult {
  raw: MapData;
  raw2: MapData | null;
  normalized: NormalizedMap;
  second_map: boolean;
  cache_hits: number;
}

export async function runMap(fc: FirecrawlService, origin: string, runDir: string, progress: Progress): Promise<MapStepResult> {
  const opts = { sitemap: 'include' as const, includeSubdomains: true, limit: LIMITS.mapLimit, ignoreQueryParameters: true };
  const first = await fc.map(origin, opts);
  fs.writeFileSync(path.join(runDir, 'raw', 'map.json'), JSON.stringify(first.data, null, 2));
  let cacheHits = first.hit ? 1 : 0;
  let normalized = normalizeMap(first.data.links ?? [], origin);
  let raw2: MapData | null = null;
  let secondMap = false;
  progress.log(`map: ${normalized.total_input} urls, ${normalized.same_origin.length} same-origin, ${normalized.subdomain.length} subdomain, ${normalized.dropped.length} dropped (subdomain share ${(normalized.subdomain_share * 100).toFixed(0)}%)`);
  if (normalized.subdomain_share > LIMITS.subdomainShareForSecondMap) {
    progress.info(`subdomains are ${(normalized.subdomain_share * 100).toFixed(0)}% of the map; issuing a second map without subdomains`);
    const second = await fc.map(origin, { ...opts, includeSubdomains: false });
    raw2 = second.data;
    if (second.hit) cacheHits++;
    fs.writeFileSync(path.join(runDir, 'raw', 'map-2.json'), JSON.stringify(second.data, null, 2));
    normalized = normalizeMap([...(first.data.links ?? []), ...(second.data.links ?? [])], origin);
    normalized.subdomain_share = first.data.links?.length ? normalizeMap(first.data.links, origin).subdomain_share : 0;
    secondMap = true;
  }
  fs.writeFileSync(
    path.join(runDir, 'map.normalized.json'),
    JSON.stringify({ origin, second_map: secondMap, ...normalized }, null, 2),
  );
  return { raw: first.data, raw2, normalized, second_map: secondMap, cache_hits: cacheHits };
}
