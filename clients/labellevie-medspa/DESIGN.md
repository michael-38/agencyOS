---
name: La Belle Vie Medical Care & Aesthetics — Version A
description: A drenched duochrome refraction instrument. Green ground, oxide-red counter-field, one lit amber indicator, chalk type on a Snellen acuity ramp.
colors:
  ground: "#06392C"
  ground-deep: "#04281F"
  red: "#6B1815"
  red-deep: "#521310"
  amber: "#F4C518"
  amber-lit: "#FFD630"
  amber-deep: "#D9AC08"
  chalk: "#EEF3EC"
  sage: "#A9C4B4"
  sage-dim: "#8FB3A0"
  ink: "#052018"
  line: "rgba(169,196,180,.24)"
  line-firm: "rgba(169,196,180,.42)"
  red-label: "#E7B9AE"
  red-copy: "#F0D3CD"
  red-line: "rgba(240,211,205,.3)"
  red-line-firm: "rgba(240,211,205,.4)"
  wash: "rgba(238,243,236,.06)"
  inset: "rgba(0,0,0,.13)"
  seam: "rgba(0,0,0,.35)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.1vw, 4.7rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.028em"
    fontVariation: "wdth 118%"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 4.2vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.028em"
    fontVariation: "wdth 118%"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.45rem, 2.7vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.02em"
    fontVariation: "wdth 118%"
  nameplate:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.85rem, 1.3rem + 2.6vw, 3.15rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.02em"
    fontVariation: "wdth 125%"
  quote:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.2rem, 1.05rem + 0.8vw, 1.72rem)"
    fontWeight: 500
    lineHeight: 1.32
    letterSpacing: "-0.015em"
    fontVariation: "wdth 108%"
  lede:
    fontFamily: "Atkinson, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.06rem, 1rem + 0.5vw, 1.32rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Atkinson, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.97rem + 0.18vw, 1.115rem)"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(0.72rem, 0.86vw, 0.8rem)"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.16em"
    fontVariation: "wdth 125%"
rounded:
  hairline: "1px"
  edge: "2px"
spacing:
  container: "1200px"
  gutter: "clamp(20px, 4vw, 48px)"
  section: "clamp(56px, 8vw, 110px)"
  column-gap: "clamp(24px, 4vw, 56px)"
  label-track: "minmax(150px, 190px)"
components:
  call-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.edge}"
    padding: "15px 26px 15px 18px"
  call-primary-hover:
    backgroundColor: "{colors.amber-lit}"
    textColor: "{colors.ink}"
  ghost:
    textColor: "{colors.chalk}"
    rounded: "{rounded.edge}"
    padding: "15px 22px"
  ghost-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.chalk}"
  callbar:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    height: "60px"
  panel-label:
    textColor: "{colors.sage-dim}"
    typography: "{typography.label}"
  register-row:
    textColor: "{colors.sage}"
    padding: "20px 0 22px"
  dial-stop:
    textColor: "{colors.sage-dim}"
    padding: "16px 0 20px"
  dial-stop-checked:
    textColor: "{colors.amber}"
  disclaimer:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.sage}"
    rounded: "{rounded.edge}"
    padding: "18px 20px"
  named-chip:
    textColor: "{colors.sage}"
    rounded: "{rounded.edge}"
    padding: "7px 13px"
---

# Design System: La Belle Vie Medical Care & Aesthetics — Version A

> Recorded from the shipped artifact at `versions/a/index.html`, not from the brief. Where the
> two diverge, this file follows the build. Version B in `versions/b` is a separate world and
> shares nothing below.

## Overview

**Creative North Star: "The Refraction Instrument"**

The page is built as an ophthalmic refraction exam, the one medical ritual in which the patient
decides every increment and it stops when it is right. That is not a theme laid over a med spa
page; it is the argument. The visitor's stated fear is coming out overfilled, and the answer is a
world where every quantity is small, named, and chosen by her. The surface behaves like a
calibrated instrument: drenched fields of colour, engraved labels in the margin, countable
authored geometry, and one lit indicator that only ever means "this is the reading".

