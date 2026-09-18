// The one billed call. The audited site's own pages → slot values for this industry's template.
//
// Narrower than the stage it replaces, deliberately. The model no longer chooses a site
// architecture, writes a stylesheet, or emits markup, because the template already settled all
// three. What is left is the one thing only a reader of the source can do: decide what this business
// actually says, and say it in the template's shape.
//
// Contains no industry vocabulary. The persona file and the build reference supply it.
import type { SlotDef, TemplateManifest } from '../../site/template.js';

export interface ContentPersona {
  industryDisplayName: string;
  personaName: string;
  primaryGoal: string;
  deviceBias: string;
  /** personas/<slug>.md + personas/_common.md goals prose, concatenated. */
  goalsProse: string;
}

export interface ContentGuidance {
  /** Filled sections of the archetype reference, as markdown. May be empty. */
  archetype: string;
  /** Filled sections of the industry reference, as markdown. May be empty. */
  industry: string;
}

export interface ContentGap {
  id: string;
  criterion: string;
  verdict: string;
  weight: string;
  scope: string;
  note: string;
}

export function siteContentSystem(p: ContentPersona): string {
  return `You are a conversion copywriter filling in a finished page design for a local business, working only from that business's own existing website.

The business
- Industry: ${p.industryDisplayName}
- The visitor you are writing for: ${p.personaName}
- What that visitor is trying to do: ${p.primaryGoal}
- Primary device: ${p.deviceBias}

What this visitor needs, in the words of the persona brief:
${p.goalsProse}

## Your job

The page already exists. Its layout, typography, colour, section order, imagery and markup were designed for this industry and are not yours to change. You are given a list of **slots** — the strings that make the page about this particular business — and you return a value for each one.

You are not designing anything, and you are not writing HTML, CSS or markdown. Return plain sentences.

## The honesty rule, which outranks everything else

Every value you return carries a source.
- \`source_kind: "source"\` means you are restating something the supplied pages actually say. You must include \`source_page_url\` (the exact url of the \`<page>\` you took it from) and \`source_quote\` (a verbatim span, copied character-for-character from that page's text, that supports your sentence). The quote is checked against the source; one that cannot be found is discarded and your sentence is downgraded to a placeholder.
- \`source_kind: "placeholder"\` means the source says nothing on this point. Then the text must contain no specific claim at all: no numbers, prices, ratings, review counts, years in business, licence or certificate numbers, named brands, named clients, awards, guarantees, or response-time promises. Write something true-by-construction and generic, and keep it short.

Never invent a fact to fill a gap, and never "reasonably assume" one because businesses of this kind usually have it. A thin source produces a page with honest placeholders and fewer sections; that is the correct outcome, and it is far more useful than a plausible fiction. Never write a review, a testimonial or a rating that is not already published on the source site.

## How slots work

Each slot has an id, a kind, a character budget, and an intent that tells you what that slot has to accomplish. Write to the intent and stay inside the budget; a value over budget is cut on a word boundary, which usually reads worse than the shorter sentence you would have written.

- **Optional slots.** Some slots are marked optional. These are almost always facts — a price, a licence, a rating, a duration. If the source does not state it, **omit the slot entirely**: leave it out of your \`slots\` array. The page removes that element. Do not return an optional slot as a placeholder, and do not return an empty string; an empty price line is worse than no price line.
- **Repeating slots.** A slot id of the form \`group[].field\` repeats. Return one entry per item, numbering from zero: \`services[0].name\`, \`services[1].name\`, and so on. Each group states how many items it accepts. Return as many as the source genuinely supports and no more — padding a four-service list to six means inventing two services. If the source supports fewer than the minimum, return none for that group and the page removes the section that holds it.
- **Section ids.** Any section whose subject the source says nothing about goes in \`omit_sections\`. A removed section is better than a section of placeholders.
- Do not return a slot id that is not in the list. Do not return the same singleton slot twice.

## Writing for this page

- **Answer first.** A slot whose intent says "answer-first" is the sentence an assistant will quote out of context. It must answer its section's heading on its own, without the rest of the page.
- **Name entities in full.** Write the service and the place by name rather than "our services in the area" or "we also do this". Assistants and search engines resolve names, not pronouns, and a sentence quoted out of context keeps nothing else.
- **One label per intent.** If two slots are both a primary action, give them the same words. Do not write "Get a quote" in one place and "Request an estimate" in another.
- **No dashes as punctuation.** Use a comma, a colon, or a full stop. Em dashes and en dashes are stripped before the page is written, so a sentence that depends on one will read wrong.
- **No section cross-references.** Never write "as mentioned above" or "see below"; every section is quoted on its own.
- Facts that appear in the facts block or in the source text survive unchanged: business name, phone, address, hours, licence identifiers, years in business, and the exact names of services and places. Rewrite the sentences around them; never rewrite the facts themselves.
- Slots whose ids begin \`fact.\` are filled by code from the audit's own extraction. They are not in your list and you must not return them.

## Title and description

\`title\` must be 10 to 70 characters and \`meta_description\` 50 to 170. Both are clamped in code if you overrun, so write to the window. The title names the business and what it does and where; the description is one direct sentence a searcher can act on.

## Entities

Alongside the slots, return the named things the page is entitled to state: services, areas served, credentials, price statements, and a rating. These become the page's structured data and its llms.txt, so each one needs the same verbatim quote as any other sourced string. Return a rating **only** when the source states both a value and a count.`;
}

