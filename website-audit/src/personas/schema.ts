// Zod schemas for config/industries.yaml, config/detectors.yaml, and persona markdown files.
import { z } from 'zod';

export const ScopeEnum = z.enum(['home', 'subpath']);
export const CheckEnum = z.enum(['deterministic', 'judgment']);
export const WeightEnum = z.enum(['high', 'med', 'low']);
export const VerdictEnum = z.enum(['pass', 'partial', 'fail']);
export type Scope = z.infer<typeof ScopeEnum>;
export type CheckKind = z.infer<typeof CheckEnum>;
export type Weight = z.infer<typeof WeightEnum>;
export type Verdict = z.infer<typeof VerdictEnum>;

const NamedPatterns = z.object({ name: z.string().min(1), patterns: z.array(z.string().min(1)).min(1) });
export type NamedPatterns = z.infer<typeof NamedPatterns>;

export const DetectorsSchema = z.object({
  version: z.number().optional(),
  schema_org_local_business_subtypes: z.array(z.string()).default([]),
  booking_widgets: z.array(NamedPatterns).default([]),
  booking_cta_words: z.array(z.string()).default([]),
  review_embeds: z.array(NamedPatterns).default([]),
  chat_widgets: z.array(NamedPatterns).default([]),
  form_embeds: z.array(NamedPatterns).default([]),
  hours_regex: z.string().optional(),
  address_regex: z.string().optional(),
  phone_regex: z.string().optional(),
});
export type DetectorsFile = z.infer<typeof DetectorsSchema>;
export const DetectorsPartialSchema = DetectorsSchema.partial();

export const ArchetypeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  jsonld_type: z.string().min(1),
  reference_file: z.string().min(1),
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const IndustrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  display_name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  archetype: z.string().min(1),
  persona_file: z.string().min(1),
  /** The page template `site:build` fills for this industry. Repo-relative. */
  template_file: z.string().min(1),
  build_reference_file: z.string().min(1),
  detectors: DetectorsPartialSchema.optional(),
});
export type Industry = z.infer<typeof IndustrySchema>;

export const IndustriesSchema = z.object({
  version: z.number(),
  archetypes: z.array(ArchetypeSchema).min(1),
  industries: z.array(IndustrySchema).min(1),
});
export type IndustriesFile = z.infer<typeof IndustriesSchema>;

export const FrontmatterSchema = z.object({
  industry: z.string().min(1),
  persona_name: z.string().min(1),
  primary_goal: z.string().min(1),
  device_bias: z.enum(['mobile', 'desktop']).default('mobile'),
});
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

export interface ChecklistItem {
  id: string;
  criterion: string;
  scope: Scope;
  check: CheckKind;
  weight: Weight;
  extra: Record<string, string>;
  line: number;
  source: 'persona' | 'common';
}

export interface ParsedPersona {
  file: string;
  frontmatter: Frontmatter;
  goals_prose: string;
  items: Omit<ChecklistItem, 'source'>[];
  warnings: Violation[];
}

export interface Violation {
  file: string;
  line: number;
  message: string;
}

export class PersonaValidationError extends Error {
  constructor(public readonly violations: Violation[]) {
    super(
      `Persona validation failed (${violations.length} issue${violations.length === 1 ? '' : 's'}):\n` +
        violations.map((v) => `  ${v.file}:${v.line} ${v.message}`).join('\n'),
    );
    this.name = 'PersonaValidationError';
  }
}
