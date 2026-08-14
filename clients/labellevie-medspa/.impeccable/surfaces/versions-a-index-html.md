---
version: 1
slug: "versions-a-index-html"
primary_target: "versions/a/index.html"
related_targets: []
---

# Surface brief — versions/a/index.html

## Scope and mode

Single self-contained landing page for La Belle Vie Medical Care & Aesthetics (Draper, Utah).
**Mode: Persuade.** This is Version A of two independent builds; Version B is a separate world and
must not converge with this one. Assigned divergence constraints (brief-pinned, beat the roll):
ground **dark**, display face class **wide-engineered-grotesk**, colour strategy **Drenched**.

## Audience, job, action

**Audience.** A prospective patient near Draper, Utah, most often a woman 35–60, reading at night on
a phone after closing Instagram. Four arrival states: curious-but-hesitant (best evidenced), specific
researcher, weight-loss seeker already medicated elsewhere, and someone with a private concern.

**Her job.** Decide whether walking into this med spa will leave her looking like herself. Her named
fears, in the practice's own words: looking "plastic" / "overfilled", and the "conveyor belt" feel of
chains.

**The action.** One ask: a **free consultation**. Primary path `tel:8019878384`. Secondary: Podium
booking (new appointments) and the free virtual consultation via the contact page. Boulevard is
named separately as the existing-patient portal, never merged with Podium.

## Proof and content

This page has **no conventional proof to spend**: zero reviews, ratings, awards, testimonials,
before/afters, prices, founding year, and no provider photograph. Nothing on that list may be
invented or placeheld in a way that reads as real. Proof currency, in order:

1. **Kelly Lance, MSN, APRN, FNP-C** — owner, sole named provider, 30+ years, first-person voice.
2. **Her own published writing** — the strongest asset; long verbatim passages carry whole sections.
3. **The named device and treatment roster** — Harmony®XL, Profound by Syneron, Sculptra®, Renuva,
   CoolSculpting, Hair-Free™, Clitoxin®, PDO threads. Specificity substitutes for social proof.
4. **The free consultation**, stated on nearly every source page.

## Constraints

- **No dollar figures ship.** The source contradicts itself ($50 vs $100 for the same offer). This
  also disqualifies `AUG2026-Specials-Main.jpg` and `AUG2026-Specials-email.jpg`, whose offers and
  prices are baked into the pixels; the August promotion is therefore omitted entirely rather than
  re-typeset without its expiry.
- **Never imply GLP-1 prescribing.** "At La Belle Vie, we don't prescribe Ozempic" is stated twice
  and is the most credible sentence on the site. It ships as copy.
- **Clitoxin is explicitly off-label** botulinum toxin and ships with the practice's own disclaimer
  ("results are not guaranteed with this therapy") on the same screen. Intimate services use plain
  clinical names, source-derived benefit language, no euphemism, no innuendo, no suggestive imagery,
  and are not quarantined into a separate zone.
- **Risk-register phrases omitted or softened, never footnoted and kept:** "pain-free",
  "permanently eliminate hair", "these little miracles", "boost your self-esteem immediately",
  "we can fix it", "easily reach your target weight", "safe results", "permanently padding".
- Every `[CONFIRM]` item is absent from the page. Five days of hours render; no "Closed" weekend rows.
- Their typos are fixed silently (Jeuveau, CO2, "It's called Renuva"); none reproduced.
- Five Shutterstock-EXIF assets are excluded from the build entirely.
- **AgencyOS floor:** no eyebrows/kickers above headings, no em dashes in visible text, no section
  numbers on non-sequential content, no cards as page structure, no gradient text, no generated or
  stock imagery beyond the client's own 26 permitted files.

## Chosen direction

**The ophthalmic refraction instrument.** Seed key `8677423a`, assigned index 4 of my ordered
grounded list, `--scope direction --mode persuade`.

The refraction exam is the one medical ritual in which the patient is in charge of every increment:
*"Better one, or better two?"* Nothing is decided for you, every step is small, and it stops when it
is right. That is exactly this practice's positioning ("Artistic Restoration", "your face on its very
best day", "we don't just sell packages") answered with a ritual the visitor has already been through.

