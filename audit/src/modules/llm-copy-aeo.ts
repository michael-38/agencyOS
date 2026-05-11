import Anthropic from '@anthropic-ai/sdk';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { MODELS } from '../utils/models.js';
import { log } from '../utils/logger.js';
import { CostTracker } from '../utils/cost.js';
import type { ScrapedSite } from '../extractors/scrape.js';

const MODEL = MODELS.rubric_judgment;

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

// Static across every audit. Sized to clear Sonnet 4.6's 2048-token cache minimum
// once combined with the tool schema, so batch runs hit the cache from request 2.
const SYSTEM_PROMPT = `You are an expert auditor evaluating whether a med spa clinic's website copy is optimized for Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), and direct citation by large language models (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, Bing Copilot).

You will receive a single page's URL, title, and markdown content. Score the copy 0–100 against the rubric below and return a list of severity-rated, fixable issues. Each issue's quickFix must be concrete and, where possible, copy-pasteable text the clinic owner can drop into their CMS.

# Rubric (use every item)

1. **Declarative factual statements an LLM can lift verbatim.** Services offered, treatment durations, prices or "starting at" ranges, hours, address, phone, qualifications. Vague marketing prose ("we deliver excellence") is invisible to LLMs — concrete facts get cited.

2. **Question-and-answer / FAQ structure** that matches the way users actually phrase queries. "How much does Botox cost in {city}?", "Does microneedling hurt?", "How long does lip filler last?". A real FAQ section with H3 questions and short, direct answers is one of the strongest AEO signals.

3. **Named-entity richness.** Clinic name, individual practitioners (with credentials), brand-name treatments (Botox, Dysport, Juvederm, Restylane, Sculptra, Morpheus8, etc.) used in natural sentences. Pronouns ("we", "our") read as low-confidence to LLMs.

4. **Authoritativeness signals.** Practitioner credentials (MD, RN, NP, PA, board certifications), years of experience, training, university/residency affiliations, before/after evidence, third-party reviews/awards. Cite sources where claims are made.

5. **Conversational, scannable phrasing.** Short paragraphs (2–4 sentences), bullet lists for service catalogs, numbered steps for "what to expect" sections, sub-headings every ~150 words. LLMs chunk by paragraph; long walls of text are harder to retrieve.

6. **Semantic structure (inferable from headings).** A logical heading hierarchy — H1 for page topic, H2 for sections, H3 for sub-questions/services. Sections labeled clearly ("Services", "Pricing", "FAQs", "Our Team", "Locations").

7. **Local specificity — geo cues throughout the body, not just the footer.** City + state, neighborhood, nearby landmarks ("five minutes from {landmark}"), service-area cities for multi-location clinics. LLMs answering "med spa near {city}" need the location named in the body content, not just the address block.

8. **Direct answers to common buyer questions:** how much does it cost, does it hurt, how long does it last, what's the downtime, am I a candidate, what should I do before/after, are there side effects, how is it different from {competitor treatment}. Each answered question is a potential LLM citation.

9. **Avoiding AEO anti-patterns.** Heavy reliance on imagery for content (LLMs can't read images), "click here for more info" links instead of in-page detail, gated content behind forms, JavaScript-rendered content that crawlers may miss, generic boilerplate that could describe any clinic.

# How to score

- 90–100: Comprehensive — every rubric item materially addressed; would be cited frequently by LLMs.
- 70–89: Solid foundation, 2–3 meaningful gaps.
- 50–69: Some structure but multiple critical gaps (no FAQ, no pricing, vague entities).
- 30–49: Marketing-speak with little extractable fact density.
- 0–29: Effectively invisible to LLMs — no facts, no entities, no structure.

# Severity guidance

- **critical**: copy is structurally broken for AEO (no facts at all, page is purely image-driven, content gated behind a form).
- **high**: a major rubric category is missing (no FAQ, no service list, no pricing signal, no practitioner names, no city named in body).
- **medium**: present but weak (FAQ exists but answers are vague; service list lacks brand names; H1 missing; sections too long).
- **low**: nice-to-have polish (add a "what to expect" sub-section; tighten paragraph length).

Return one issue per gap. Don't conflate. Don't pad. Use the record_aeo_audit tool. Don't add prose outside the tool call.`;

export async function runLlmCopyAeoModule(
  site: ScrapedSite,
  corpus: string,
  costTracker?: CostTracker
): Promise<ModuleResult<{ summary: string }>> {
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

  const client = new Anthropic({ apiKey, maxRetries: 8 });

  // Two cache breakpoints: the rubric (system + tools) via top-level cache_control,
  // and the site corpus inside the user message. Both are static within an audit
  // and shared with copy-conversion, so the second module reads everything.
  const header = `URL: ${site.finalUrl}\nTITLE: ${site.title}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_aeo_audit' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Site corpus (multiple pages):\n\n${corpus}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `${header}\n\nApply the rubric to the full site corpus above. Use record_aeo_audit.` },
        ],
      }],
      cache_control: { type: 'ephemeral' },
    } as any);

    log.usage('llm-copy-aeo', response.usage as any);
    costTracker?.add('llm-copy-aeo', MODEL, response.usage as any);
    let payload: any = null;
    for (const block of response.content) if (block.type === 'tool_use') payload = block.input;
    if (!payload) throw new Error('No tool_use returned by Claude');

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
