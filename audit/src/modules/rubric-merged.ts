// Merged rubric module — single Anthropic call that produces BOTH the AEO/GEO
// rubric output AND the copy & conversion coverage map. The corpus is byte-
// identical between the two original modules, so sending it once and asking
// Claude to fill a combined tool schema saves the duplicate corpus cost.
//
// Returns two ModuleResult objects (one per logical audit tab) so the dashboard
// is unchanged.
import Anthropic from '@anthropic-ai/sdk';
import { ClinicInfo, Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { MODELS } from '../utils/models.js';
import { log } from '../utils/logger.js';
import { CostTracker } from '../utils/cost.js';
import type { ScrapedSite } from '../extractors/scrape.js';

const MODEL = MODELS.rubric_judgment;

const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    title: { type: 'string' },
    description: { type: 'string' },
    quickFix: { type: 'string' },
  },
  required: ['severity', 'title', 'description', 'quickFix'],
};

const TOOL_SCHEMA = {
  name: 'record_combined_audit',
  description: 'Records BOTH the AEO/GEO rubric audit and the copy/conversion audit for a med spa clinic site, in a single response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      aeo: {
        type: 'object',
        description: 'AEO/GEO/LLM-citation rubric output. Score 0–100, one-sentence summary, severity-rated issues.',
        properties: {
          score: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          issues: { type: 'array', items: ISSUE_SCHEMA },
        },
        required: ['score', 'summary', 'issues'],
      },
      copy: {
        type: 'object',
        description: 'Copy & conversion audit output. Score 0–100, summary, 12-field coverage map, severity-rated issues.',
        properties: {
          score: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          coverage: {
            type: 'object',
            description: 'Boolean coverage of each buyer-intent topic (true if the site meaningfully addresses it across the corpus).',
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
              'servicesList', 'pricingTransparency', 'whatToExpect', 'beforeAfterEvidence',
              'credentials', 'hours', 'locationParking', 'financing',
              'consultationCta', 'trustReviews', 'objectionHandling', 'faq',
            ],
          },
          issues: { type: 'array', items: ISSUE_SCHEMA },
        },
        required: ['score', 'summary', 'coverage', 'issues'],
      },
    },
    required: ['aeo', 'copy'],
  },
};

