---
name: Roofing — Stability & Protection
description: Navy authority with a burnt-orange action accent. Built to hold storm urgency and planned research on one page.
extends: /DESIGN.md
colors:
  brand-primary: "#1E3A5F"
  brand-primary-light: "#2A4F7F"
  brand-primary-dark: "#142841"
  brand-accent: "#E8552D"
  brand-accent-light: "#F06840"
  brand-accent-dark: "#C74422"
  brand-accent-glow: "rgba(232, 85, 45, 0.25)"
  brand-accent-bg: "rgba(232, 85, 45, 0.06)"
  brand-slate: "#475569"
  brand-warm-gray: "#F8F6F4"
  brand-storm: "#334155"
---

# Design System: Roofing — Stability & Protection

> **EXTENDS `/DESIGN.md`.** Impeccable overrides DESIGN.md whole-file, so read the repo-root
> house floor first — grid, type scale, button anatomy, motion, performance budget, and the
> accessibility floor all bind here. This file states only what roofing changes or adds.
> Full token tables live in [`roofing-design.md`](roofing-design.md).

**Mode: Persuade.** The visitor decides and acts.

## Overview

**Creative North Star: "The thing between your family and the sky"**

Roofing sells protection, so the world is built on stability. Deep navy is the base because it reads as solid, permanent, and institutional — the visual opposite of the out-of-town storm chaser who knocked on the door yesterday. Burnt orange carries every action: attention-grabbing without being aggressive, and high-contrast against navy so the CTA is never ambiguous.

The page must hold two temperaments simultaneously. A homeowner with water coming through the ceiling needs a phone number in the first half-second. A homeowner three weeks into researching materials needs warranty terms, matched before/after evidence, and a financing path. The storm banner resolves this: urgency lives in one dismissible, clearly-scoped element so the rest of the page can be patient.

Warm gray rather than cool gray for alternate sections — roofing is a residential, domestic purchase, and cool gray reads corporate.

**Key Characteristics:**
- Navy permanence, burnt-orange action, warm-gray domestic alternates
- Storm urgency isolated to one scoped banner
- Before/after evidence treated as primary content, not gallery filler

## Colors

**Primary — Navy** (#1E3A5F): headers, hero overlay, footer, trust elements. #2A4F7F hover, #142841 active and dark sections.

**Accent — Burnt orange** (#E8552D): primary CTAs, links, highlights. #F06840 hover, #C74422 active. CTA glow `rgba(232,85,45,0.25)`; 6% tint for accent section backgrounds.

**Supporting** — `--brand-slate` #475569 body text, `--brand-warm-gray` #F8F6F4 alternate sections, `--brand-storm` #334155 storm-banner background.

### Named Rules

**The Storm Banner Is The Only Alarm Rule.** Urgency is confined to the storm banner. The rest of the page stays calm and evidential. A page that is uniformly urgent reads as a scam to a homeowner already braced for one.

**The Navy Holds, Orange Acts Rule.** Navy is structure — never a CTA. Orange is action — never structure.

## Typography

Inherits the house floor: Inter throughout, sentence case, phone number heaviest.

## Components

Inherits every house-floor component. Roofing-specific:

### Storm / Emergency Banner
Full-width strip on `--brand-storm` #334155 with white text and an orange CTA. Dismissible, and scoped strictly to genuine storm or active-leak messaging. Never permanently on.

### Before/After Slider
The signature component. Matched-angle pairs with a draggable divider, consistent lighting between frames, and enough context to show the whole roof rather than a shingle close-up. Keyboard-operable and touch-draggable; falls back to stacked images without JS.

### Trust Badges
Manufacturer certifications, license, insurance, and BBB in a row above the fold. These are supplied assets — render them at the manufacturer's required minimum size and never redraw or recolor them.

### Drone / Aerial Hero
Preferred hero treatment where the client has the footage. Dark overlay at 50% for text legibility per the house floor.

## Do's and Don'ts

### Do:
- **Do** lead with local legitimacy — license, years in the area, local address.
- **Do** shoot and present before/after from matched angles with consistent lighting.
- **Do** state warranty terms and certifications exactly as the client documents them.
- **Do** give the planned-mode visitor a financing path and a free-inspection CTA.

### Don't:
- **Don't** promise an insurance approval, a payout, or a waived deductible — the last is illegal in many states.
- **Don't** leave the storm banner permanently enabled.
- **Don't** use orange for anything structural, or navy for a CTA.
- **Don't** fabricate a before/after pair, a certification, or a job count.
