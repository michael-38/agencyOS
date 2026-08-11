# Product

<!-- impeccable:product-schema 1 -->

<!-- SCOPE GUARD — read before using this file.
     This record describes AgencyOS / Hyperworkflow: the agency itself, and its own
     marketing site at hyperworkflow.ai. It is the repo-root fallback, so a project
     with no PRODUCT.md of its own will inherit it.

     If you are designing a CLIENT landing page or an INDUSTRY template and you are
     reading this by fallback, that is the wrong context. Stop and use:
       templates/<industry>/PRODUCT.md   — the industry record
       demo/<client>/PRODUCT.md          — seeded from the industry, then client-specific
     Seed a new client with: node .impeccable/seed-client.mjs <industry> <client-dir>
-->

## Platform

web

## Stack

Existing codebase. Hyperworkflow.ai is hand-authored static HTML/CSS deployed to Cloudflare Pages (`hyperworkflow/`, with `functions/` for Pages Functions). Client landing pages are static HTML/CSS generated from `templates/<industry>/`. The AI concierge runs on a shared `serve.js` with per-client `concierge.json` + `concierge-prompt.md`. The voice agent is a separate Next.js + Vapi + Supabase app under `demo/voice-agent/`.

## Users

Two distinct audiences, and design work must never blend them:

- **Hyperworkflow.ai visitors (this record's surface):** operators and owners at businesses that have a real, repeatable, expert-dependent workflow they want automated. They arrive skeptical of AI vendors, having seen demos that do not survive contact with their actual process. Their job is to judge whether a two-week engagement is worth the risk of their domain experts' time. Copy is deliberately **audience-neutral** — not vertical-specific — because the sprint is the product, not the vertical.
- **Client end-customers (NOT this record):** homeowners and patients landing on a client's page. They are covered by `templates/<industry>/PRODUCT.md`.

## Product Purpose

AgencyOS runs a lead-generation and AI-automation agency for local service businesses, executing one pipeline end to end: **prospect → audit → refresh/build → configure concierge/voice → deploy → hand off.**

Hyperworkflow.ai exists to convert a skeptical operator into a booked call for **Agentic Implementation** — the flagship two-week sprint. Success on that surface is a booked call, not a purchase.

## Positioning

**Agentic Implementation: a two-week sprint that pairs us with the client's domain experts.** The differentiating mechanism is stated on the live site: *"We shadow the real work, build a working AI agent alongside the people who do it, and ship on day 10."*

What a neighboring agency cannot truthfully copy is the shape of the engagement — co-building with the client's own experts against the real workflow, on a fixed two-week clock with a shipping date, rather than delivering a demo or a strategy deck. The proof is the day-10 ship, and the site's job is to make that clock credible.

## Operating Context

- Prospecting runs from `lead-gen-target-industries.md` — 20 ranked verticals in three tiers by job value. The four with built templates are med spa / aesthetic surgery, HVAC, roofing, and plumbing.
- Audits run through the `audit/` CLI: nine modules (Lighthouse, SEO, LLM copy/AEO, discoverability, conversion, design, UX) producing a shareable HTML dashboard used as the outreach artifact.
- Site rebuilds run through `cli/` (SiteRefresh): scrape the incumbent site, rewrite copy with Claude, generate a modern page — which also produces the before/after used in pitches.
- Deploys target Cloudflare Pages.
- `demo/utah-aesthetic-surgery/` is a real reference build and the closest thing to a worked example of the full pipeline.

## Capabilities and Constraints

- Four industry templates exist today; the playbook names sixteen more verticals with no template built.
- Every visual decision resolves against `/DESIGN.md` (house floor) and the active `templates/<industry>/DESIGN.md`.
- Outward-facing and destructive actions — sending outreach, deploying to a live client domain, deleting client data — require explicit confirmation before execution.
- **Pricing is deliberately kept off-page** on hyperworkflow.ai. The single CTA is *book a free call*. Do not add pricing, tiers, or a quote calculator to that surface without an explicit decision to reverse this.

## Brand Commitments

- Name: **Hyperworkflow** (hyperworkflow.ai) for the agency's outward brand; AgencyOS is the internal operating system.
- Positioning line in use: *"Real workflows, automated in two weeks."*
- Voice: concrete and evidence-led. Claims carry numbers — Lighthouse scores, audit findings, screenshots — not adjectives.
- Audience-neutral copy on hyperworkflow.ai is a standing constraint, not an accident of drafting.

## Evidence on Hand

- Live site copy and structure in `hyperworkflow/index.html`, including the hero figure that shows the before/after workflow transformation.
- The audit CLI produces real, per-prospect Lighthouse and SEO numbers usable as evidence in pitches.
- `demo/utah-aesthetic-surgery/` — a real build with real source content.
- **Absences future work must not fabricate:** there are no published client testimonials, named case studies, logo walls, headcount claims, revenue figures, or completed-engagement counts in this repo. Do not invent them, and do not imply a roster of past clients that the evidence does not support.

## Product Principles

1. **Evidence over assertion.** Numbers and screenshots, never adjectives.
2. **Honest reporting.** A failed step, a broken test, or a skipped item is stated plainly with its output. Nothing unverified is reported as done.
3. **Reuse before building.** The audit CLI, SiteRefresh, the templates, the concierge pattern, and the voice app already exist — wrap and reuse them.
4. **The clock is the product.** Two weeks, ship on day 10. Anything that undermines the credibility of that timeline undermines the offer.
5. **One action per surface.** Hyperworkflow.ai asks for a booked call and nothing else.

## Accessibility & Inclusion

WCAG AA as specified in `/DESIGN.md`. The client-page audience is disproportionately mobile and often operating under time pressure or duress (a failed furnace, a leaking roof), which makes touch-target size, contrast in daylight, and click-to-call reliability accessibility concerns rather than polish.
