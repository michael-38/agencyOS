// Load industries.yaml, detectors.yaml, and persona files by slug; validate; merge persona + _common.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import {
  ChecklistItem,
  DetectorsFile,
  DetectorsSchema,
  IndustriesFile,
  IndustriesSchema,
  Industry,
  ParsedPersona,
  PersonaValidationError,
  Violation,
} from './schema.js';
import { parsePersonaMarkdown } from './parse.js';

export interface Detectors extends DetectorsFile {
  hoursRe: RegExp | null;
  addressRe: RegExp | null;
  phoneRe: RegExp | null;
}

export function loadIndustries(repo: string): IndustriesFile {
  const file = path.join(repo, 'config', 'industries.yaml');
  const raw = parseYaml(fs.readFileSync(file, 'utf8'));
  const parsed = IndustriesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PersonaValidationError(parsed.error.issues.map((i) => ({ file, line: 0, message: `${i.path.join('.')}: ${i.message}` })));
  }
  const data = parsed.data;
  const violations: Violation[] = [];
  const slugs = new Set<string>();
  const archetypes = new Set(data.archetypes.map((a) => a.id));
  for (const ind of data.industries) {
    if (slugs.has(ind.slug)) violations.push({ file, line: 0, message: `duplicate slug "${ind.slug}"` });
    slugs.add(ind.slug);
    if (!archetypes.has(ind.archetype)) {
      violations.push({ file, line: 0, message: `industry "${ind.slug}": archetype "${ind.archetype}" is not declared under archetypes` });
    }
  }
  if (!slugs.has('generic')) violations.push({ file, line: 0, message: 'an industry with slug "generic" is required' });
  if (violations.length) throw new PersonaValidationError(violations);
  return data;
}

function compileRe(src: string | undefined, file: string, name: string): RegExp | null {
  if (!src) return null;
  try {
    return new RegExp(src, 'i');
  } catch (e) {
    throw new PersonaValidationError([{ file, line: 0, message: `${name} does not compile: ${(e as Error).message}` }]);
  }
}

export function loadDetectors(repo: string, industry?: Industry): Detectors {
  const file = path.join(repo, 'config', 'detectors.yaml');
  const raw = parseYaml(fs.readFileSync(file, 'utf8'));
  const parsed = DetectorsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PersonaValidationError(parsed.error.issues.map((i) => ({ file, line: 0, message: `${i.path.join('.')}: ${i.message}` })));
  }
  const base = parsed.data;
  const extra = industry?.detectors ?? {};
  const mergeNamed = <T extends { name: string }>(a: T[], b?: T[]) => {
    const out = [...a];
    for (const item of b ?? []) if (!out.some((x) => x.name === item.name)) out.push(item);
    return out;
  };
  const merged: DetectorsFile = {
    version: base.version,
    schema_org_local_business_subtypes: [
      ...new Set([...base.schema_org_local_business_subtypes, ...(extra.schema_org_local_business_subtypes ?? [])]),
    ],
    booking_widgets: mergeNamed(base.booking_widgets, extra.booking_widgets),
    booking_cta_words: [...new Set([...base.booking_cta_words, ...(extra.booking_cta_words ?? [])])],
    review_embeds: mergeNamed(base.review_embeds, extra.review_embeds),
    chat_widgets: mergeNamed(base.chat_widgets, extra.chat_widgets),
    form_embeds: mergeNamed(base.form_embeds, extra.form_embeds),
    hours_regex: extra.hours_regex ?? base.hours_regex,
    address_regex: extra.address_regex ?? base.address_regex,
    phone_regex: extra.phone_regex ?? base.phone_regex,
    nav_chrome: [...new Set([...base.nav_chrome, ...(extra.nav_chrome ?? [])])],
  };
  return {
    ...merged,
    hoursRe: compileRe(merged.hours_regex, file, 'hours_regex'),
    addressRe: compileRe(merged.address_regex, file, 'address_regex'),
    phoneRe: compileRe(merged.phone_regex, file, 'phone_regex'),
  };
}

