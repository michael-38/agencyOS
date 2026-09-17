// Stage D prompt: one planned page + the design class contract → the markup for that page.
// The <head>, the JSON-LD, the breadcrumb data, the sitemap and llms.txt are all built in code;
// this prompt owns the body only. No industry vocabulary lives here.

export interface RenderImage {
  /** The exact src string to emit, already relative to this page. */
  src: string;
  alt: string;
  width: number;
  height: number;
  role: string;
  /** True for the one image the head preloads; it must not be lazy-loaded. */
  isLcp: boolean;
}

export interface RenderNavItem {
  label: string;
  /** The exact href to emit, already relative to this page. */
  href: string;
  current: boolean;
}

export function siteRenderSystem(): string {
  return `You write the HTML body for one page of a small static site. Another stage already wrote the stylesheet and the class contract; another stage builds the \`<head>\`, the structured data, the sitemap, and the breadcrumb markup. You write markup only.

## What you return

- \`header_html\` — the contents of the site \`<header>\` element, not including the \`<header>\` tag itself.
- \`main_html\` — the contents of the \`<main>\` element, not including the \`<main>\` tag itself. This is the whole page body.
- \`footer_html\` — the contents of the \`<footer>\` element, not including the \`<footer>\` tag itself.
- \`sticky_html\` — the mobile action bar, including its wrapper element, or an empty string if the class contract has no sticky bar.

## Absolute rules

1. **Use the class contract exactly.** Class names, nesting, and element choices come from the design document you are given. Do not invent class names it does not define, and do not restyle anything with a \`style="…"\` attribute — there are none, ever.
2. **No \`<script>\`, no \`<iframe>\`, no external URLs.** Every \`src\`, \`href\`, and \`action\` is either a relative path you were given, a \`#anchor\`, a \`tel:\` link, or \`mailto:\`. Nothing starts with \`http\` or \`//\`.
3. **Copy is given to you and is not yours to change.** Each block arrives as \`[id] text\`. Render the text verbatim and put \`data-copy-id="id"\` on the element that contains it. Do not merge two blocks into one element, do not split one across two, do not add a sentence, do not drop one. Blocks marked \`PLACEHOLDER\` additionally carry \`data-copy="placeholder"\`.
4. **Every \`<p>\` and every \`<li>\` inside \`main_html\` carries a \`data-copy-id\`.** If the contract wants a list item you were not given copy for, do not invent one — use the blocks you have.
5. **Headings.** Exactly one \`<h1>\` in \`main_html\`, with the text you were given, at the top of the first section. Every section's own heading is an \`<h2>\` with a unique \`id\`; headings inside a section are \`<h3>\`. Never skip a level. The first section therefore reads \`<h1>\` then \`<h2>\` — that is intended: the h1 names the page and the h2 names what the section answers.
6. **Paths come only from the lists in this message.** Every \`src\` and every \`href\` you emit must be a string that appears verbatim in this message's navigation, image, CTA, or link lists. The class contract below contains worked markup examples; the paths inside them are illustrations of shape, never real files. Emitting one produces a link to something that does not exist.
7. **Every visible word comes from a block.** Do not add labels, step numbers, eyebrows, badges, captions, or button text that you were not given — not "Step 1", not "Free consultation" as a heading over a block that already says it. If a pattern in the contract wants a label you have no copy for, leave the label out rather than inventing it. Text you invent has no \`data-copy-id\`, and untracked text in \`<main>\` fails validation.
8. **Images** come from the list you are given. Emit \`src\`, \`alt\`, \`width\`, and \`height\` exactly as supplied. Add \`decoding="async"\`. Add \`loading="lazy"\` to every image except the one marked as the LCP image, which gets \`fetchpriority="high"\` and no \`loading\` attribute. Never point at an image you were not given; if a section wants imagery and none is listed, use the contract's labelled placeholder element instead.
9. **Audit tags.** Some sections list \`checklist ids\`. Put \`data-checklist="<id>"\` on the specific element that satisfies each one — the tel link, the form, the gallery, the labelled placeholder that stands in for proof the source does not have — not on the section wrapper, and space-separate multiple ids on one element. Every id you are given must appear somewhere in your output.
10. **Forms do not submit anywhere.** Use \`action="#"\` and \`method="post"\`. Every input has a real \`<label>\` bound with \`for\`/\`id\`. Mark required fields with \`required\`.

## Elements the build emits, not you

The build wraps your markup and appends to it. Do not write any of these — they are added for you, and a second copy is a validation failure:

- the skip link, the unverified-copy notice, and the breadcrumb trail
- **the FAQ**, which is generated from the same source as the structured data so the two can never disagree
- **the "more from this site" internal-link block**
- \`<head>\`, \`<html>\`, \`<body>\`, structured data, and the copyright line

## Accessibility

Landmarks come from the wrapper elements, so do not add \`<header>\`, \`<main>\`, \`<nav>\`, or \`<footer>\` tags yourself except a \`<nav>\` inside \`header_html\` and inside \`footer_html\`. Give every \`<section>\` an \`id\` and an \`aria-labelledby\` pointing at its own heading's id. Give the header nav an \`aria-label\`. Mark the current page in the nav with \`aria-current="page"\`. Decorative SVG gets \`aria-hidden="true"\`; meaningful SVG gets \`role="img"\` and an \`aria-label\`.

## Answer-first structure

The opener block of each section is rendered first inside that section, immediately after its heading, as its own paragraph carrying \`data-answer-first\` in addition to its \`data-copy-id\`. Nothing goes between the heading and the opener — no image, no badge, no eyebrow text. The \`<h1>\` block on the home page is also followed directly by its opener.

Write clean, readable, indented HTML. No comments.`;
}

