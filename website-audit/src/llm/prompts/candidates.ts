// Batched candidate-selection prompt: for every unmet subpath item, pick up to 3 same-origin URLs.

export interface CandidateItemInput {
  id: string;
  criterion: string;
  weight: string;
  homeVerdict: string;
  homeEvidence: string;
}

export interface CandidatesInput {
  personaName: string;
  primaryGoal: string;
  items: CandidateItemInput[];
  urls: { url: string; title?: string; description?: string }[];
  maxPerItem: number;
}

export function candidatesSystem(): string {
  return [
    'You are helping audit a business website for a specific visitor persona.',
    'Some checklist items were not satisfied on the home page. For each item, choose the pages on this site most likely to satisfy it,',
    'using only the URL list provided (URL path words, titles, descriptions).',
    'Return at most the allowed number of candidates per item, best first, and give a short reason for each.',
    'Return an empty candidates list for an item when no URL plausibly matches. Never repeat the home page.',
    'Do not choose pages the home-page evidence already rules out as the same content.',
  ].join(' ');
}

export function candidatesUser(input: CandidatesInput): string {
  return [
    `Persona: ${input.personaName}`,
    `Primary goal: ${input.primaryGoal}`,
    `Max candidates per item: ${input.maxPerItem}`,
    '',
    '## Items still unmet after the home page',
    ...input.items.map((it) => `- ${it.id} [${it.weight}]: ${it.criterion}\n  home verdict: ${it.homeVerdict}; home evidence: ${it.homeEvidence || '(none)'}`),
    '',
    '## Site URLs',
    ...input.urls.map((u) => `- ${u.url}${u.title ? ` — ${u.title}` : ''}${u.description ? ` — ${u.description.slice(0, 100)}` : ''}`),
  ].join('\n');
}