Density is high and the page is honest about it. There are no reviews, no ratings, no
before/afters, no prices, and no photograph of the provider, so credibility is carried by
specificity: named devices, named mechanisms, published timelines, and the practitioner's own
verbatim sentences set large. Nothing is padded to fill a grid. The two refusals the world was
built against are the blush soft-focus med spa page and its predictable opposite, white-chrome
clinical minimalism; both are absent, and neither may be reintroduced as a "lighter" variant.

Material behaviour is flat and tonal. Every plane is a solid field, every division is a hairline,
and depth comes from stepping the ground darker rather than lifting anything off it. The page
carries zero shadows and zero gradients, and its photographs are duotoned down into the ground so
that no rectangle floats.

**Key Characteristics:**
- Drenched dark green ground with an oxide-red counter-field; no third ground colour.
- A single accent (amber) rationed to states that genuinely indicate.
- Six-step Snellen acuity ramp, fixed ratios, never interpolated.
- Emphasis by variable-width axis, not by a second face.
- Hairline registers as the only container; zero cards, zero shadows, zero gradients.
- Authored inline SVG for every mark on the page; no icon set, no glyph font.

## Colors

Two saturated positions of a duochrome eye test, a chalk-and-sage foreground ramp, and one
measured yellow that is the only lit thing on the page.

### Primary
- **Duochrome Green** (`{colors.ground}`): The page ground, full bleed, every default section.
  This is a drenched field, not a backdrop; it is the saturated green a refraction exam actually
  ends on.
- **Duochrome Green Deep** (`{colors.ground-deep}`): The recessed step. Carries alternating
  sections, the footer, the first comparator field, and sits behind every photograph as its
  matte. It is the only depth mechanism on the page besides the hairline.

### Secondary
- **Oxide Red** (`{colors.red}`): The counter-field. Used at panel scale on the second half of the
  hero comparator, where it holds the position the practice argues against.
- **Oxide Red Deep** (`{colors.red-deep}`): The same lens at page scale, spent on exactly one
  section: the one that answers "Is it going to hurt?". It brings its own foreground ramp with it.

### Tertiary
- **Daisy Amber** (`{colors.amber}`): The lit indicator. Filled field of the call action and the
  mobile call bar, the header phone number, the MARKED lens on the comparator, the live dial stop
  and its pin, the tick dash, the focus ring, and the selection highlight. Nothing else.
  Provenance is the client's own daisy artwork; the shipped value is the canonical one.
- **Daisy Amber Lit** (`{colors.amber-lit}`): Hover state of the amber field only.
- **Daisy Amber Deep** (`{colors.amber-deep}`): The single hairline edge above the mobile call
  bar, separating a lit field from the page.

### Neutral
- **Chalk** (`{colors.chalk}`): Primary text on green. Headings, register names, emphasised
  fragments inside body copy, and the lensmark strokes at half opacity.
- **Sage** (`{colors.sage}`): Body and description text on green, and the credential rules. The
  quieter of the two reading greys.
- **Sage Dim** (`{colors.sage-dim}`): Engraved labels, captions, fine print, the unselected dial
  pin, and footer legal. Never used for anything a visitor must read to decide.
- **Ink** (`{colors.ink}`): The only dark foreground, and it exists solely to sit on amber: the
  call label, the call bar, the aperture strokes inside them, and selected text.
- **Line** / **Line Firm** (`{colors.line}` / `{colors.line-firm}`): The two hairline weights.
  Line divides rows within a set; Line Firm opens and closes a set, bounds the dial, and draws
  every resting border. Both are sage at low alpha, never a flat grey.
- **Red Label / Red Copy / Red Line / Red Line Firm** (`{colors.red-label}`,
  `{colors.red-copy}`, `{colors.red-line}`, `{colors.red-line-firm}`): The complete foreground
  ramp for the red field. Chalk and sage are not reused on red; the counter-field carries its own
  four values so contrast is measured where the text actually lands.
