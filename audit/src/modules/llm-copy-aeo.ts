import Anthropic from '@anthropic-ai/sdk';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { ScrapedSite } from '../extractors/scrape.js';

const MODEL = 'claude-sonnet-4-5-20250929';

const TOOL_SCHEMA = {
  name: 'record_aeo_audit',
  description: 'Records an AEO/GEO/LLM-optimization audit of a website copy.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100, description: 'Overall AEO/GEO score 0-100.' },
      summary: { type: 'string', description: 'One sentence verdict.' },
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

export async function runLlmCopyAeoModule(site: ScrapedSite): Promise<ModuleResult<{ summary: string }>> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      id: 'llm-copy-aeo',
      label: 'LLM copy / AEO',
      status: 'skipped',
      score: null,
      summary: 'Skipped — ANTHROPIC_API_KEY not set.',
      issues: [],
      skipReason: 'ANTHROPIC_API_KEY not set.',
      durationMs: Date.now() - start,
    };
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are auditing whether a med spa clinic's website copy is optimized for Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), and direct citation by LLMs (ChatGPT, Claude, Perplexity, Google AI Overviews).

Evaluate the copy below against this rubric:
1. Declarative factual statements that an LLM can lift verbatim (services, prices, hours, location, qualifications).
2. Question-and-answer / FAQ structure that matches user query phrasing.
3. Named-entity richness (clinic name, practitioners, brand-name treatments) used in natural sentences.
4. Authoritativeness signals (credentials, board certifications, years of experience, source citations).
5. Conversational, scannable phrasing — short paragraphs, bullets, numbered steps.
6. Semantic HTML / clear topical structure (you can infer from the markdown headings).
7. Local specificity — neighborhood, city, landmarks named explicitly so geo queries match.
8. Direct answers to common buyer questions ("how much does X cost?", "does it hurt?", "how long does it last?").

Return a 0–100 score and a list of issues. Each issue must have a quickFix that is concrete and copy-pasteable when possible.

URL: ${site.finalUrl}
TITLE: ${site.title}

CONTENT (markdown):
${site.markdown.slice(0, 16000)}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_aeo_audit' },
      messages: [{ role: 'user', content: prompt }],
    });

    let payload: any = null;
    for (const block of response.content) if (block.type === 'tool_use') payload = block.input;
    if (!payload) throw new Error('No tool_use returned by Claude');

    const issues: Issue[] = (payload.issues || []).map((i: any) => ({
      severity: i.severity as Severity,
      title: i.title,
      description: i.description,
      quickFix: i.quickFix,
    }));

    return {
      id: 'llm-copy-aeo',
      label: 'LLM copy / AEO',
      status: 'ok',
      score: payload.score,
      summary: payload.summary,
      issues: sortIssues(issues),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'llm-copy-aeo',
      label: 'LLM copy / AEO',
      status: 'error',
      score: null,
      summary: 'AEO audit failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  }
}
