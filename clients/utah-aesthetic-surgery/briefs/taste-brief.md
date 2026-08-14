# Brief for `/design-taste-frontend` — Utah Aesthetic Surgery, Version B

**Design read:** landing page for prospective aesthetic-surgery patients in South Jordan,
Utah, with a restrained editorial language, leaning toward a print-magazine aesthetic rather
than any component framework.

**Mode: Redesign-Overhaul (§11.A).** The client's current WordPress site is the
anti-reference, not the starting point. You have no fetch capability, so the audit inputs
are `../source-content/` (the crawl) and `../fact-sheet.md` (the verified facts). Read the
fact sheet before writing a single line of copy.

**Dials:** DESIGN_VARIANCE 8 · MOTION_INTENSITY 4 · VISUAL_DENSITY 3.
Higher variance than Version A on purpose. This is the bolder of two options the client
will choose between.

---

## Non-negotiable overrides

These come from `/DESIGN.md` and `../DESIGN.md`, which outrank this skill on AgencyOS
surfaces. Each one overrides a stated default of yours.

| Your default | What to do here instead |
|---|---|
| React/Next + Tailwind v4 + Motion | **Vanilla HTML5. One self-contained `index.html`, inline `<style>`, no build step, no framework, no utility classes.** |
| "Never link Google Fonts via `<link>` in production" | Agreed, and already solved: the woff2 files are **self-hosted** in `fonts/`. Use `@font-face` with the local paths. Never add a CDN link. |
| Inter discouraged as a default | **Inter Tight is the body face**, invoked under your own override clause: this audience is majority mobile and legibility outranks novelty. Do not substitute Geist/Satoshi/Cabinet Grotesk. |
| Serif very discouraged; **Fraunces banned** | **Fraunces is the pinned brand display face**, with the italic axis as the emotional beat. Your own rule is "the brief wins" and this is the brief. |
| Hand-rolled SVG icons never | Use inline **Phosphor** paths only. Phosphor is a named family and is already prescribed by `/DESIGN.md`. Do not hand-draw decorative SVG. |
| No pure-text pages; needs real images | Real client photography is in `images/`. **Never** add stock, Picsum, or generated imagery. If you need a shot that does not exist, leave a labeled placeholder and say so. |
| Palette freedom | Hold the seeded med-spa palette in `../DESIGN.md` (warm sand ground, `#a04e36` accent). You may change composition, scale, rhythm and density freely. **Do not substitute your own palette.** |

## Where your rules DO win over ours

These three are the reason Version B exists. Version A follows house habit; you should not.

1. **No 3-column equal feature cards.** Version A uses card grids. You must not.
2. **Section-layout-repetition ban.** Every layout family appears at most once. Eight
   sections need at least four distinct families.
3. **Zigzag cap.** No more than two consecutive image-and-text splits.

Also enforced, from your §9: **zero em-dashes and zero en-dashes-as-separators in visible
text**, no scroll cues, no locale strips, no fake-perfect numbers, no filler verbs, no
"Jane Doe" or "Acme" placeholders, no custom cursors, tinted shadows only, one radius
scale, and page theme lock (no mid-page inversion).

## Content rules that outrank craft

- **Every fact comes from `../fact-sheet.md`.** No exceptions.
- Items marked `[CONFIRM]` there are **not sourced** and must not appear: no star rating, no
  review count, no pricing, no financing, no named certifying board, no named staff besides
  Dr. Rodrigues, no clinic founding year, no online booking.
- Patient reviews ship **verbatim** with the published first name and month/year.
- Medical claims discipline: no outcome guarantees, no "permanent" or "risk free", no
  before/after presented as typical. A results disclaimer is required near the gallery.
- The phone number `801-810-0761` is the primary conversion and must be a tappable `tel:`
  link with tabular numerals, reachable from any scroll position on mobile.

## Output

Write to `../versions/b/index.html`. Fonts already in `versions/b/fonts/`, images in
`versions/b/images/`. Run your §14 pre-flight before you consider it done.

**Do not read `../versions/a/index.html`.** Version A is a separate answer to the same
brief; reading it collapses the comparison into two variants of one idea.
