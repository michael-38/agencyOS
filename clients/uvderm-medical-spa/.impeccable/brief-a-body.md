## Scope and visitor mode

`versions/a/index.html`, one long-form landing page. Mode: **Persuade**.

## Audience, job, action

Prospective aesthetic patients in Utah County, mostly women 30-60, who have hit the limit of a
home skincare routine and are shopping *injectors*, not clinics. Action: **book the free
consultation** (Klara link) or **text/call (801) 768-8800** — the practice invites texting
explicitly, and it suits this audience better than a form.

## Proof and content

`fact-sheet.md` only. Load-bearing: Dr. David Myers is a certified **Expert Injector**; Master
Aestheticians led by Mariah Webber; the med spa sits **inside a dermatology practice**; six
verbatim reviews; Best of Utah Valley 2025 and 2026. Every `[CONFIRM]` item omitted — no hours,
no prices, no ratings, no promotion, no second-location phones.

## Chosen direction

**The Compounding Counter** (roll seed `8182871f`, assigned index 3 of 7). Direction page
bypassed on standing user instruction; assignment taken as final, assumptions stated in-thread.

Apothecary precision: the pharmacy counter where a preparation is measured, labelled and made for
one person. Dark counter ground, **amber apothecary glass as the committed colour owning whole
regions**, oxidised brass, bone label ink. Every claim sits on a label, set in condensed
engineered caps with a fine rule, the way a compounded preparation is labelled. Colour strategy
**Committed**. Dark, forced by the use scene: a woman at night, phone in bed, having just looked
at her own skin in a bathroom mirror.

Refuses the category rut on both sides: not the blush/nude soft-focus med spa page, not the
white-chrome clinical minimalism.

**Memorable moment:** the treatment list read as a shelf of labelled preparations rather than a
services grid.

## Ingredient inventory (medium gate)

No image generation exists here, so `visualize.md`'s comp round cannot run and no approval is
recorded. The medium gate still binds.

| Region | Medium | Source |
|---|---|---|
| Counter ground | CSS flat field | dark graphite; no gradient, no texture image |
| Amber region | CSS flat field | committed colour owning a whole band, not an accent |
| Dr. Myers portrait | raster photograph | `images/HTP_8021-scaled-e1749761199128.jpg` |
| Aesthetician portraits | raster photographs | Mariah Webber, Grace Barney |
| Treatment shots | raster photographs | Morpheus8, microneedling |
| **Primary CTA (own row)** | CSS + authored SVG | a label plate, brass-ruled, carrying `tel:` and the Klara link; the world labels every prepared thing, so the CTA is labelled too |
| **TYPE** | self-hosted woff2 | display **Big Shoulders Display** (condensed engineered caps, apothecary label register); text **Chivo**. Neither is on the banned-defaults list. |
| Label rules | authored SVG/CSS 1px | one consistent hairline weight |
| Icons | authored SVG single stroke | phone and message only; no emoji, no glyph stand-ins |

**Accepted omissions the user is told about:** no photography of the room, counter, products or
packaging exists in `assets/`, so the apothecary world is carried by type, colour and placement
rather than by a literal counter image. No before/after imagery is published by this practice.

## Constraints

Single self-contained `index.html`, inline `<style>`, no build step, no external origins,
self-hosted fonts. WCAG AA. `prefers-reduced-motion`. Reviews verbatim including the patients'
own spelling. No hours, prices, ratings or promotion anywhere.

## Unresolved decisions

- Whether the med spa serves all three locations or Lehi only — copy currently says Lehi.
- Exact issuer and wording of the Best of Utah Valley award.
