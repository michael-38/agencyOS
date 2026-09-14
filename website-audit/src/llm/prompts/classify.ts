// Industry classification prompt. No industry vocabulary here: the candidate list comes from industries.yaml.

export interface ClassifyInput {
  title: string | null;
  description: string | null;
  h1: string[];
  h2: string[];
  nav: string[];
  slugs: string[];
  industries: { slug: string; display_name: string; aliases: string[] }[];
}

export function classifySystem(): string {
  return [
    'You classify a business website into exactly one industry from a fixed list.',
    'Use only the evidence provided (page title, meta description, headings, navigation labels, URL slugs).',
    'Prefer the most specific matching industry. If the evidence does not clearly support any listed industry, choose "generic".',
    'Report confidence as a number from 0 to 1 reflecting how strongly the evidence supports the chosen slug.',
    'The rationale must cite the concrete evidence (a heading, a nav label, a slug) in one or two sentences.',
  ].join(' ');
}

export function classifyUser(input: ClassifyInput): string {
  const list = input.industries
    .map((i) => `- ${i.slug}: ${i.display_name}${i.aliases.length ? ` (aliases: ${i.aliases.join(', ')})` : ''}`)
    .join('\n');
  return [
    '## Industries (choose one slug)',
    list,
    '',
    '## Evidence',
    `Title: ${input.title ?? '(none)'}`,
    `Meta description: ${input.description ?? '(none)'}`,
    `H1: ${input.h1.join(' | ') || '(none)'}`,
    `H2: ${input.h2.slice(0, 20).join(' | ') || '(none)'}`,
    `Navigation: ${input.nav.slice(0, 40).join(' | ') || '(none)'}`,
    `URL slugs (${input.slugs.length}):`,
    ...input.slugs.map((s) => `- ${s}`),
  ].join('\n');
}
