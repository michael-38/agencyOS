import Anthropic from '@anthropic-ai/sdk';
import { ClinicInfo, Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { ScrapedSite } from '../extractors/scrape.js';

const MODEL = 'claude-sonnet-4-5-20250929';

const TOOL_SCHEMA = {
  name: 'record_copy_audit',
  description: 'Records a med-spa-specific copy & conversion audit.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      coverage: {
        type: 'object',
        description: 'Boolean coverage of each buyer-intent topic (true if the page addresses it).',
        properties: {
          servicesList: { type: 'boolean' },
          pricingTransparency: { type: 'boolean' },
          whatToExpect: { type: 'boolean' },
          beforeAfterEvidence: { type: 'boolean' },
          credentials: { type: 'boolean' },
          hours: { type: 'boolean' },
          locationParking: { type: 'boolean' },
          financing: { type: 'boolean' },
          consultationCta: { type: 'boolean' },
          trustReviews: { type: 'boolean' },
          objectionHandling: { type: 'boolean' },
          faq: { type: 'boolean' },
        },
        required: [
          'servicesList',
          'pricingTransparency',
          'whatToExpect',
          'beforeAfterEvidence',
          'credentials',
          'hours',
          'locationParking',
          'financing',
          'consultationCta',
          'trustReviews',
          'objectionHandling',
          'faq',
        ],
      },
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
    required: ['score', 'summary', 'coverage', 'issues'],
  },
};

export async function runCopyConversionModule(
  site: ScrapedSite,
  clinic: ClinicInfo
): Promise<ModuleResult<{ coverage: Record<string, boolean> }>> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      id: 'copy-conversion',
      label: 'Copy & conversion',
      status: 'skipped',
      score: null,
      summary: 'Skipped — ANTHROPIC_API_KEY not set.',
      issues: [],
      skipReason: 'ANTHROPIC_API_KEY not set.',
      durationMs: Date.now() - start,
    };
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are a med-spa marketing strategist. Audit whether the website below answers the questions a high-intent buyer asks before booking and removes friction to a consultation.

For each topic in the coverage object, mark true only if the page meaningfully addresses it (not just a one-word mention).

Topics:
- servicesList: every offered treatment is clearly listed
- pricingTransparency: prices, ranges, or "starting at" amounts visible
- whatToExpect: walks through the appointment experience
- beforeAfterEvidence: before/after photos or measurable results
- credentials: practitioner names, certifications, training
- hours: business hours visible
- locationParking: address + neighborhood / parking info
- financing: payment plans, CareCredit, etc.
- consultationCta: clear "book consultation" call-to-action above the fold
- trustReviews: testimonials or aggregate review score
- objectionHandling: addresses common fears (pain, downtime, side effects)
- faq: FAQ block addressing common questions

Then return a 0–100 score and concrete, severity-rated issues with copy-pasteable quickFix suggestions.

CLINIC: ${clinic.name} (${clinic.city || 'unknown city'})
URL: ${site.finalUrl}

CONTENT (markdown):
${site.markdown.slice(0, 16000)}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_copy_audit' },
      messages: [{ role: 'user', content: prompt }],
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
      id: 'copy-conversion',
      label: 'Copy & conversion',
      status: 'ok',
      score: payload.score,
      summary: payload.summary,
      issues: sortIssues(issues),
      evidence: { coverage: payload.coverage },
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'copy-conversion',
      label: 'Copy & conversion',
      status: 'error',
      score: null,
      summary: 'Copy audit failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  }
}
