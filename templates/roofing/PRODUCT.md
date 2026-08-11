# Product

<!-- impeccable:product-schema 1 -->

<!-- INDUSTRY RECORD — Roofing contractor landing pages (B2C).
     Archetype for the vertical, not a specific client.
     Seed with: node .impeccable/seed-client.mjs roofing demo/<client>
     Then fill the [CLIENT] markers with that business's real facts. -->

## Platform

web

## Stack

Static HTML/CSS generated from this template directory. Optional AI concierge via the shared `serve.js`. Deployed to Cloudflare Pages.

## Users

Homeowners, mostly on phones, in one of two modes:

- **Emergency:** storm damage or an active leak. Water is entering the house right now. This visitor is frightened about structural damage and calls immediately — often several contractors in a row, and the first credible answer wins.
- **Planned:** an aging roof, a pre-sale inspection, or a failed insurance check. Researching, collecting three quotes, reading about materials and warranties, and comparing over days rather than minutes.

A third path runs underneath both: **insurance claims.** Storm-damage work is frequently insurer-funded, and the contractor's ability to navigate a claim is often the actual deciding factor. The page must speak to that without promising claim outcomes.

Vertical economics: roofing is a Tier 1 target ($10K+ per job) in `lead-gen-target-industries.md`.

## Product Purpose

Convert into a call, form submission, or booked inspection. The free inspection is the conversion event for the planned visitor; the phone call is the conversion event for the emergency visitor.

## Positioning

[CLIENT] — the substantiable differentiator. Real candidates: manufacturer certifications carrying an extended warranty (GAF Master Elite, Owens Corning Preferred), in-house crews rather than subcontractors, insurance-claim handling, a workmanship warranty with a stated term, drone inspection. **Only what can be proven.**

## Operating Context

- Demand is storm-driven and arrives in surges. After a hailstorm, an entire metro searches at once and out-of-town "storm chaser" contractors flood the market — which means local legitimacy signals carry unusual weight, and homeowners are actively suspicious.
- High ticket size means the visitor expects financing options and a real warranty conversation.
- Drone and aerial photography are a genuine differentiator in this vertical and photograph dramatically.

## Capabilities and Constraints

- Insurance claim assistance may be described factually but the page must never promise an approval, a payout, or that a deductible will be waived — deductible waiving is illegal in many states.
- Warranty terms, certifications, and license numbers are contractual claims and come from the client only.

## Brand Commitments

[CLIENT] — name, logo, existing colors, and any manufacturer-certification branding rules, which in roofing are strict and often dictate badge placement and minimum size.

## Evidence on Hand

[CLIENT] — before/after project photography shot from matched angles, drone footage, manufacturer certifications, license and insurance documentation, warranty terms, real reviews with source, service area.

**Absences future work must not fabricate:** certifications, warranty lengths, "roofs installed" counts, insurance-approval rates, license numbers, and BBB ratings. Never generate a testimonial or a before/after pair.

## Product Principles

1. **Storm mode and planned mode share one page** — an emergency banner serves the first without hijacking the second.
2. **Local legitimacy beats polish.** In a market full of storm chasers, proof of being local and licensed converts better than a beautiful hero.
3. **Before/after is the argument.** Matched-angle pairs do more work than any headline.
4. **Insurance is described, never promised.**
5. **Every claim is the client's, verified.**

## Accessibility & Inclusion

WCAG AA per `/DESIGN.md`. The emergency visitor is frequently outdoors in bad weather looking at a phone in the rain — daylight contrast and large touch targets are functional requirements.
