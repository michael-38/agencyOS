---
name: Utah Aesthetic Surgery — Editorial Clinical (client build)
description: The med-spa editorial world with the practice's own accent and muted tokens. Patient-facing.
extends: templates/med-spa/DESIGN.md, which extends /DESIGN.md
colors:
  bg: "#f4e8e0"
  bg-2: "#ece0d5"
  paper: "#faf2ea"
  ink: "#1a1412"
  ink-2: "#3a2d26"
  muted: "#6a5043"
  line: "#d9c7b7"
  accent: "#a04e36"
  accent-deep: "#8f4a34"
  accent-soft: "#e6b8a3"
  tone-a: "#e8c9b3"
  tone-b: "#c98f73"
  tone-c: "#8a5640"
  tone-d: "#f0d8c4"
---

# Design System: Utah Aesthetic Surgery

> **Inherits the world in [`templates/med-spa/DESIGN.md`](../../templates/med-spa/DESIGN.md)**, which in
> turn extends the house floor at [`/DESIGN.md`](../../DESIGN.md). Read both. Impeccable resolves
> context two levels only and overrides whole-file, so this file cannot inherit them
> mechanically — the directive is the mechanism. This file records only what is
> **different from the med-spa world**, and the audience difference that changes how it is applied.
>
> Tokens below were extracted from the shipped `index.html`, not invented.

**Mode: Persuade.** Audience is **patients**, not owners — this is the one place this build departs from the med-spa template's framing. See `PRODUCT.md` in this directory.

## Deltas from the med-spa world

Two token overrides, both already live in `index.html`:

| Token | Med-spa world | This client | Effect |
|---|---|---|---|
| `--accent` | `#b8644a` | **`#a04e36`** | Deeper, less orange terracotta. Reads more clinical and slightly more serious — appropriate for surgery rather than aesthetics. |
| `--muted` | `#7a675a` | **`#6a5043`** | Darker muted tone. **This is a contrast improvement** — worth keeping, and worth considering as a fix upstream in the med-spa world. |

Everything else — `--bg` #f4e8e0, `--bg-2` #ece0d5, `--paper` #faf2ea, `--ink` #1a1412, `--ink-2` #3a2d26, `--line` #d9c7b7, `--accent-deep` #8f4a34, `--accent-soft` #e6b8a3, and the full tone ramp — matches the med-spa world exactly.

## Typography

Unchanged from the med-spa world, and confirmed in the shipped page:
- **Fraunces** variable, `ital,opsz,wght@0,9..144,400;1,9..144,400` — display, with italic as the voice
- **Inter Tight** `wght@400;500` — body
- Monospace for metadata

## What the audience change means

The med-spa world was authored for a **B2B pitch page** where craft itself is the sales argument. Here the same visual language serves a **patient** making an expensive, irreversible, private decision. The world carries over intact, but three emphases shift:

1. **Credentials outrank craft.** "Double board-certified" and the named surgeon are the conversion drivers. The editorial restraint should frame them, never upstage them.
2. **Price transparency is a feature.** Published "starting from" figures belong in the visual hierarchy, not in fine print — that is what the anxious researcher came for.
3. **The italic device stays, but calms down.** Terracotta italic still lands the emotional beat, but a surgical page should not read as a fashion spread. One beat per section, and never inside a price, a credential, or a safety statement.

## Do's and Don'ts

Inherits every med-spa rule — no gradients, no pink, no stock "happy doctor" imagery, whitespace as the luxury signal. Additionally:

### Do:
- **Do** keep `--muted` at `#6a5043` — it is the more accessible value.
- **Do** verify every text/background pair against 4.5:1. This palette is the repo's most likely to fail, and this build carries the most regulated content.
- **Do** route every candidacy, safety, or "is this right for me" affordance to the free consultation.
- **Do** present published prices as "starting from", always.
- **Do** keep `(801) 810-0761` and the request form reachable from any scroll position.

### Don't:
- **Don't** let a visual treatment imply a specific outcome, result, or guarantee.
- **Don't** add, crop, retouch, or reuse before/after or patient imagery without written confirmation that consent covers that use.
- **Don't** set a price, credential, or safety statement in italic — the device is for emotional beats, and these must read as literal.
- **Don't** invent testimonials, ratings, review counts, or outcome statistics. This is a regulated medical vertical.