- **Wash / Inset / Seam** (`{colors.wash}`, `{colors.inset}`, `{colors.seam}`): The three
  structural tints. Wash is the ghost button's hover fill, Inset is the disclaimer's recessed
  panel, Seam is the hard join between the two comparator fields.

### Named Rules

**The Lit Indicator Rule.** Amber appears only where something genuinely indicates: the call
action, the marked lens, the live dial stop, the header phone number, the tick dash, the focus
ring. It is never a heading colour, never a decorative underline, never a second brand accent, and
never spent on more than one element in a viewport that is not the call.

**The Two Lenses Rule.** Green and red are the two positions of one instrument, not a palette.
Red is spent on exactly two surfaces (the comparator's second field, and the comfort section) and
must stay that rare. A third ground colour does not exist in this world.

**The Measured Ground Rule.** Every foreground ratio is measured against the ground it actually
lands on, never a lighter variant. On green: chalk 11.46:1, sage 6.90:1, sage-dim 5.60:1, amber
7.88:1. On oxide red: red-label 6.76:1, red-copy 8.44:1. Ink on amber: 10.48:1. A new value ships
only after it is measured the same way, against the real field.

**The Unstained Face Rule.** The red field does not tint its own photograph. Plates inside the red
section keep the green matte, because a red-cast face reads as irritation directly under "Is it
going to hurt?" and fights the copy it illustrates. Only the ground is the second lens.

## Typography

**Display Font:** Archivo (variable, `wdth` 62–125 and `wght` 100–900; self-hosted, latin subset)
**Body Font:** Atkinson Hyperlegible (400/700; self-hosted, latin subset)

**Character:** An engineered grotesk run wide against a legibility face. Archivo's width axis does
the work an italic or a second family would do elsewhere, so headings read as stamped instrument
lettering rather than fashion display. Atkinson Hyperlegible was drawn by the Braille Institute for
readers with impaired vision, which on a page built from an eye exam is the correct object rather
than a decorative association.

### Hierarchy
- **Display** (600, `clamp(2.5rem, 6.1vw, 4.7rem)`, 0.98): Row one of the chart. One per page, the
  hero H1 only.
- **Headline** (600, `clamp(1.9rem, 4.2vw, 3.5rem)`, 0.98): Row two. Every section H2.
- **Title** (600, `clamp(1.45rem, 2.7vw, 2.25rem)`, 1.06): Row three. Sub-headings inside a
  section, and the first dial stop.
- **Nameplate** (700, `clamp(1.85rem, 1.3rem + 2.6vw, 3.15rem)`, 0.96, uppercase, `wdth` 125%):
  The provider's name, set as engraved plate lettering. Also the footer wordmark.
- **Quote** (500, `clamp(1.2rem, 1.05rem + 0.8vw, 1.72rem)`, 1.32, max 24ch): The practitioner's
  own sentences promoted to display scale. Archivo at its narrowest shipped width (108%), which is
  what separates a quoted voice from a heading.
- **Lede** (400, `clamp(1.06rem, 1rem + 0.5vw, 1.32rem)`, 1.55, max 34ch): The single supporting
  line under the display row.
- **Body** (400, `clamp(1rem, 0.97rem + 0.18vw, 1.115rem)`, 1.62, max 68ch): All running copy.
  Register descriptions run to 64ch, captions to 40ch.
- **Label** (600, `clamp(0.72rem, 0.86vw, 0.8rem)`, `0.16em`, uppercase, `wdth` 125%): The
  engraved instrument label. Section markers, the dial legend, and the visit column headings.

### Named Rules

**The Acuity Ramp Rule.** Type sizes come from six fixed rows and nothing between them. Rows one
through three carry the page's headings; rows three through six carry the dial's four stops, which
descend the chart so the control reads as the eye test it came from — largest type on the smallest
intervention. A new size is a new row, decided deliberately, not a value typed inline.

**The Width Axis Rule.** Emphasis is a width change, not a family change. Archivo ships at 108%,
110%, 112%, 114%, 118%, 120% and 125%, and the wider the setting the more it reads as engraved on
the instrument. Italics are not used. A second display face does not exist in this world.

**The Margin Label Rule.** The engraved label never sits above a heading. At 881px and up it lives
in a fixed left-margin track beside the heading; at 880px and below it moves *below* the heading
and takes a rule under itself. There is no width at which it renders as an eyebrow or a kicker.

## Layout

A single 1200px measure with a fluid gutter (`clamp(20px, 4vw, 48px)`), and inside it a two-track
grammar: a fixed label track (`minmax(150px, 190px)`) and a content track, separated by
`clamp(24px, 4vw, 56px)`. Every section head and section body uses those same two tracks, which is
what makes the page scan as a ruled instrument panel rather than a stack of blocks. Sections are
`clamp(56px, 8vw, 110px)` tall in the block direction and are divided by a hairline, never by
whitespace alone.

The hero is asymmetric on purpose: a 1.72fr text column against a 1fr comparator, so the chart row
gets its scale and the instrument sits beside it rather than under it. Below the hero, a
four-cell hairline strip carries the practice's fixed facts (provider, experience, location,
consultation) as a ruled register.

