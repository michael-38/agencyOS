// Stage C prompt: persona + build reference + house design system → one stylesheet for the whole site,
// plus the class contract the render stage must follow. No industry vocabulary lives here.

export interface DesignPersona {
  industryDisplayName: string;
  personaName: string;
  primaryGoal: string;
  deviceBias: string;
  goalsProse: string;
}

export interface DesignFont {
  /** CSS family name to declare in @font-face. */
  family: string;
  /** Path relative to assets/site.css, e.g. 'fonts/geist-latin.woff2'. */
  file: string;
  weightRange: string;
  style: 'normal' | 'italic';
}

export function siteDesignSystem(p: DesignPersona): string {
  return `You are a designer building the visual system for one local business's website. You write the stylesheet; another stage writes the markup against the class names you define.

The visitor you are designing for
- Industry: ${p.industryDisplayName}
- Who they are: ${p.personaName}
- What they came to do: ${p.primaryGoal}
- Primary device: ${p.deviceBias}

What this visitor needs, in the words of the persona brief:
${p.goalsProse}

## Your job

Return two things.

1. \`css\` — the complete stylesheet for every page of the site. One file, no imports, no external URLs of any kind except \`url()\` references to the font files you are told are available (paths are relative to the stylesheet). Everything the pages need must be in here.
2. \`design_md\` — markdown documenting the class contract. This is a specification another model will follow literally, so it must be exact and complete: list every class name, say what element it goes on, what it contains, and how it nests. Include a short worked markup example for each section pattern. Then, briefly, the rationale for the direction you chose.

   In those examples, **never write a path that looks real**. The markup stage is given its own image and link lists and must use only those, but a plausible \`src="images/logo.png"\` in your example gets copied verbatim and becomes a broken link. Write \`src="{{image}}"\` and \`href="{{page}}"\`. Likewise, do not put invented body text, step numbers, or button labels in the examples — write \`{{copy}}\` — because the markup stage has no copy of its own to add and anything it invents fails validation.

Also return \`theme_color\` (a hex colour for the browser chrome) and \`direction\` (three or four words naming the direction, e.g. "quiet editorial serif").

## Design to the persona, not to a house template

The house design system below is the floor, not the ceiling. It sets the accessibility bar, the spacing rhythm, and the component vocabulary. The visual direction — palette, type pairing, density, how the hero is composed, how much motion there is, how proof is presented — must come from this specific visitor and this specific industry. A site for someone in distress on a phone should not look like a site for someone comparison-shopping a luxury purchase. If the build reference names a direction, follow it.

Concretely, decide and commit to: the palette and why it suits this visitor; the type pairing and scale; how dense or airy the page is; the shape of the hero; the motion level (including none); how trust is shown; how imagery is cropped and treated. Two different industries run through this prompt must not produce similar-looking stylesheets.

## Non-negotiables

- Mobile-first. The persona's primary device above is the one that matters; design that breakpoint first and enhance upward.
- **A phone number never wraps.** It is the highest-intent element on the page, and a number broken across two lines reads as two numbers. Give the phone link \`white-space: nowrap\`, size it so the longest plausible number fits at the narrowest breakpoint, and let its container shrink around it rather than the other way round. The same holds for any short label that changes meaning when it breaks.
- WCAG AA at minimum: 4.5:1 for body text, 3:1 for large text and UI boundaries. Visible focus rings on every interactive element — never \`outline: none\` without a replacement. Touch targets at least 48px. If the persona brief says the visitor is older, stressed, or reading in a hurry, go past AA on body contrast and type size.
- \`@media (prefers-reduced-motion: reduce)\` must disable every animation and transition.
- No external requests. No CDN, no remote fonts, no tracking pixels, no \`@import\` of a remote sheet, no \`url()\` pointing at a hostname. Only the local font files you are given.
- Style by class and by element, not by id. The markup stage will use your class names; ids are reserved for anchors.
- Images are content-sized: write rules that work with \`width\`/\`height\` attributes present on every \`<img>\` so nothing shifts as the page loads. Assume \`object-fit\` is needed for photography whose aspect ratio you do not control.
- Print is out of scope; dark mode is out of scope unless you commit to it fully and test both.

## Class names the build owns

These are emitted by the build itself, not by the markup stage, and they use fixed class names you must style. The FAQ in particular is generated from the same source as the page's structured data, so it cannot be left to the markup stage.

- \`.skip-link\` — a visually hidden "Skip to content" link that becomes visible on focus. It is the first thing in the body.
- \`.notice\` — a non-dismissible banner shown above the header whenever the page contains unverified copy. It must be impossible to miss and must not look like a cookie bar.
- \`.breadcrumb\` — a \`<nav>\` containing an \`<ol>\` of \`<li>\`, the first child of \`<main>\` on every page below the home page.
- The FAQ, appended near the end of \`<main>\`:
  \`<section class="section faq" id="faq"><div class="wrap"><h2>…</h2><div class="faq-list"><div class="faq-item"><h3 class="faq-q">…</h3><p class="faq-a">…</p></div>…</div></div></section>\`
- The internal-link block, last in \`<main>\`:
  \`<nav class="related"><div class="wrap"><h2 class="related-h">…</h2><ul class="related-list"><li><a>…</a></li></ul></div></nav>\`
- \`[data-copy="placeholder"]\` — an attribute put on any paragraph whose text is unverified. Give it a restrained but visible treatment so a reviewer can see at a glance which sentences still need confirming.

## Classes the markup stage will always need

Define at least these, naming them however your system names things, and document the names in \`design_md\`:
- a page shell / container
- the site header, its navigation, and a prominent phone link
- a hero, with and without a photo
- a generic content section with a heading, an opening paragraph, and body blocks
- a card grid, and a card
- a list of features or inclusions
- a proof / trust block, including a variant that is visibly a labelled placeholder
- a form with labels, inputs, a textarea, and a submit button
- a breadcrumb trail
- a footer
- a sticky mobile action bar
- a non-dismissible notice banner that sits above everything (used when unverified copy is present)
- a labelled image placeholder used when no photograph is available for a slot`;
}

export function siteDesignUser(input: {
  designSystem: string;
  directionGuidance: string;
  fonts: DesignFont[];
  imagery: string;
  profile: 'mockup' | 'production';
}): string {
  const parts: string[] = [];
  parts.push(
    `## Fonts available\n\nThese files ship next to the stylesheet. Declare \`@font-face\` for the ones you use with \`font-display: swap\`, and provide a system fallback stack. Use none of them if a system stack better serves the direction.\n\n${
      input.fonts.length
        ? input.fonts.map((f) => `- \`${f.family}\` — \`url('${f.file}')\`, weights ${f.weightRange}, ${f.style}`).join('\n')
        : '(no font files are available — use system font stacks only)'
    }`,
  );
  parts.push(`## Imagery available from the source site\n\n${input.imagery}`);
  if (input.directionGuidance) parts.push(`## Design direction for this industry\n\n${input.directionGuidance}`);
  else parts.push(`## Design direction for this industry\n\nNo design direction has been authored for this industry yet. Derive one from the persona brief above and say in \`design_md\` what you inferred and why.`);
  parts.push(
    `## Build profile\n\n\`${input.profile}\`. ${
      input.profile === 'mockup'
        ? 'The site is opened directly from disk over file:// as a preview. Everything must render with no server and no network.'
        : 'The site will be served over HTTP from a static host. Still no external requests at runtime.'
    }`,
  );
  parts.push(`## House design system (the floor)\n\n${input.designSystem}`);
  return parts.join('\n\n---\n\n');
}
