// Home-page chooser prompt (fallback only: non-2xx root, splash/region chooser, or host mismatch).

export interface HomeChooserInput {
  reason: string;
  resolvedOrigin: string;
  rootStatus: number | null;
  rootExcerpt: string;
  urls: { url: string; title?: string; description?: string }[];
}

export function homeChooserSystem(): string {
  return [
    'You pick the real home page of a business website from a list of its URLs.',
    'The root URL was not usable for the reason given. Choose the single URL a first-time visitor should land on:',
    'the main marketing/landing page for the business (not a blog post, not a legal page, not a login page, not a locale chooser).',
    'If several locales exist, prefer the English or default-locale home. Explain the choice in one sentence.',
  ].join(' ');
}

export function homeChooserUser(input: HomeChooserInput): string {
  return [
    `Resolved origin: ${input.resolvedOrigin}`,
    `Why the root was rejected: ${input.reason}`,
    `Root HTTP status: ${input.rootStatus ?? 'unknown'}`,
    '',
    '## Root page excerpt (may be empty)',
    input.rootExcerpt || '(empty)',
    '',
    '## Candidate URLs',
    ...input.urls.map((u) => `- ${u.url}${u.title ? ` — ${u.title}` : ''}${u.description ? ` — ${u.description.slice(0, 120)}` : ''}`),
  ].join('\n');
}