/**
 * The scraped pages, as their own leading block. It is the largest part of the request and is sent
 * byte-identical, so keeping it first is what lets it be prompt-cached across a retry or a
 * subsequent build in the same run.
 */
export function sourceCorpusBlock(corpus: string): string {
  return `## Source pages\n\nThis is the only permitted source of copy and the only permitted source of quotes. A quote must appear verbatim inside the matching \`<page>\` block.\n\n${corpus}`;
}

/** One row per slot the model is responsible for. Derived from the template, never hand-written. */
export function slotTable(manifest: TemplateManifest): string {
  const prompted = promptedSlots(manifest);
  const rows = prompted.map((s) => {
    const flags = [s.optional ? 'optional' : 'required', s.max ? `<= ${s.max} chars` : null, s.answerFirst ? 'answer-first' : null]
      .filter(Boolean)
      .join(', ');
    return `| \`${s.id}\` | ${s.kind} | ${flags} | ${s.intent.replace(/\|/g, '\\|')} |`;
  });
  const groups = manifest.repeats
    .filter((r) => r.slotIds.some((id) => prompted.some((s) => s.id === id)))
    .map((r) => `- \`${r.group}[]\`: between ${r.min} and ${r.max} items${r.sectionId ? ` (section \`${r.sectionId}\`)` : ''}`);
  const sections = manifest.sections.map((s) => `\`${s.id}\``).join(', ');

  return [
    `## Slots (${prompted.length})`,
    '',
    '| slot | kind | rules | what it has to accomplish |',
    '|---|---|---|---|',
    ...rows,
    '',
    groups.length ? `### Repeating groups\n\n${groups.join('\n')}` : '',
    '',
    `### Sections on this page\n\n${sections}\n\nList any of these in \`omit_sections\` if the source says nothing about its subject.`,
  ]
    .filter((s) => s !== '')
    .join('\n');
}

/**
 * The slots the model is asked for: everything except the code-owned `fact.*` values and the mirrors,
 * which repeat a canonical slot's value and are filled without a second answer.
 */
export function promptedSlots(manifest: TemplateManifest): SlotDef[] {
  const seen = new Set<string>();
  const out: SlotDef[] = [];
  for (const s of manifest.slots) {
    if (s.id.startsWith('fact.') || s.mirror) continue;
    // A repeat declares its fields once per prototype; the model is asked for each field once.
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

export function siteContentUser(input: {
  facts: string;
  guidance: ContentGuidance;
  gaps: ContentGap[];
  manifest: TemplateManifest;
  profile: 'mockup' | 'production';
}): string {
  const parts: string[] = [];
  parts.push(`## Facts extracted from the source site (must survive unchanged)\n\n${input.facts}`);
  if (input.guidance.archetype) parts.push(`## Build reference — business archetype\n\n${input.guidance.archetype}`);
  if (input.guidance.industry) parts.push(`## Build reference — this industry\n\n${input.guidance.industry}`);
  if (!input.guidance.archetype && !input.guidance.industry) {
    parts.push(
      `## Build reference\n\nNo build reference has been authored for this industry yet. Work from the persona brief and the source pages alone, and be more conservative than usual about what you assert.`,
    );
  }
  parts.push(
    `## Audit findings this page should close\n\nThese are the checklist items the current site fails or only partly meets. The page's sections were designed to carry them; write the copy that actually satisfies them.\n\n${
      input.gaps.length
        ? input.gaps
            .map((g) => `- \`${g.id}\` (${g.verdict}, ${g.weight}, scope ${g.scope}): ${g.criterion}${g.note ? ` — auditor's note: ${g.note}` : ''}`)
            .join('\n')
        : '(none — the current site already meets every checklist item)'
    }`,
  );
  parts.push(slotTable(input.manifest));
  return parts.join('\n\n---\n\n');
}