export function sha256File(p: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export function loadPersonaFile(repo: string, relFile: string): ParsedPersona {
  const abs = path.join(repo, relFile);
  if (!fs.existsSync(abs)) throw new PersonaValidationError([{ file: relFile, line: 0, message: 'file not found' }]);
  const parsed = parsePersonaMarkdown(fs.readFileSync(abs, 'utf8'), relFile);
  const expectedSlug = path.basename(relFile, '.md');
  if (parsed.frontmatter.industry !== expectedSlug) {
    throw new PersonaValidationError([
      { file: relFile, line: 2, message: `frontmatter industry "${parsed.frontmatter.industry}" must equal the file's slug "${expectedSlug}"` },
    ]);
  }
  return parsed;
}

export interface LoadedChecklist {
  persona: ParsedPersona | null;
  common: ParsedPersona | null;
  personaFile: string | null;
  personaFallback: boolean;
  items: ChecklistItem[];
  hashes: Record<string, string>;
  warnings: Violation[];
}

export interface LoadChecklistOptions {
  includePersona: boolean;
  includeCommon: boolean;
  registeredCheckIds: Set<string>;
  excludeItems?: string[];
}

/** Load persona + _common for a slug, validate deterministic ids against the registry, and merge. */
export function loadChecklist(repo: string, industries: IndustriesFile, slug: string, opts: LoadChecklistOptions): LoadedChecklist {
  const industry = industries.industries.find((i) => i.slug === slug);
  if (!industry) throw new Error(`Unknown industry slug "${slug}"`);
  const warnings: Violation[] = [];
  const hashes: Record<string, string> = {};
  let persona: ParsedPersona | null = null;
  let personaFile: string | null = null;
  let personaFallback = false;

  if (opts.includePersona) {
    personaFile = industry.persona_file;
    if (!fs.existsSync(path.join(repo, personaFile))) {
      const generic = industries.industries.find((i) => i.slug === 'generic')!;
      warnings.push({ file: personaFile, line: 0, message: `persona file missing; falling back to ${generic.persona_file}` });
      personaFile = generic.persona_file;
      personaFallback = true;
    }
    persona = loadPersonaFile(repo, personaFile);
    hashes[personaFile] = sha256File(path.join(repo, personaFile));
    warnings.push(...persona.warnings);
  }
  let common: ParsedPersona | null = null;
  if (opts.includeCommon) {
    const commonFile = 'personas/_common.md';
    common = loadPersonaFile(repo, commonFile);
    hashes[commonFile] = sha256File(path.join(repo, commonFile));
    warnings.push(...common.warnings);
  }

  const violations: Violation[] = [];
  const items: ChecklistItem[] = [];
  const seen = new Map<string, string>();
  const addItems = (p: ParsedPersona | null, source: ChecklistItem['source']) => {
    if (!p) return;
    for (const it of p.items) {
      if (seen.has(it.id)) {
        violations.push({ file: p.file, line: it.line, message: `id "${it.id}" collides with the same id in ${seen.get(it.id)}; keep it in one file` });
      }
      seen.set(it.id, p.file);
      if (it.check === 'deterministic' && !opts.registeredCheckIds.has(it.id)) {
        violations.push({
          file: p.file,
          line: it.line,
          message: `deterministic id "${it.id}" is not a registered check. Registered: ${[...opts.registeredCheckIds].sort().join(', ')}`,
        });
      }
      items.push({ ...it, source });
    }
  };
  addItems(persona, 'persona');
  addItems(common, 'common');
  if (violations.length) throw new PersonaValidationError(violations);

  const excluded = new Set(opts.excludeItems ?? []);
  return { persona, common, personaFile, personaFallback, items: items.filter((i) => !excluded.has(i.id)), hashes, warnings };
}

/** Validate every persona listed in industries.yaml plus _common.md. Returns violations instead of throwing. */
export function validateAllPersonas(
  repo: string,
  registeredCheckIds: Set<string>,
): { ok: boolean; violations: Violation[]; warnings: Violation[]; checked: string[] } {
  const violations: Violation[] = [];
  const warnings: Violation[] = [];
  const checked: string[] = [];
  let industries: IndustriesFile;
  try {
    industries = loadIndustries(repo);
    loadDetectors(repo);
  } catch (e) {
    if (e instanceof PersonaValidationError) return { ok: false, violations: e.violations, warnings, checked };
    throw e;
  }
  for (const ind of industries.industries) {
    checked.push(ind.slug);
    try {
      const res = loadChecklist(repo, industries, ind.slug, { includePersona: true, includeCommon: true, registeredCheckIds });
      warnings.push(...res.warnings);
      if (!fs.existsSync(path.join(repo, ind.build_reference_file))) {
        warnings.push({
          file: ind.build_reference_file,
          line: 0,
          message: `build_reference_file for "${ind.slug}" does not exist yet (required once the build skill lands)`,
        });
      }
    } catch (e) {
      if (e instanceof PersonaValidationError) violations.push(...e.violations);
      else throw e;
    }
  }
  return { ok: violations.length === 0, violations, warnings, checked };
}
