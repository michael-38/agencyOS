// Load the per-industry and per-archetype build references named in config/industries.yaml, plus the
// house design system. These files are data: they carry every piece of vertical-specific guidance the
// plan, design, and render prompts receive. Nothing here knows any vertical by name.
//
// A reference file whose sections are still authoring stubs is reported as unfilled rather than sent;
// the build then degrades to archetype + persona guidance and declares it in seo-report.md.
import fs from 'node:fs';
import path from 'node:path';
import type { Industry, IndustriesFile } from '../personas/schema.js';

const TODO_RE = /<!--\s*TODO\b/i;

export interface ReferenceSection {
  heading: string;
  body: string;
  /** True when the body is empty or is nothing but authoring stubs. */
  unfilled: boolean;
}

export interface ReferenceDoc {
  file: string;
  exists: boolean;
  sections: ReferenceSection[];
  /** True when the file is missing, or every section is unfilled. */
  unfilled: boolean;
}

/** Split a markdown document into its H2 blocks. Content before the first H2 is dropped. */
export function splitH2Sections(markdown: string): ReferenceSection[] {
  const lines = markdown.split('\n');
  const out: ReferenceSection[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (heading === null) return;
    const body = buf.join('\n').trim();
    const meaningful = body
      .split('\n')
      .filter((l) => l.trim() && !TODO_RE.test(l) && l.trim() !== '-')
      .join('\n')
      .trim();
    out.push({ heading, body, unfilled: meaningful.length === 0 });
  };
  for (const line of lines) {
    const m = /^##\s+(\S.*?)\s*$/.exec(line);
    if (m) {
      flush();
      heading = m[1];
      buf = [];
      continue;
    }
    if (heading !== null) buf.push(line);
  }
  flush();
  return out;
}

export function loadReferenceDoc(repo: string, relFile: string | null): ReferenceDoc {
  if (!relFile) return { file: '', exists: false, sections: [], unfilled: true };
  const abs = path.join(repo, relFile);
  if (!fs.existsSync(abs)) return { file: relFile, exists: false, sections: [], unfilled: true };
  const sections = splitH2Sections(fs.readFileSync(abs, 'utf8'));
  return { file: relFile, exists: true, sections, unfilled: sections.every((s) => s.unfilled) };
}

/** The filled sections of a reference, rendered back to markdown for a prompt. */
export function referenceToPrompt(doc: ReferenceDoc, only?: string[]): string {
  const wanted = only ? new Set(only.map((h) => h.toLowerCase())) : null;
  const parts = doc.sections
    .filter((s) => !s.unfilled && (!wanted || wanted.has(s.heading.toLowerCase())))
    .map((s) => `## ${s.heading}\n\n${s.body}`);
  return parts.join('\n\n');
}

export function findSection(doc: ReferenceDoc, heading: string): ReferenceSection | null {
  const want = heading.toLowerCase();
  return doc.sections.find((s) => s.heading.toLowerCase() === want && !s.unfilled) ?? null;
}

export interface BuildReferences {
  industry: Industry;
  archetypeId: string;
  jsonldType: string;
  industryDoc: ReferenceDoc;
  archetypeDoc: ReferenceDoc;
  designSystem: string;
  /** Human-readable list of guidance that was requested but is still unauthored. */
  gaps: string[];
}

export const DESIGN_SYSTEM_FILE = 'templates/design-system.md';

export function loadBuildReferences(repo: string, industries: IndustriesFile, slug: string): BuildReferences {
  const industry = industries.industries.find((i) => i.slug === slug);
  if (!industry) throw new Error(`unknown slug "${slug}"`);
  const archetype = industries.archetypes.find((a) => a.id === industry.archetype);
  if (!archetype) throw new Error(`industry "${slug}" names archetype "${industry.archetype}", which is not declared`);
  const industryDoc = loadReferenceDoc(repo, industry.build_reference_file ?? null);
  const archetypeDoc = loadReferenceDoc(repo, archetype.reference_file ?? null);
  const dsPath = path.join(repo, DESIGN_SYSTEM_FILE);
  const designSystem = fs.existsSync(dsPath) ? fs.readFileSync(dsPath, 'utf8') : '';

  const gaps: string[] = [];
  if (!industryDoc.exists) gaps.push(`${industry.build_reference_file ?? '(no build_reference_file)'} is missing`);
  else if (industryDoc.unfilled) gaps.push(`${industryDoc.file} is an unfilled authoring skeleton`);
  else for (const s of industryDoc.sections.filter((x) => x.unfilled)) gaps.push(`${industryDoc.file} → "${s.heading}" is unfilled`);
  if (!archetypeDoc.exists) gaps.push(`${archetype.reference_file ?? '(no reference_file)'} is missing`);
  else if (archetypeDoc.unfilled) gaps.push(`${archetypeDoc.file} is an unfilled authoring skeleton`);
  if (!designSystem) gaps.push(`${DESIGN_SYSTEM_FILE} is missing`);

  return { industry, archetypeId: archetype.id, jsonldType: archetype.jsonld_type, industryDoc, archetypeDoc, designSystem, gaps };
}