Responsive behaviour is four staged collapses, not one breakpoint:
- **≤1040px:** hero becomes single-column and the comparator caps at 560px; content splits
  linearise; the visit block drops to two columns; the footer top stacks.
- **≤880px:** the two-track grammar collapses to one column and the label reorders below its
  heading; the fact strip halves to 2×2; the dial drops to two stops per row; register rows stop
  being two-column and stack.
- **≤720px:** secondary header link hides, the visit block goes single-column, and a fixed amber
  call bar takes the bottom edge with 76px of body padding reserved for it.
- **≤420px:** the dial goes one stop per row and the credential rules drop their dividers.

Reading measures are enforced, not incidental: lede 34ch, body 68ch, register description 64ch,
quote 24ch, caption 40ch, hero fine print 44ch.

## Elevation & Depth

**There are no shadows in this system.** Not one `box-shadow`, `text-shadow`, `filter: drop-shadow`
or `backdrop-filter` ships on the page, and none may be added. Depth is expressed three ways and
only three ways: stepping the ground darker (`ground` → `ground-deep`, `red` → `red-deep`), a
hairline at one of two weights, and a low-alpha wash on the two elements that need to read as
recessed (the disclaimer's inset panel, the ghost button's hover fill). The comparator's two fields
are joined by a hard black seam rather than a border, which is the one place the page implies a
physical join.

### Named Rules

**The Hairline Rule.** A container is a line, not a box. If an element needs to be set apart, it
gets a rule above it, a rule below it, or a rule down its left edge. It does not get a fill, a
shadow, or a radius large enough to read as a tile.

**The Flat Field Rule.** Every plane is one flat colour. No gradient of any kind ships, including
on text, on overlays, and on the photographic plates, whose tinting is done with blend modes on
solid fields rather than with a ramp.

## Shapes

The form language is squared and ruled. Radius is 2px on the five elements that are filled or
bordered (the call action, the ghost button, the photographic plate, the disclaimer panel, the
named-service chips) and 1px on the focus ring; nothing else is rounded at all. At that size the
corner reads as a machined edge rather than a soft one, which is the point — the page has no
pills, no circles as containers, and no rounded cards.

Recurring geometry is authored inline SVG in the world's own stroke weight, never an icon set:
- **The aperture** (26px, 1.5px stroke, two concentric circles and three radial ticks) rings the
  call action wherever it appears, including the mobile bar.
- **The lens mark** (0.5px non-scaling stroke, four corner brackets plus four edge ticks) frames
  every photographic plate as a registration frame.
- **The tick rail** (a baseline plus a 2px pin per stop) draws the dial's power scale.
- **The marked lens** (20px, a ring plus a filled pupil) flags the comparator's second field.

