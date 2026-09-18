// Stage B: the one billed call. The model turns the audited site's own pages into slot values for
// this industry's template, and nothing else — it does not choose an architecture, write a
// stylesheet or emit markup, because the template already settled all three.
//
// The schema is deliberately one flat array of five-string objects. Its grammar size is constant no
// matter how many slots a template declares, which is what keeps structured output accepted as
// templates grow; repeat cardinality rides in the slot id (`services[2].name`) rather than in a
// nested shape.
import { z } from 'zod';
import { SITE_LIMITS } from '../config.js';
import type { LlmParser } from '../llm/client.js';
import { siteContentSystem, siteContentUser, sourceCorpusBlock, type ContentGap, type ContentGuidance, type ContentPersona } from '../llm/prompts/site-content.js';
import { NamedEntitySchema, provenanceOf, type Entities, type NamedEntity, type Provenance } from './types.js';
import type { TemplateManifest } from './template.js';

export const SlotValueSchema = z.object({
  /** A slot id from the manifest. Repeat fields carry their index: `services[2].name`. */
  slot: z.string(),
  text: z.string(),
  source_kind: z.enum(['source', 'placeholder']),
  source_page_url: z.string().nullable(),
  source_quote: z.string().nullable(),
});
export type SlotValue = z.infer<typeof SlotValueSchema>;

export const ContentPackSchema = z.object({
  business_name: z.string(),
  /** Clamped to the audit's title window in code, never trusted raw. */
  title: z.string(),
  meta_description: z.string(),
  /** One sentence for llms.txt and the OG description fallback. */
  site_summary: z.string(),
  slots: z.array(SlotValueSchema),
  services: z.array(NamedEntitySchema),
  areas: z.array(NamedEntitySchema),
  credentials: z.array(NamedEntitySchema),
  price_statements: z.array(NamedEntitySchema),
  /** Emit only when the source states both a value and a count; otherwise leave every field null. */
  rating_value: z.string().nullable(),
  rating_count: z.string().nullable(),
  rating_page_url: z.string().nullable(),
  rating_quote: z.string().nullable(),
  /** Section ids the source gives nothing for, so the fill removes them outright. */
  omit_sections: z.array(z.string()),
  /** Anything the model could not source, in its own words. Surfaced in seo-report.md. */
  notes: z.array(z.string()),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;

export interface ParsedSlotId {
  /** `services[2].name` → `services[].name`, the form the manifest declares. */
  canonical: string;
  group: string | null;
  index: number | null;
  field: string | null;
}

const INDEXED_RE = /^([a-z0-9_-]+)\[(\d+)\]\.([a-z0-9_-]+)$/;

export function parseSlotId(id: string): ParsedSlotId {
  const m = INDEXED_RE.exec(id.trim());
  if (!m) return { canonical: id.trim(), group: null, index: null, field: null };
  return { canonical: `${m[1]}[].${m[3]}`, group: m[1], index: Number.parseInt(m[2], 10), field: m[3] };
}

export const provenanceOfSlot = (v: SlotValue): Provenance => ({
  kind: v.source_kind,
  page_url: v.source_page_url,
  quote: v.source_quote,
});

/** The pack's entity lists, in the internal shape the JSON-LD and llms.txt builders already take. */
export function entitiesOf(pack: ContentPack): Entities {
  const entity = (e: z.infer<typeof NamedEntitySchema>): NamedEntity => ({ name: e.name, detail: e.detail, source: provenanceOf(e) });
  return {
    services: pack.services.map(entity),
    areas: pack.areas.map(entity),
    credentials: pack.credentials.map(entity),
    price_statements: pack.price_statements.map(entity),
    rating:
      pack.rating_value && pack.rating_count
        ? {
            value: pack.rating_value,
            count: pack.rating_count,
            source: { kind: 'source', page_url: pack.rating_page_url, quote: pack.rating_quote },
          }
        : null,
  };
}

/**
 * Text the model wrote, cleaned of the tells it cannot stop producing. Dashes are the loudest: the
 * eight persona templates were hand-written with none, and one em dash in a client's hero undoes
 * that. Cheaper to strip here than to ask for it in the prompt and hope.
 */
export function normalizeCopy(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clamp on a word boundary, so a budget overrun reads as a shorter sentence, not a truncation. */
export function clampToWords(s: string, max: number | null): string {
  if (!max || s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, '');
}


// ---------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------

export interface ContentStageOptions {
  llm: LlmParser;
  model: string;
  persona: ContentPersona;
  guidance: ContentGuidance;
  gaps: ContentGap[];
  manifest: TemplateManifest;
  /** The scraped pages, already cleaned and capped by buildCorpus. */
  corpus: string;
  facts: string;
  profile: 'mockup' | 'production';
}

export interface ContentStageResult {
  pack: ContentPack;
  usd: number;
  cacheHit: boolean;
}

/**
 * The one billed call.
 *
 * The corpus leads the request as its own block so it is the cacheable prefix: a retry, a
 * `--from-cache` replay, or a second build in the same run directory reads it at a tenth of the
 * price instead of paying for it again.
 */
export async function runContentStage(o: ContentStageOptions): Promise<ContentStageResult> {
  const res = await o.llm.parse({
    step: 'site-content',
    label: 'content',
    model: o.model,
    system: siteContentSystem(o.persona),
    content: [
      { type: 'text', text: sourceCorpusBlock(o.corpus), cacheable: true },
      {
        type: 'text',
        text: siteContentUser({ facts: o.facts, guidance: o.guidance, gaps: o.gaps, manifest: o.manifest, profile: o.profile }),
      },
    ],
    schema: ContentPackSchema,
    maxTokens: SITE_LIMITS.packMaxTokens,
    thinking: { effort: 'medium' },
    fallbacks: true,
  });
  return { pack: res.parsed, usd: res.usd, cacheHit: res.cacheHit };
}