const SYSTEM_PROMPT = `You are running two complementary audits on a med spa clinic's website. You will receive the full site corpus (multiple pages) plus the clinic's name, city, and URL. Produce BOTH audit outputs in a single tool call using record_combined_audit.

═══════════════════════════════════════════════════════════════
AUDIT 1 — AEO / GEO / LLM-citation readiness
═══════════════════════════════════════════════════════════════

You are an expert auditor evaluating whether the site's copy is optimized for Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), and direct citation by large language models (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, Bing Copilot).

Score 0–100 against the rubric below and return severity-rated, fixable issues. Each issue's quickFix must be concrete and, where possible, copy-pasteable text the clinic owner can drop into their CMS.

# Rubric (use every item)

1. **Declarative factual statements an LLM can lift verbatim.** Services offered, treatment durations, prices or "starting at" ranges, hours, address, phone, qualifications. Vague marketing prose ("we deliver excellence") is invisible to LLMs — concrete facts get cited.
2. **Question-and-answer / FAQ structure** that matches the way users actually phrase queries ("How much does Botox cost in {city}?", "Does microneedling hurt?", "How long does lip filler last?"). A real FAQ section with H3 questions and short, direct answers is one of the strongest AEO signals.
3. **Named-entity richness.** Clinic name, individual practitioners (with credentials), brand-name treatments (Botox, Dysport, Juvederm, Restylane, Sculptra, Morpheus8, etc.) used in natural sentences. Pronouns ("we", "our") read as low-confidence to LLMs.
4. **Authoritativeness signals.** Practitioner credentials (MD, RN, NP, PA, board certifications), years of experience, training, university/residency affiliations, before/after evidence, third-party reviews/awards. Cite sources where claims are made.
5. **Conversational, scannable phrasing.** Short paragraphs (2–4 sentences), bullet lists for service catalogs, numbered steps for "what to expect" sections, sub-headings every ~150 words. LLMs chunk by paragraph; long walls of text are harder to retrieve.
6. **Semantic structure (inferable from headings).** A logical heading hierarchy — H1 for page topic, H2 for sections, H3 for sub-questions/services. Sections labeled clearly ("Services", "Pricing", "FAQs", "Our Team", "Locations").
7. **Local specificity — geo cues throughout the body, not just the footer.** City + state, neighborhood, nearby landmarks ("five minutes from {landmark}"), service-area cities for multi-location clinics. LLMs answering "med spa near {city}" need the location named in the body content, not just the address block.
8. **Direct answers to common buyer questions:** how much does it cost, does it hurt, how long does it last, what's the downtime, am I a candidate, what should I do before/after, are there side effects. Each answered question is a potential LLM citation.
9. **Avoiding AEO anti-patterns.** Heavy reliance on imagery for content, "click here for more info" links instead of in-page detail, gated content behind forms, generic boilerplate that could describe any clinic.

# AEO scoring

- 90–100: Comprehensive — every rubric item materially addressed; would be cited frequently by LLMs.
- 70–89: Solid foundation, 2–3 meaningful gaps.
- 50–69: Some structure but multiple critical gaps (no FAQ, no pricing, vague entities).
- 30–49: Marketing-speak with little extractable fact density.
- 0–29: Effectively invisible to LLMs — no facts, no entities, no structure.

# AEO severity

- **critical**: copy is structurally broken for AEO (no facts at all, page is purely image-driven, content gated behind a form).
- **high**: a major rubric category is missing (no FAQ, no service list, no pricing signal, no practitioner names, no city named in body).
- **medium**: present but weak (FAQ exists but answers are vague; service list lacks brand names; H1 missing; sections too long).
- **low**: nice-to-have polish.

═══════════════════════════════════════════════════════════════
AUDIT 2 — Copy & conversion (med-spa-specific)
═══════════════════════════════════════════════════════════════

You are a senior med-spa marketing strategist. Audit whether the site's copy answers the questions a high-intent buyer asks before booking and removes friction from the path to a consultation. Mark each coverage topic true ONLY if the site meaningfully addresses it (a one-word mention does not count).

# Coverage topics (12 booleans)

- **servicesList** — every offered treatment is clearly listed. Brand names where appropriate.
- **pricingTransparency** — actual prices, ranges, "starting at", or per-unit pricing visible. "Contact us for pricing" does NOT count.
- **whatToExpect** — walks the buyer through the appointment experience.
- **beforeAfterEvidence** — before/after photos, measurable results, case studies (not stock photos).
- **credentials** — practitioner names with credentials (MD, RN, NP, PA), board certifications.
- **hours** — explicit business hours visible somewhere on the site.
- **locationParking** — full address with neighborhood + parking/transit info.
- **financing** — payment plans, CareCredit, Cherry, Affirm, Klarna, in-house financing.
- **consultationCta** — clear "Book a Consultation" or equivalent CTA. Generic "Contact Us" alone does NOT count.
- **trustReviews** — patient testimonials, aggregate review score, Google/Yelp/RealSelf badges, press mentions.
- **objectionHandling** — addresses common fears: pain, downtime, side effects, candidacy.
- **faq** — a real FAQ block (3+ Q&A pairs).

# Copy scoring (weighted toward conversion-critical items)

- High-impact (each missing = up to -20): consultationCta, pricingTransparency, beforeAfterEvidence, credentials, trustReviews.
- Medium-impact (each missing = up to -10): servicesList, whatToExpect, faq, objectionHandling.
- Lower-impact (each missing = up to -5): hours, locationParking, financing.

# Copy severity

- **critical**: a fundamental conversion path is broken (no booking CTA, no services listed, page reads as purely informational with no path to convert).
- **high**: a high-impact coverage item is missing or weak.
- **medium**: present but underdeveloped (services listed without descriptions; reviews shown but no aggregate score).
- **low**: polish.

# Quick-fix discipline (applies to BOTH audits)

Each quickFix is a concrete, paste-ready snippet of copy or a specific structural recommendation. Bad: "Add pricing transparency." Good: 'Add a "Pricing" section with rows like: "Botox: starting at $14/unit · Lip filler: $750–$1,200 per syringe · Microneedling: $350/session." If exact pricing varies, use a "starting at" floor.'

Return exactly one issue per distinct gap in each audit. Don't conflate. Don't pad. Use the record_combined_audit tool with both \`aeo\` and \`copy\` populated. Don't add prose outside the tool call.`;