Photographs are not shapes in this world; they are plates. Each is duotoned into the ground with
`grayscale(1) contrast(1.24) brightness(.42)`, a ground-coloured `mix-blend-mode: color` overlay,
and a `ground-deep` `soft-light` pass at 0.5 opacity, so the image sits *inside* the field instead
of floating on it as a bright rectangle. The device plate goes deeper still
(`contrast(1.16) brightness(.3)`, soft-light at 0.68) because machinery has more specular range
than skin.

## Components

Every component is a register, a field, or a control. Nothing is a card.

### Buttons
- **Shape:** Machined edge (2px radius). No pill, no full round.
- **Primary (the lit dial reading):** Amber field, ink label, Archivo 700 at `wdth` 112%, tabular
  figures, and the authored aperture at its left. Padding is asymmetric
  (`15px 26px 15px 18px`) so the aperture optically centres. This is the page's only filled
  action and it is always the phone number.
- **Hover / Focus:** Field lifts to amber-lit; the aperture rotates 60° over 0.5s
  (`cubic-bezier(.16,1,.3,1)`) only when reduced motion is not requested. Active presses 1px down.
  Focus is a 2px amber ring at 3px offset.
- **Ghost:** Chalk label on a Line Firm hairline border, no fill at rest; hover firms the border to
  chalk and fills with Wash. It carries the booking and virtual-consultation paths, never the call.

### Chips
- **Style:** Sage label on a Line hairline border, 2px radius, `7px 13px`. Used once, for the
  roster of services published by name only.
- **State:** Static. These are not filters and must not be given a selected state.

### Containers
There are no cards. The only bounded boxes in the system are the disclaimer panel (Line Firm
border, Inset fill, 2px radius) and the chips above; both are notices, never page structure.
Content is organised by the register instead.

### Inputs
- **Style:** The only input on the page is the dial's radio group, and it is visually hidden. The
  label is the control: a top rule, a tick SVG, an uppercase stop name, and a sub-line.
- **Focus:** 2px amber ring at 2px offset on the label, driven by `:focus-visible` on the input.
- **State:** Checked turns the top rule amber, the stop name amber, the tick pin amber, and lifts
  the sub-line from sage-dim to sage. Hover lifts the stop name to chalk.

### Navigation
A single hairline-bottomed top rail, 76px minimum (64px under 720px). The wordmark is set in
Archivo 700 at `wdth` 125% with a letterspaced sub-line; the phone number sits at the right in
amber with tabular figures and a transparent 2px underline that fills on hover. The secondary
booking link is sage with a Line Firm underline and hides below 720px, where the fixed call bar
takes over. There is no menu, no dropdown, and no mobile drawer.

### The Duochrome Comparator
The signature component and the page's memorable moment. A chalk top rule opens it; a head states
the question ("Better one, or better two?"); then two stacked fields carry the practice's own two
positions, the first on ground-deep and the second on oxide red, joined by a hard seam. The second
field is flagged with the amber marked-lens SVG and the word MARKED. Each field carries a numbered
label ("One", "Two"), a position title, and a verbatim quotation. It states the thesis before a
word of body copy, and it is the mechanism rather than an illustration of one.

### The Acuity Dial
A radio-driven filter bounded by two Line Firm rules. Four stops sit on a tick rail, their names
descending the acuity ramp from row three to row six, so the largest type marks the smallest
intervention. Selecting a stop filters the register below it via a `data-filter` attribute.
Without JavaScript every row in the register stays visible, which is the honest default; the
control narrows, it never gates.

### The Register
The page's primary content structure, and the reason no cards exist. A Line Firm rule opens the
set; each row is a two-column grid (name track `minmax(190px, 268px)`, description track) with
`20px 0 22px` padding and a Line rule beneath. Inside a half-width column the `reg-stack` variant
drops to a single column with 7px gaps, because two columns of text in half a measure is not a
chart, it is a squeeze.

