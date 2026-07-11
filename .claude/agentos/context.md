# Context — what the AgencyOS operator knows

## Domain
AgencyOS is a lead-generation and AI-automation agency for **local service businesses**: med spas & aesthetic surgery, HVAC, roofing, and plumbing. The model: find businesses with a weak web presence, prove value with an audit, rebuild their site, layer on AI (chat concierge, voice agent), and deploy.

## The toolkit (what's in this repo)

### `audit/` — website audit CLI (`medspa-audit`)
Ingests a URL or a batch and runs 9 independent modules → a self-contained, shareable HTML dashboard.
Modules: `lighthouse`, `seo-onpage`, `seo-ranking`, `traffic-metrics`, `llm-copy-aeo`, `llm-discoverability`, `copy-conversion`, `design-review`\*, `ux-medspa`\* (\*disabled by default; enable with `--enable design-review,ux-medspa`).
Run: `cd audit && npm install && npx tsx src/index.ts <url> --open`. Reports → `audit/output/`. Batch → add `--batch <file.csv> --index`.

### `cli/` — SiteRefresh
Scrapes an outdated contractor site → extracts business data → rewrites copy with Claude → generates a modern landing page. Industry populators in `src/populators/` (hvac, plumbing, roofing, shared); rewrite prompts in `src/prompts/`.
Run: `cd cli && npm install && npx tsx src/index.ts <url>`.

### `templates/` — landing pages + design system + concierge
- `design-system.md` — the **source of truth** for typography, color, spacing, and CTAs. Read it before any visual work.
- `med-spa/`, `hvac/`, `roofing/`, `plumbing/` — each has `index.html`, `<industry>-copy.md`, `<industry>-design.md`.
- Concierge (med-spa): `serve.js` (generic, shared) + `concierge.json` (config) + `concierge-prompt.md` (system prompt). Run: `node serve.js [port]` (default 8765).

### `demo/voice-agent/` — voice-agent SaaS
Next.js 16 + React 19 admin/client app for managing AI phone agents. Stack: Vapi (calls), Supabase (data/auth), Twilio (SMS), Stripe (billing), Google Calendar (availability). Agent skills: `check_availability`, `schedule/reschedule/cancel_appointment`. Docs (in `demo/voice-agent/`): `ARCHITECTURE.md`, `PRD.md`, `VAPI-INTEGRATION.md`, `DATABASE.md`, `API.md`, `IMPLEMENTATION-GUIDE.md`. Run: `cd demo/voice-agent/app && npm run dev`.

### Also
- `hyperworkflow/` — the agency's marketing site (hyperworkflow.ai), deployed to Cloudflare Pages via GitHub Actions.
- `demo/utah-aesthetic-surgery/` — a real reference build.
- `lead-gen-target-industries.md` — target verticals, lead sources, qualification signals, and ROI.

## Tech stack
Node.js + TypeScript (`tsx`), Next.js 16 / React 19, Anthropic SDK (`@anthropic-ai/sdk`), Firecrawl, Playwright + Lighthouse, Cloudflare Pages + GitHub Actions, Supabase, Vapi, Twilio, Stripe, EJS.

## Active projects (as of 2026-07)
- Per-client AI concierge config (shared `serve.js` + prompt files).
- Med-spa template refinement; the Utah Aesthetic Surgery demo build.
- Hyperworkflow landing-page copy.
