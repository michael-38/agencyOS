---
name: Med Spa — Editorial Clinical
description: A high-fashion magazine spread crossed with a peer-reviewed paper. Warm cream, terracotta italics, zero gradients.
extends: /DESIGN.md (with documented overrides — see Overrides section)
colors:
  bg: "#f4e8e0"
  bg-2: "#ece0d5"
  paper: "#faf2ea"
  ink: "#1a1412"
  ink-2: "#3a2d26"
  muted: "#7a675a"
  line: "#d9c7b7"
  accent: "#b8644a"
  accent-deep: "#8f4a34"
  accent-soft: "#e6b8a3"
  tone-a: "#e8c9b3"
  tone-b: "#c98f73"
  tone-c: "#8a5640"
  tone-d: "#f0d8c4"
---

# Design System: Med Spa — Editorial Clinical

> **EXTENDS `/DESIGN.md`, AND DELIBERATELY BREAKS FROM IT.** This is the one world in the
> repo that overturns house-floor rules on purpose. Read the house floor first for the
> grid, motion, performance budget, and accessibility floor — those still bind. Then read
> the **Overrides** section below, which is authoritative where the two conflict.
> Full token tables live in [`med-spa-design.md`](med-spa-design.md).

**Mode: Persuade.** But note the audience: this surface pitches **med spa owners**, not patients. See `PRODUCT.md` in this directory.

## Overview

**Creative North Star: "A high-fashion magazine spread crossed with a peer-reviewed paper"**

Editorial, evidence-based, restrained, luxe-but-clinical, quietly confident. Whitespace, italic serif accents, monospace metadata. Zero gradients and zero stock-photo "happy doctor" energy.

The strategic reason this world exists is unusual and worth stating plainly: a med spa owner who lands here must immediately feel *"this is the design language my clinic wants."* They are not buying a website — they are buying the perception their clinic projects. So the page has to model that perception rather than describe it. Craft is the argument, which means the ordinary trustworthy-utility register of the other three verticals would actively lose the sale.

Cream signals spa, skin, and warmth without going pink, which reads cheap and dated. Terracotta is the accent because it is distinctive, earthy, photographs well, and does not compete with the medical and aesthetic photography a med spa lives and dies by. Deep ink instead of pure black — softer, more premium, less screen glare.

**Key Characteristics:**
- Warm cream ground, terracotta accent, deep ink instead of black
- Italic Fraunces *is* the brand voice — the emotional beat inside a clinical sentence
- Monospace metadata as an editorial device
- No gradients anywhere, and no shadows in the house-floor sense

## Overrides

These supersede `/DESIGN.md` on this surface only:

| House floor rule | Override here | Why |
|---|---|---|
| **The No Italics Rule** | Overturned for accents. Italic Fraunces carries emphasis and emotional beats. Body copy stays roman. | Documented brand voice in `med-spa-copy.md` — the italic is the register. |
| **Inter display face** | Fraunces (variable, optical-size + SOFT axes) for display; Inter Tight for body. | Fraunces' high-contrast cuts create the magazine-cut feel; Inter Tight pairs better with it than Inter. |
| **Boldest thing is the phone number** | No. The CTA is a booked 30-minute call, not a phone tap. | B2B pitch surface, not an emergency B2C page. |
| **Floating mobile CTA bar / click-to-call triad** | Not applicable. | Same reason. |
| **Shadow vocabulary** | Effectively unused. Depth comes from tonal layering (`--bg` / `--bg-2` / `--paper`) and hairline `--line` rules. | Shadows read as web-app chrome and break the print illusion. |
| **Neutral gray ramp** | Replaced entirely by the warm cream/ink ramp. | The grays are cold and fight the cream ground. |

Everything not listed — the 8px grid, 1200px container, reduced-motion handling, image budgets, WCAG AA, the ban on fabricated proof — still binds.

## Colors

**Ground** — `--bg` #f4e8e0 warm cream page background, `--bg-2` #ece0d5 alternate sections, `--paper` #faf2ea card and inset surfaces.

**Ink** — `--ink` #1a1412 primary text, dark CTAs, footer; `--ink-2` #3a2d26 secondary text; `--muted` #7a675a eyebrows, captions, monospace metadata; `--line` #d9c7b7 borders and dividers.

**Accent — Terracotta** `--accent` #b8644a for italic emphasis, italic numerals, and link hover; `--accent-deep` #8f4a34 hover; `--accent-soft` #e6b8a3 on dark backgrounds (testimonials, footer).

**Tonal ramp** for gradient-free placeholders: `--tone-a` #e8c9b3, `--tone-b` #c98f73, `--tone-c` #8a5640, `--tone-d` #f0d8c4.

### Named Rules

**The Zero Gradient Rule.** No gradients anywhere. Tonal placeholders use flat steps from the tone ramp. A gradient in this world instantly reads as generic SaaS and destroys the print illusion.

**The Terracotta Is Emphasis, Not Furniture Rule.** Terracotta appears in italic emphasis, italic numerals, and hover states. It does not fill blocks, tint sections, or outline cards.

**The Contrast Verification Rule.** This is the lowest-contrast palette in the repo. Every text/background pair gets measured against 4.5:1, never assumed. `--muted` #7a675a on `--bg` #f4e8e0 is the pair most likely to fail — check it before shipping any surface that uses it for anything other than large text.

## Typography

**Display Font:** Fraunces (variable — optical size and SOFT axes in use)
**Body Font:** Inter Tight
**Metadata:** monospace, in `--muted`, uppercase, letterspaced

**Character:** Fraunces is the heart of the design; its variable optical-size and SOFT axes give headlines a warm, magazine-cut feel. Italic Fraunces *is* the brand voice. Inter Tight is slightly tighter than Inter and sits better against Fraunces' high-contrast cuts.

Type is fluid and clamp-based rather than the house floor's fixed desktop/mobile pairs — see `med-spa-design.md` for the scale.

### Named Rules

**The Italic Lands The Meaning Rule.** Magazine syntax: short, declarative, a pause — then a longer italic-tinted line that lands the meaning. The italic is where the sentence becomes human. Used everywhere, it becomes wallpaper; used once per section, it is the voice.

## Layout

Inherits the 8px grid and 1200px container. Density is markedly lower than the other three worlds — whitespace is the primary luxury signal, and compressing it to fit more content is the fastest way to make this world look cheap.

## Components

Documented in full in [`med-spa-design.md`](med-spa-design.md): hero, marquee, capability grid, featured comparison slider, case study cards, approach steps, booking calendar widget, FAQ accordion, footer.

## Do's and Don'ts

### Do:
- **Do** treat whitespace as the luxury signal and resist compressing it.
- **Do** use italic Fraunces once per section as the emotional beat.
- **Do** use flat tonal steps where a placeholder or fill is needed.
- **Do** measure every text/background pair against 4.5:1.
- **Do** present revenue math as modeled, with stated assumptions.

### Don't:
- **Don't** use gradients. Anywhere.
- **Don't** use pink — it reads cheap and dated in this vertical.
- **Don't** use stock or AI-generated "happy doctor / smiling patient" imagery. This is the exact register the world is defined against.
- **Don't** use exclamation points or agency-hype copy — the voice is quiet confidence.
- **Don't** import the house floor's gray ramp or shadow vocabulary.
- **Don't** claim named med spa clients, case studies, or owner testimonials — none exist.
