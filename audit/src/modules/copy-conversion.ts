import Anthropic from '@anthropic-ai/sdk';
import { ClinicInfo, Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { MODELS } from '../utils/models.js';
import { log } from '../utils/logger.js';
import { CostTracker } from '../utils/cost.js';
import type { ScrapedSite } from '../extractors/scrape.js';

const MODEL = MODELS.rubric_judgment;

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

// Static rubric — moves to cached system prompt so batch runs share the prefix.
const SYSTEM_PROMPT = `You are a senior med-spa marketing strategist. You audit a med spa clinic's website to determine whether the copy answers the questions a high-intent buyer asks before booking, and whether it removes friction from the path to a consultation.

You will be given the clinic's name, city, URL, and the page's markdown content. Return a 12-field coverage map (boolean per topic), a 0–100 score, a one-sentence summary, and a list of severity-rated, fixable issues with concrete quick fixes.

# Coverage map — mark each topic true ONLY if the page meaningfully addresses it (a one-word mention does not count)

- **servicesList** — every offered treatment is clearly listed (not just "we offer many services"). Brand names where appropriate (Botox, Dysport, Juvederm, Restylane, Sculptra, Morpheus8, Hydrafacial, etc.).
- **pricingTransparency** — actual prices, ranges, "starting at", or per-unit pricing visible. "Contact us for pricing" does NOT count.
- **whatToExpect** — walks the buyer through the appointment experience: arrival, consultation, treatment, immediate aftercare, recovery timeline.
- **beforeAfterEvidence** — before/after photos, measurable results, case studies, or quantified claims (not stock photos).
- **credentials** — practitioner names with credentials (MD, RN, NP, PA), board certifications, training, years of experience.
- **hours** — explicit business hours visible on the page.
- **locationParking** — full address with neighborhood + parking/transit info. Footer-only address is borderline; only mark true if location is meaningfully covered.
- **financing** — payment plans, CareCredit, Cherry, Affirm, Klarna, in-house financing, or financing FAQ.
- **consultationCta** — clear "Book a Consultation" or equivalent CTA above the fold or repeated through the page. Generic "Contact Us" alone does NOT count.
- **trustReviews** — patient testimonials, aggregate review score, Google/Yelp/RealSelf badges, press mentions.
- **objectionHandling** — addresses common fears: pain, downtime, side effects, candidacy, "is it safe?", "will it look natural?".
- **faq** — a real FAQ block (3+ Q&A pairs) addressing common buyer questions.

# Score 0–100 (weighted toward conversion-critical items)

- High-impact (each missing item = up to -20): consultationCta, pricingTransparency, beforeAfterEvidence, credentials, trustReviews.
- Medium-impact (each missing = up to -10): servicesList, whatToExpect, faq, objectionHandling.
- Lower-impact (each missing = up to -5): hours, locationParking, financing.

# Severity guidance for issues

- **critical**: a fundamental conversion path is broken (no booking CTA, no services listed, page reads as informational with no path to convert).
- **high**: a high-impact item is missing or weak (no pricing signal at all; credentials section is missing entirely; no social proof anywhere on the page).
- **medium**: present but underdeveloped (services listed without descriptions; reviews shown but no aggregate score or quote; "what to expect" is one paragraph).
- **low**: polish — tighten copy, add a sub-section, reorder.

# Quick-fix discipline

Each quickFix should be a concrete, paste-ready snippet of copy or a specific structural recommendation. Bad: "Add pricing transparency." Good: 'Add a "Pricing" section with rows like: "Botox: starting at $14/unit · Lip filler: $750–$1,200 per syringe · Microneedling: $350/session." If exact pricing varies, use a "starting at" floor.'

Return exactly one issue per distinct gap. Use the record_copy_audit tool. Don't add prose outside the tool call.`;

export async function runCopyConversionModule(
  site: ScrapedSite,
  clinic: ClinicInfo,
  corpus: string,
  costTracker?: CostTracker
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

  const client = new Anthropic({ apiKey, maxRetries: 8 });

  const header = `CLINIC: ${clinic.name} (${clinic.city || 'unknown city'})\nURL: ${site.finalUrl}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_copy_audit' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Site corpus (multiple pages):\n\n${corpus}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `${header}\n\nApply the coverage map + scoring rubric to the full site corpus above. Use record_copy_audit.` },
        ],
      }],
      cache_control: { type: 'ephemeral' },
    } as any);

    log.usage('copy-conversion', response.usage as any);
    costTracker?.add('copy-conversion', MODEL, response.usage as any);
    let payload: any = null;
    for (const block of response.content) if (block.type === 'tool_use') payload = block.input;
    if (!payload) throw new Error('No tool_use returned');

    const rawIssues = Array.isArray(payload.issues) ? payload.issues : [];
    const issues: Issue[] = rawIssues
      .filter((i: any) => i && typeof i === 'object' && i.title)
      .map((i: any) => ({
        severity: (i.severity as Severity) || 'medium',
        title: String(i.title),
        description: String(i.description || ''),
        quickFix: i.quickFix ? String(i.quickFix) : undefined,
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