The page is drenched in the **green half of the duochrome test** — the saturated field a refraction
exam actually ends on — with the **red half** as the opposing panel and the client's own measured
brand yellow (#FBCF02 sampled from their daisy artwork) as the lit indicator on the phoropter dial.
Type is set on a **Snellen acuity progression**: one enormous top row stepping down in fixed ratios,
each row carrying a marginal engraved label.

## Memorable moment

The **duochrome panel** in the first viewport: a two-field green/red comparator carrying the
practice's own two positions, "the overfilled look" against "your face on its very best day", with
the second one lens-marked in amber. It states the thesis before a single word of body copy, and it
is the mechanism, not a decoration.

Second moment: the **degree-of-intervention scale**, which orders the real treatment roster from the
smallest increments (Lip Flip, Baby Botox, a light peel) to the deepest (CO2, Profound, PDO threads)
along a phoropter power rail. It makes restraint a readable quantity, which is the only honest answer
to the fear of being overdone, and it does it with named devices instead of testimonials.

## Medium-gate ingredient inventory

The gate: medium is decided by what the region *shows*, never by what is convenient in the stack.
No image generation exists on this run, so anything image-native must be sourced from the client's
own 26 permitted files or omitted outright. Nothing is faked in CSS.

| # | Ingredient | Medium | Note |
|---|---|---|---|
| 1 | Drenched duochrome-green ground | CSS (flat field) | Colour, not texture. No gradient. |
| 2 | Duochrome red counter-field | CSS (flat field) | Second half of the comparator. |
| 3 | Snellen acuity type ramp | HTML/CSS, Archivo `wdth`+`wght` axes | Variable-axis width is the mechanism. |
| 4 | Phoropter lens rings / aperture marks | **Authored inline SVG** | Countable geometry, exactly specifiable. Not raster. |
| 5 | Power-scale rail + tick marks | **Authored inline SVG** | Diagram with countable elements. |
| 6 | Engraved instrument panel labels | HTML/CSS letterspaced caps | Archivo at expanded width. |
| 7 | Laser device photograph | **Sourced raster** — `Skin-Health-is-Health-Draper.jpg`, hard-cropped to the device, border scaled out | Machinery with lighting and depth. Raster by the gate; a CSS approximation would be deletion. |
| 8 | Skin / face treatment imagery | **Sourced raster** — `pdo-threads-facelift-in-utah`, `SkinRejuvenation-head`, `The-Era-of-the-Refresh-Not-the-Redo` | All hard-cropped past the baked-in marketing text. Duotoned into the world (`grayscale` + `brightness(.42)`, ground colour-blend, amber overlay), supporting positions only. `HandRejuvenation-LaBelleVie` was a candidate and did not ship: no section needed it, and four plates is the right count for the page's rhythm. |
| 9 | Provider portrait | **Accepted omission** | None exists; no stock substitute. Replaced by a typographic instrument nameplate, which is a design decision rather than an empty slot. |
| 10 | Logo / wordmark file | **Accepted omission** | Not harvested. Name set in type per the fact sheet's instruction. |
| 11 | Before/after gallery | **Accepted omission** | None exist. No component built. |
| 12 | Reviews / ratings / awards | **Accepted omission** | None exist. No component built, no placeholder. |
| 13 | August specials artwork | **Accepted omission** | Dollar figures baked into pixels; barred by the no-price constraint. |
| 14 | **Primary action (call)** | **Amber lit-indicator treatment** — filled amber field, ink label, tabular figures, phoropter aperture ring in SVG around it | Its own row per the gate. The lit dial reading is signature material on the page's most important element, not a border trick. |
| 15 | Motion | CSS transitions + one IntersectionObserver reveal | The lens-drop settle, orchestrated once, not scattered hovers. Fully disabled under `prefers-reduced-motion`. |

## Unresolved decisions

- Brand palette and hex values are **[CONFIRM]** with the client; the amber shipped here is sampled
  from their own artwork, not supplied by them.
- The first-treatment discount amount is unresolved in the source and ships as no figure at all.
- Team size beyond Kelly Lance is unresolved; the page centres her by name rather than using the
  source's unsubstantiated plural.
- Vocabulary: this version holds **"patient"** throughout (the source mixes "client" and "patient").
