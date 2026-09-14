// Judgment prompt: the persona evaluates judgment items for one page from screenshots + filtered markdown.
// Contains no industry vocabulary; the persona file supplies it.

export interface JudgmentPersona {
  personaName: string;
  primaryGoal: string;
  deviceBias: 'mobile' | 'desktop';
  goalsProse: string;
  industryDisplayName: string;
}

export interface JudgmentItemInput {
  id: string;
  criterion: string;
  scope: 'home' | 'subpath';
  weight: string;
}

export interface JudgmentPageInput {
  url: string;
  role: 'home' | 'candidate';
  markdown: string;
  markdownTruncated: boolean;
  images: { index: number; label: string }[];
  items: JudgmentItemInput[];
}

export function judgmentSystem(p: JudgmentPersona): string {
  return [
    `You are evaluating a business website as this visitor: ${p.personaName} (industry context: ${p.industryDisplayName}).`,
    `Primary goal: ${p.primaryGoal}. Device bias: ${p.deviceBias}.`,
    '',
    '## What this visitor is trying to do',
    p.goalsProse || '(no additional persona notes)',
    '',
    '## How to judge',
    '- You will see screenshots first (mobile fold, then mobile tiles top-to-bottom, then optionally the desktop fold), then the page text as markdown, then the checklist items.',
    '- Judge mobile-first: the mobile screenshots decide; the desktop view only confirms.',
    '- Verdicts: "pass" = this page fully meets the criterion for this visitor; "partial" = present but weak, buried, incomplete, or hard to find; "fail" = absent.',
    '- For items with scope "home", the visitor expects it without navigating away; for "subpath", any content on this page counts.',
    '- Evidence must be concrete: quote the exact text from the markdown (quote), or cite the image (screenshot.image_index) and where in it (region such as "top third", "below the hero"), or both. Use location for a URL or section name.',
    '- Never infer from what businesses like this usually have. If it is not visible in the material provided, the verdict is "fail".',
    '- Treat generic stock-looking imagery as unverified; do not assert that an image is AI-generated.',
    '- evidence.summary is one line, at most 160 characters, no line breaks: the single most useful fact for a report.',
    '- note is one short sentence on what would change the verdict.',
    'Return one entry per checklist id, exactly as listed.',
  ].join('\n');
}

export function judgmentUserText(page: JudgmentPageInput): string {
  return [
    `## Page under evaluation`,
    `URL: ${page.url} (role: ${page.role})`,
    `Images provided: ${page.images.map((i) => `Image ${i.index} = ${i.label}`).join('; ') || 'none'}`,
    '',
    `## Page text (markdown${page.markdownTruncated ? ', truncated' : ''})`,
    page.markdown || '(no text extracted)',
    '',
    '## Checklist items to judge on this page',
    ...page.items.map((it) => `- id: ${it.id} | scope: ${it.scope} | weight: ${it.weight} | criterion: ${it.criterion}`),
  ].join('\n');
}
