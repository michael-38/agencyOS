import Anthropic from '@anthropic-ai/sdk';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { Screenshots } from '../extractors/screenshots.js';

const MODEL = 'claude-sonnet-4-5-20250929';

const TOOL_SCHEMA = {
  name: 'record_design_review',
  description: 'Records an objective design review based on mobile + desktop screenshots.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            title: { type: 'string' },
            description: { type: 'string' },
            quickFix: { type: 'string' },
          },
          required: ['severity', 'title', 'description', 'quickFix'],
        },
      },
    },
    required: ['score', 'summary', 'issues'],
  },
};

export async function runDesignReviewModule(shots: Screenshots): Promise<ModuleResult<{ summary: string }>> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      id: 'design-review',
      label: 'Design',
      status: 'skipped',
      score: null,
      summary: 'Skipped — ANTHROPIC_API_KEY not set.',
      issues: [],
      skipReason: 'ANTHROPIC_API_KEY not set.',
      durationMs: Date.now() - start,
    };
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are an objective design critic reviewing a med spa clinic website. Two full-page screenshots are attached: mobile (390×844) first, then desktop (1440×900).

Evaluate against this rubric:
- Visual hierarchy (does the eye know where to go?)
- Whitespace and breathing room
- Typography (consistency, readability, taste)
- Color palette (cohesion, contrast, brand fit for a luxury wellness category)
- Photography quality (real vs stock vs AI; lighting; mood)
- Brand cohesion across sections
- Mobile-fit issues (cramped, tiny tap targets, overlapping elements)
- Dated patterns (gradients, drop shadows on everything, clip-art icons, generic templates)
- AI-slop / template-y indicators (cliché stock photos, generic copy stamps, default theme leftovers)
- Modern luxury aesthetic appropriate for med spa (think editorial, not clinical)

Return a 0–100 score and concrete, severity-rated issues. Each quickFix should be specific (e.g. "Replace the homepage hero stock image with a real photo of the practice; medium-shot, natural light").`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_design_review' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: shots.mobileBase64 } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: shots.desktopBase64 } },
          ],
        },
      ],
    });

    let payload: any = null;
    for (const block of response.content) if (block.type === 'tool_use') payload = block.input;
    if (!payload) throw new Error('No tool_use returned');

    const issues: Issue[] = (payload.issues || []).map((i: any) => ({
      severity: i.severity as Severity,
      title: i.title,
      description: i.description,
      quickFix: i.quickFix,
    }));

    return {
      id: 'design-review',
      label: 'Design',
      status: 'ok',
      score: payload.score,
      summary: payload.summary,
      issues: sortIssues(issues),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'design-review',
      label: 'Design',
      status: 'error',
      score: null,
      summary: 'Design review failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  }
}
