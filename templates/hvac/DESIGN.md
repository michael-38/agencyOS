---
name: HVAC — Year-Round Comfort
description: Warm, competent, seasonally adaptive. Deep teal-blue authority with an orange action accent.
extends: /DESIGN.md
colors:
  brand-primary: "#0F4C75"
  brand-primary-light: "#1B6B9E"
  brand-primary-dark: "#0A3452"
  brand-accent: "#FF6B2C"
  brand-accent-light: "#FF8550"
  brand-accent-dark: "#E55A1F"
  brand-accent-glow: "rgba(255, 107, 44, 0.25)"
  brand-accent-bg: "rgba(255, 107, 44, 0.06)"
  season-cool: "#38BDF8"
  season-warm: "#F97316"
  brand-slate: "#475569"
  brand-ice: "#F0F9FF"
  brand-comfort: "#FFF7ED"
---

# Design System: HVAC — Year-Round Comfort

> **EXTENDS `/DESIGN.md`.** Impeccable overrides DESIGN.md whole-file, so read the repo-root
> house floor first — its grid, type scale, button anatomy, motion, performance budget, and
> accessibility floor all bind here. This file states only what HVAC changes or adds.
> Full token tables live in [`hvac-design.md`](hvac-design.md); read it before editing tokens.

**Mode: Persuade.** The visitor decides and acts. Design is the product.

## Overview

**Creative North Star: "Walking into a perfectly climate-controlled home"**

Warm and competent. This world has to hold two opposite seasons in one palette without favoring either, because the same page sells emergency heat in January and emergency cooling in July. The deep teal-blue base is the resolution: cool enough for AC, deep enough to read as authority, neutral enough that the seasonal accents can swing hot or cold on top of it without a redesign.

The orange accent does double duty — it is the action color and it subconsciously reads as warmth and energy. Against the teal-blue it is unmissable, which is the entire point for a visitor who is scanning for a phone number in a house that is too cold.

Professional but not clinical. These people keep your family comfortable, and the page should feel like competence you'd let into your home.

**Key Characteristics:**
- Teal-blue authority base, orange action accent, seasonal swing colors on top
- Emergency-first hierarchy without permanent alarm styling
- Warm and cool alternating section backgrounds instead of flat gray

## Colors

**Primary — Deep teal-blue** (#0F4C75): headers, hero overlay, footer, trust elements. Light #1B6B9E for hover, dark #0A3452 for active and dark sections.

**Accent — Warm orange** (#FF6B2C): primary CTAs, links, highlights. Light #FF8550 hover, dark #E55A1F active. CTA shadow uses `rgba(255,107,44,0.25)`; light accent backgrounds use the 6% tint.

**Seasonal** — `--season-cool` #38BDF8 (summer/AC badges) and `--season-warm` #F97316 (winter/heating badges), each with an 8% background tint for section fills.

**Supporting** — `--brand-slate` #475569 body text, `--brand-ice` #F0F9FF cool alternate sections, `--brand-comfort` #FFF7ED warm alternate sections.

### Named Rules

**The Two-Season Rule.** Neither season may own the base palette. Seasonal color appears only in badges, section tints, and the featured-offer block — never in the header, footer, or CTA. Swapping seasons must be a content change, never a CSS rewrite.

**The Orange Is Only For Action Rule.** Orange means "do this." It does not decorate. If orange appears in a divider, an icon that is not on a CTA, or a section heading, remove it.

## Typography

Inherits the house floor: Inter throughout. HVAC does not swap the display face — the vertical's credibility comes from clarity, not personality.

## Components

Inherits every house-floor component. HVAC-specific additions:

### Seasonal Banner
A dismissible strip above or below the header carrying the current season's message ("No heat? We answer 24/7"). Uses the seasonal tint background with slate text, never the emergency red — HVAC emergencies are urgent but not hazardous, and permanent red desensitizes the visitor.

### Service Cards
Three-mode structure mirroring visitor psychology: Emergency Repair, System Replacement, Maintenance Plan. The emergency card carries the accent border treatment; the maintenance card carries the recurring-value framing.

### Trust Row
License number, manufacturer certifications, response-time guarantee, and review rating in a single row above the fold. Certification logos are supplied assets and must not be recreated or approximated.

## Do's and Don'ts

### Do:
- **Do** keep the phone number in the sticky header at every breakpoint, in orange, at 800 weight.
- **Do** let the page pivot seasonally through content and tint only.
- **Do** show real crew, real trucks, and real installed equipment.
- **Do** carry financing options into the replacement path — this visitor is comparison shopping on total cost.

### Don't:
- **Don't** style routine service as an emergency. Reserve alarm treatment for genuine after-hours/no-heat messaging.
- **Don't** use seasonal color in the header, footer, or any CTA.
- **Don't** imply 24/7 availability, guaranteed response windows, or certifications the client has not confirmed.
- **Don't** use stock imagery of technicians and present it as the client's crew.
