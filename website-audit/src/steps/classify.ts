// Step 5: one structured Haiku call; the confidence threshold is enforced in code.
import { LIMITS, MODELS } from '../config.js';
import { headingTexts, loadHtml } from '../checks/html.js';
import type { LlmClient } from '../llm/client.js';
import { classifySchema, type ClassifyOutput } from '../llm/schemas.js';
import { classifySystem, classifyUser } from '../llm/prompts/classify.js';
import type { IndustriesFile } from '../personas/schema.js';
import type { PageRecord } from './scrape.js';

export interface ClassifyResult {
  raw_slug: string;
  confidence: number;
  rationale: string;
  effective_slug: string;
  threshold: number;
  model: string;
  cache_hit: boolean;
}

export function classificationEvidence(home: PageRecord): { title: string | null; description: string | null; h1: string[]; h2: string[]; nav: string[] } {
  const $ = loadHtml(home.rawHtml);
  const nav = home.probe?.navText?.length
    ? home.probe.navText
    : headingTexts($, 'nav a, header a, [role="navigation"] a');
  return {
    title: home.title ?? ($('title').first().text().trim() || null),
    description: home.description ?? ($('meta[name="description"]').attr('content')?.trim() || null),
    h1: home.probe?.h1?.length ? home.probe.h1 : headingTexts($, 'h1'),
    h2: home.probe?.h2?.length ? home.probe.h2 : headingTexts($, 'h2'),
    nav: [...new Set(nav)],
  };
}

export async function classifyIndustry(llm: LlmClient, industries: IndustriesFile, home: PageRecord, slugs: string[]): Promise<ClassifyResult> {
  const ev = classificationEvidence(home);
  const options = industries.industries.map((i) => ({ slug: i.slug, display_name: i.display_name, aliases: i.aliases }));
  const res = await llm.parse<ClassifyOutput>({
    step: '05-classify',
    label: 'industry',
    model: MODELS.classify,
    system: classifySystem(),
    content: [{ type: 'text', text: classifyUser({ ...ev, slugs, industries: options }) }],
    schema: classifySchema(options.map((o) => o.slug)),
    maxTokens: LIMITS.smallMaxTokens,
  });
  const confidence = Math.max(0, Math.min(1, res.parsed.confidence));
  const effective = confidence >= LIMITS.classifyConfidenceThreshold ? res.parsed.slug : 'generic';
  return {
    raw_slug: res.parsed.slug,
    confidence,
    rationale: res.parsed.rationale,
    effective_slug: effective,
    threshold: LIMITS.classifyConfidenceThreshold,
    model: res.model,
    cache_hit: res.cacheHit,
  };
}
