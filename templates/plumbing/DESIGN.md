---
name: Plumbing — Authority & Go
description: Deep blue authority with a deliberate green action accent. Red reserved exclusively for genuine emergencies.
extends: /DESIGN.md
colors:
  brand-primary: "#1A365D"
  brand-primary-light: "#2B4C7E"
  brand-primary-dark: "#0F2440"
  brand-accent: "#16A34A"
  brand-accent-light: "#22C55E"
  brand-accent-dark: "#15803D"
  brand-accent-glow: "rgba(22, 163, 74, 0.25)"
  brand-accent-bg: "rgba(22, 163, 74, 0.06)"
  brand-emergency: "#DC2626"
  brand-emergency-dark: "#B91C1C"
  brand-emergency-bg: "#FEF2F2"
  brand-slate: "#475569"
  brand-clean: "#F8FAFC"
  brand-trust: "#EFF6FF"
---

# Design System: Plumbing — Authority & Go

> **EXTENDS `/DESIGN.md`.** Impeccable overrides DESIGN.md whole-file, so read the repo-root
> house floor first — grid, type scale, button anatomy, motion, performance budget, and the
> accessibility floor all bind here. This file states only what plumbing changes or adds.
> Full token tables live in [`plumbing-design.md`](plumbing-design.md).

**Mode: Persuade**, at the highest urgency of any AgencyOS vertical.

## Overview

**Creative North Star: "The licensed professional who answers on the first ring"**

Plumbing carries a reputational headwind no other vertical here does — the homeowner arrives already braced to be upsold. So this world is built to look institutional rather than promotional. Deep authoritative blue does the work: it reads licensed, established, and accountable, and it directly counters the shady-plumber stereotype the visitor brought with them.

The green accent is the deliberate departure. Most plumbing sites use blue or red for action; green means *go*, signals safety and honesty, and — critically — leaves red completely unused for anything routine. That is the strategic payoff: because nothing else on the page is red, the emergency elements carry genuine urgency instead of the permanent low-grade alarm that makes competitor sites read as desperate.

Clean, cool alternate backgrounds reinforce the hygiene association without going clinical.

**Key Characteristics:**
- Blue authority, green action, red held in reserve
- Fastest time-to-phone-number of any template here
- Pricing transparency treated as a primary trust component, not fine print

## Colors

**Primary — Deep blue** (#1A365D): headers, hero overlay, footer, trust elements. #2B4C7E hover, #0F2440 active and dark sections.

**Accent — Green** (#16A34A): primary CTAs, links, highlights. #22C55E hover, #15803D active. CTA glow `rgba(22,163,74,0.25)`; 6% tint for accent backgrounds.

**Emergency — Red** (#DC2626, dark #B91C1C, background #FEF2F2): the emergency banner and genuinely urgent CTAs. Nothing else, ever.

**Supporting** — `--brand-slate` #475569 body, `--brand-clean` #F8FAFC cool alternate sections, `--brand-trust` #EFF6FF the pricing/trust section background.

### Named Rules

**The Red Reserve Rule.** Red appears only on the emergency banner and genuinely urgent CTAs. Every routine element that reaches for red must be denied. The scarcity is the entire mechanism — it is why the emergency treatment still works on a visitor who has seen four competitor sites shouting in red.

**The Green Means Go Rule.** Green is the conversion color and carries no other job. It does not appear in icons, dividers, or headings.

## Typography

Inherits the house floor: Inter throughout. The phone number is the heaviest object on the page at 800 weight with tabular numerals — enforced here more strictly than anywhere else, because this visitor is scanning, not reading.

## Components

Inherits every house-floor component. Plumbing-specific:

### Emergency Banner
Full-width, `--brand-emergency` #DC2626 to #B91C1C, white text, phone CTA. Scoped to genuine emergency messaging. This is the only red object permitted above the fold.

### Pricing Transparency Block
A trust component, not fine print. Sits on `--brand-trust` #EFF6FF and states the pricing policy plainly — flat-rate, quoted before work begins, no overtime charge — in whatever form the client can actually commit to. This block converts in this vertical specifically because the stereotype primed the visitor to look for it.

### Thumb Zone CTA Bar
The house floor's 56px floating mobile bar, with plumbing's constraint made explicit: the call action sits in the natural one-handed thumb arc — bottom center to bottom right — because this visitor is frequently holding the phone in one hand and a towel, bucket, or shutoff valve in the other.

### Trust Row
License number, insurance, background-check policy, and rating above the fold.

## Do's and Don'ts

### Do:
- **Do** put a `tel:` link in the sticky header, the hero, and the floating mobile bar. Three taps available at all times, zero scrolling required.
- **Do** state the pricing policy prominently and in plain language.
- **Do** lead with the license number — it is the fastest legitimacy signal in this vertical.
- **Do** keep the emergency path to one tap from the first viewport.

### Don't:
- **Don't** use red for anything routine. This is the load-bearing rule of the whole world.
- **Don't** claim 24/7 availability unless a human genuinely answers 24/7.
- **Don't** state flat-rate or no-overtime pricing the client has not committed to.
- **Don't** bury the phone number below a hero image, a form, or a cookie banner.
- **Don't** use green for decoration.