### The Provider Nameplate
No photograph of the provider exists and none may be substituted, so the practice's only proof
asset is set as an engraved instrument plate: a chalk top rule, a Line Firm bottom rule, the name
at nameplate scale in uppercase, credentials as rule-divided caps, a role paragraph, and one
rule-topped figure line with tabular numerals. It is deliberately not a card, and giving it a fill
or a border box would turn the page's one proof element into the one thing the world refuses.

### Motion
One authored moment and one quieter echo, both gated behind
`@media (prefers-reduced-motion: no-preference)` and an `html.js` class, so all content is visible
by default when scripting is off.
- **The refraction settle** (hero, once): opacity 0→1, `blur(12px)`→0 and `translateY(14px)`→0
  over 0.82s on `cubic-bezier(.16,1,.3,1)`, staggered 0.1s / 0.2s / 0.3s across four elements.
  The hero resolves the way a lens does.
- **The below-fold lift** (everything else): opacity 0→1 and `translateY(18px)`→0 over 0.7s on the
  same curve, 0.09s stagger, triggered by an IntersectionObserver at 8% with a -12% bottom margin,
  unobserved after firing. Deliberately different from the hero and deliberately without blur;
  the authored moment stays singular.
- **State transitions:** 0.18s ease for borders and fills, 0.22s ease for the dial's colour
  changes, 0.5s for the aperture rotation. Nothing else animates.

## Do's and Don'ts

### Do:
- **Do** measure every new foreground against the real ground it lands on, and record the ratio.
  The floor already met on this page is 5.60:1 for the dimmest label and 11.46:1 for primary text.
- **Do** reach for a hairline before reaching for a container. A rule above, below, or to the left
  is how this world separates things.
- **Do** take new type sizes from the six-row acuity ramp, and add a row deliberately if none fits.
- **Do** get emphasis from Archivo's width axis (108–125%) and from scale, not from a new family,
  an italic, or a colour.
- **Do** author new marks as inline SVG in the existing stroke weights (1.5px for the aperture,
  0.5px non-scaling for registration frames, 1px rails with 2px pins).
- **Do** duotone every photograph into the ground with the plate recipe, and frame it with the
  lens mark.
- **Do** keep tabular figures on every number a visitor might compare or dial: phone, years, hours.
- **Do** ship content visible by default and treat motion as an enhancement gated on both
  scripting and `prefers-reduced-motion`.
- **Do** state the medical qualifier wherever treatments are listed: individual results vary, and a
  consultation determines candidacy.

### Don't:
- **Don't** add a shadow of any kind. This system has zero and its depth model does not need one.
- **Don't** add a gradient of any kind, including on text, overlays, or plates.
- **Don't** build a card. Rows, registers and fields only; the disclaimer panel and the chips are
  notices, not a licence for tiles.
- **Don't** put an engraved label above a heading at any breakpoint. Left margin at ≥881px, below
  the heading at ≤880px.
- **Don't** spend amber on anything that is not indicating a state. If it does not mean "this is
  the reading", it is chalk, sage, or sage-dim.
- **Don't** introduce a third ground colour, or reuse chalk and sage on the red field instead of
  its own four-value ramp.
- **Don't** tint a photograph with the red field.
- **Don't** use an icon font, an icon library, an emoji, or a glyph as a mark. Every mark on this
  page is authored geometry.
- **Don't** ship any face other than Archivo and Atkinson Hyperlegible. Explicitly banned: Fraunces,
  Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex,
  Inter, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans, Instrument Serif, and any
  system display face.
- **Don't** use em dashes in visible text, number non-sequential sections, or set a kicker above a
  heading.
- **Don't** invent proof. This practice has zero reviews, ratings, awards, testimonials,
  before/afters, prices, founding year, and no provider photograph. No component may be built that
  displays one, and no placeholder may stand in for one.
- **Don't** ship a dollar figure, imply that the practice prescribes Ozempic, or present Clitoxin
  without the practice's own off-label and results-not-guaranteed language on the same screen.