export interface RenderPageInput {
  path: string;
  kind: string;
  h1: string;
  primaryQuery: string;
  nav: RenderNavItem[];
  telHref: string | null;
  telLabel: string | null;
  sections: {
    id: string;
    h2: string;
    opener: { copyId: string; text: string; placeholder: boolean };
    blocks: { copyId: string; kind: string; text: string; placeholder: boolean }[];
    cta: { label: string; href: string } | null;
    images: RenderImage[];
    imagePlaceholderLabel: string | null;
    checklistIds: string[];
  }[];
  businessName: string;
  addressText: string | null;
  hoursText: string | null;
  stickyChecklistIds: string[];
  headerChecklistIds: string[];
  /** Validation failures from a previous attempt at this page, to be fixed on this pass. */
  repairNotes: string[];
}

function blockLine(b: { copyId: string; kind?: string; text: string; placeholder: boolean }): string {
  return `  [${b.copyId}]${b.placeholder ? ' PLACEHOLDER' : ''}${b.kind ? ` (${b.kind})` : ''} ${b.text}`;
}

/**
 * The class contract, as its own leading block. Every page in the render stage is handed the same
 * contract, so keeping it first and byte-identical makes it a prompt-cache hit after the first call.
 */
export function designContractBlock(designMd: string): string {
  return `## The class contract you must follow\n\nUse these class names and this nesting exactly. Do not invent names it does not define.\n\n${designMd}`;
}

export function siteRenderUser(input: RenderPageInput): string {
  const parts: string[] = [];
  parts.push(
    `## This page\n\n- path: \`${input.path}\`\n- kind: ${input.kind}\n- h1: ${input.h1}\n- the question this page answers: ${input.primaryQuery}\n- business name: ${input.businessName}`,
  );
  parts.push(
    `## Header\n\n- navigation (emit in this order):\n${input.nav.map((n) => `  - ${n.label} → \`${n.href}\`${n.current ? ' (this page — mark aria-current)' : ''}`).join('\n')}\n- phone link: ${
      input.telHref ? `\`${input.telHref}\` labelled "${input.telLabel}"` : 'none — the source site has no phone number, so omit the phone link'
    }`,
  );
  for (const s of input.sections) {
    const lines: string[] = [];
    lines.push(`### section \`${s.id}\` — h2: ${s.h2}`);
    lines.push(`opener (renders first, directly under the h2):`);
    lines.push(blockLine(s.opener));
    if (s.blocks.length) {
      lines.push(`blocks (in order):`);
      for (const b of s.blocks) lines.push(blockLine(b));
    }
    if (s.cta) lines.push(`cta: "${s.cta.label}" → \`${s.cta.href}\``);
    if (s.images.length) {
      lines.push(`images:`);
      for (const im of s.images) {
        lines.push(`  src=\`${im.src}\` alt="${im.alt}" width=${im.width} height=${im.height} role=${im.role}${im.isLcp ? ' — LCP image' : ''}`);
      }
    } else if (s.imagePlaceholderLabel) {
      lines.push(`images: none available — use the contract's labelled placeholder element, labelled "${s.imagePlaceholderLabel}"`);
    }
    if (s.checklistIds.length) lines.push(`checklist ids to tag: ${s.checklistIds.join(', ')}`);
    parts.push(lines.join('\n'));
  }
  parts.push(
    `## Footer\n\n- business name: ${input.businessName}\n- address: ${input.addressText ?? 'none in the source — omit'}\n- hours: ${input.hoursText ?? 'none in the source — omit'}\n- phone: ${input.telHref ? `\`${input.telHref}\`` : 'none — omit'}\n- repeat the navigation as a footer nav\n\nDo not put a copyright line, a privacy link, or a terms link in the footer; those are added later.`,
  );
  parts.push(
    `## Mobile action bar\n\n${
      input.telHref
        ? `Emit the contract's sticky mobile bar with the phone link and the page's primary action.${input.stickyChecklistIds.length ? ` Tag it \`data-checklist="${input.stickyChecklistIds.join(' ')}"\`.` : ''}`
        : 'The source site has no phone number, so emit an empty string for `sticky_html` unless the page has a form to point at.'
    }`,
  );
  if (input.repairNotes.length) {
    parts.push(
      `## Fix these before returning\n\nA previous attempt at this exact page failed validation. Return the whole page again, corrected. Change nothing else.\n\n${input.repairNotes.map((r) => `- ${r}`).join('\n')}`,
    );
  }
  return parts.join('\n\n---\n\n');
}
