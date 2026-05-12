import Anthropic from '@anthropic-ai/sdk';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { MODELS } from '../utils/models.js';
import { log } from '../utils/logger.js';
import { CostTracker } from '../utils/cost.js';
import type { PageShots } from '../extractors/screenshots.js';

const MODEL = MODELS.vision_rubric;

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

// Static across every audit. Sized to clear Sonnet 4.6's 2048-token cache minimum.
// Images themselves are volatile and live in the user message after the cache breakpoint.
const SYSTEM_PROMPT = `You are an objective, opinionated design critic reviewing the homepage of a med spa clinic. You will be shown two full-page screenshots: mobile (390 wide) first, then desktop (1440 wide). Both may be tall — evaluate the entire visible canvas, not just the hero.

Score the design 0–100 and return a list of severity-rated, fixable issues. Each issue's quickFix must be specific (a concrete change a designer or developer can act on), not generic advice.

# Rubric — evaluate against every category

## Visual hierarchy
Does the eye know where to go first, second, third? Is the primary CTA visually dominant? Are headings differentiated by size, weight, and color from body text? Are competing elements fighting for attention?

## Whitespace and breathing room
Is there enough space between sections? Around CTAs? Between paragraphs? Cramped layouts read as cheap; over-spaced ones read as empty. Med-spa luxury aesthetic leans generous on whitespace.

## Typography
- Are typefaces consistent across sections? (Multiple competing serifs/sans is a red flag.)
- Is the type pairing intentional? (Serif display + sans body is a common luxury move.)
- Is the type sized for readability? Body text below ~16px on desktop or ~15px on mobile is a problem.
- Is there a thoughtful use of italics, weight, and tracking? Or is everything default-weight Inter/Roboto?
- AI-slop indicator: defaulting to system fonts (Inter, Roboto, system-ui) with no display typeface for headlines.

## Color palette
- Is the palette cohesive? Are brand colors used consistently?
- Does it fit the med-spa luxury/wellness category? (Earthy neutrals, warm creams, muted terracotta/sage/blush, deep charcoal/ink — yes. Hospital teal, bright pink, generic gradient — no.)
- Is contrast sufficient on text and CTAs (WCAG-ish)?
- AI-slop indicator: purple-to-pink gradients on white, generic teal "trust blue", default Bootstrap blue CTA.

## Photography
- Is the imagery real (the actual practice, real practitioners, real patients) or stock?
- Lighting and mood: warm/natural vs. flat/clinical?
- AI-slop indicator: obviously-AI-generated faces, generic "happy doctor" stock, mismatched skin tones, uncanny hands.

## Brand cohesion
Do hero, services, testimonials, footer feel like one brand? Or like Frankenstein's monster of templates?

## Mobile fit
- Is the mobile screenshot cramped or overflowing?
- Are tap targets comfortably large (>= ~44×44 CSS px)?
- Is text legible without pinch-zoom?
- Is the mobile CTA visible above the fold?

## Dated patterns
Avoid: heavy drop shadows, bevels, default Bootstrap cards, ornamental clip-art icons, gradients-on-everything, "click here" buttons styled as 2010-era pills.

## AI-slop / template-y indicators
- Generic stock heroes (woman with arms crossed in a labcoat, lavender petals, hands holding a glass dropper).
- Default theme leftovers ("Lorem ipsum", placeholder phone numbers, sample author bios).
- Cookie-cutter "Why choose us?" three-column with stock icons.
- Stock testimonial avatars with first-name-only names.

## Modern luxury aesthetic appropriate for med spa
Editorial, magazine-cut, restrained, evidence-based. Closer to Kinfolk/Cereal/Magnolia than to dental-office or chiropractor templates. Confident, quiet, expensive-feeling.

# Score 0–100

- 90–100: would not be out of place in an Architectural Digest "best new clinics" feature.
- 75–89: solid, on-brand, modern with one or two notable polish opportunities.
- 60–74: competent but template-y or visually inconsistent.
- 45–59: obvious dated patterns, AI-slop, or off-brand for med-spa luxury.
- 0–44: actively hurts the clinic's perceived quality.

# Severity guidance

- **critical**: damages perceived quality directly (dated 2010 template, broken mobile layout, AI-generated faces in the hero).
- **high**: major rubric category failing (no clear hierarchy, illegible body type, palette feels wrong for the category).
- **medium**: present but weak (hero photo is stock; typography is competent but generic).
- **low**: polish (tighten heading tracking, increase section padding).

Each quickFix must be specific. Bad: "Improve typography." Good: "Replace the body sans (looks like Roboto) with Inter Tight at 16px / 1.55 line-height; pair with Fraunces 48–56px on the H1 in italic for the magazine accent."

Use the record_design_review tool. Don't add prose outside the tool call.`;

export async function runDesignReviewModule(
  pageShots: PageShots[],
  costTracker?: CostTracker
): Promise<ModuleResult<{ summary: string }>> {
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

  if (pageShots.length === 0) {
    return {
      id: 'design-review',
      label: 'Design',
      status: 'skipped',
      score: null,
      summary: 'Skipped — no screenshots captured.',
      issues: [],
      skipReason: 'screenshots unavailable',
      durationMs: Date.now() - start,
    };
  }

  const client = new Anthropic({ apiKey, maxRetries: 8 });

  // Build content blocks: for each page, a label text + mobile image + desktop image.
  // No cache_control — screenshots vary per audit, system+tools is under the cache minimum,
  // and the per-call cost is dominated by image tokens anyway.
  const blocks: any[] = [];
  blocks.push({
    type: 'text',
    text: `Below are mobile (390×844) and desktop (1440×900) screenshots for ${pageShots.length} page(s) on this clinic's site, in the order shown. For each page, mobile screenshot is first, then desktop. Evaluate per the rubric and call out inconsistencies across pages where they exist.`,
  });
  for (const p of pageShots) {
    blocks.push({ type: 'text', text: `\n## ${p.label} (${p.url})` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.mobileClippedBase64 } });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.desktopClippedBase64 } });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'record_design_review' },
      messages: [{ role: 'user', content: blocks }],
    });

    log.usage('design-review', response.usage as any);
    costTracker?.add('design-review', MODEL, response.usage as any);
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