function toIssues(rawIssues: unknown): Issue[] {
  if (!Array.isArray(rawIssues)) return [];
  return rawIssues
    .filter((i: any) => i && typeof i === 'object' && i.title)
    .map((i: any) => ({
      severity: (i.severity as Severity) || 'medium',
      title: String(i.title),
      description: String(i.description || ''),
      quickFix: i.quickFix ? String(i.quickFix) : undefined,
    }));
}

function skipped<E>(id: 'llm-copy-aeo' | 'copy-conversion', label: string, reason: string, durationMs: number): ModuleResult<E> {
  return { id, label, status: 'skipped', score: null, summary: `Skipped — ${reason}.`, issues: [], skipReason: reason, durationMs };
}

function errored<E>(id: 'llm-copy-aeo' | 'copy-conversion', label: string, message: string, durationMs: number): ModuleResult<E> {
  return { id, label, status: 'error', score: null, summary: `${label} audit failed.`, issues: [], errorMessage: message, durationMs };
}

export interface MergedRubricResult {
  aeo: ModuleResult<{ summary: string }>;
  copy: ModuleResult<{ coverage: Record<string, boolean> }>;
}

export async function runRubricMergedModule(
  site: ScrapedSite,
  clinic: ClinicInfo,
  corpus: string,
  costTracker?: CostTracker
): Promise<MergedRubricResult> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const dur = Date.now() - start;
    return {
      aeo: skipped('llm-copy-aeo', 'LLM copy / AEO', 'ANTHROPIC_API_KEY not set.', dur),
      copy: skipped('copy-conversion', 'Copy & conversion', 'ANTHROPIC_API_KEY not set.', dur),
    };
  }

  const client = new Anthropic({ apiKey, maxRetries: 8 });
  const header = `CLINIC: ${clinic.name} (${clinic.city || 'unknown city'})\nURL: ${site.finalUrl}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 12000, // covers two rubric outputs (issues + coverage + summaries) without truncation
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_combined_audit' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Site corpus (multiple pages):\n\n${corpus}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `${header}\n\nApply BOTH rubrics to the site corpus above and return record_combined_audit.` },
        ],
      }],
      cache_control: { type: 'ephemeral' },
    } as any);

    log.usage('rubric-merged', response.usage as any);
    costTracker?.add('rubric-merged', MODEL, response.usage as any);

    let payload: any = null;
    for (const block of response.content) if (block.type === 'tool_use') payload = block.input;
    if (!payload) throw new Error('No tool_use returned by Claude');

    const dur = Date.now() - start;
    const aeoPayload = payload.aeo || {};
    const copyPayload = payload.copy || {};

    const aeoResult: ModuleResult<{ summary: string }> = {
      id: 'llm-copy-aeo',
      label: 'LLM copy / AEO',
      status: 'ok',
      score: typeof aeoPayload.score === 'number' ? aeoPayload.score : null,
      summary: String(aeoPayload.summary || ''),
      issues: sortIssues(toIssues(aeoPayload.issues)),
      durationMs: dur,
    };

    const copyResult: ModuleResult<{ coverage: Record<string, boolean> }> = {
      id: 'copy-conversion',
      label: 'Copy & conversion',
      status: 'ok',
      score: typeof copyPayload.score === 'number' ? copyPayload.score : null,
      summary: String(copyPayload.summary || ''),
      issues: sortIssues(toIssues(copyPayload.issues)),
      evidence: { coverage: copyPayload.coverage || {} },
      durationMs: dur,
    };

    return { aeo: aeoResult, copy: copyResult };
  } catch (err: any) {
    const dur = Date.now() - start;
    return {
      aeo: errored('llm-copy-aeo', 'LLM copy / AEO', err.message, dur),
      copy: errored('copy-conversion', 'Copy & conversion', err.message, dur),
    };
  }
}
