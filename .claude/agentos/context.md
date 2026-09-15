# Context — what the AgencyOS operator knows

## Domain
AgencyOS is a lead-generation and AI-automation agency for **local service businesses**: med spas & aesthetic surgery, HVAC, roofing, and plumbing. The model: find businesses with a weak web presence, prove value with an audit, rebuild their site, layer on AI (chat concierge, voice agent), and deploy.

## The toolkit (what's in this repo)

### `website-audit/` — URL → industry persona audit → gap report
Resolves any URL, maps the site (Firecrawl `/map`), scrapes the home page (markdown + raw HTML + mobile/desktop full-page screenshots + an in-browser layout probe), classifies the industry (Haiku 4.5, structured output, `< 0.8 → generic`), loads `personas/<slug>.md` + `personas/_common.md` by slug, runs deterministic checks in code and judgment items through Opus 5 vision, searches candidate pages for unmet `scope: subpath` items, and writes `report.json` + `report.md` (gaps only, ranked). Every external call is cached under the run dir; `--from-cache <runDir> --offline` replays for free.
Run: `cd website-audit && npm install && npx tsx src/index.ts audit <url>`; UI: `npm run ui`. Also: `validate-personas`, `list-checks`, `list-modules`, `eval`, `check-html`, `site:scaffold|validate|preview` (v2). Modules (all toggleable): classify, common-checklist, persona-checklist, deterministic, judgment, subpath, desktop, facts, lighthouse (reserved).
Firecrawl behaviour learned on the first live runs (2026-09-14): `mobile: true` + `viewport: {390, 844}` returns 390-px-wide PNGs at DPR 1; `actions` (the layout probe) execute in a 360×100000 viewport before the full-page capture, so probes must use a fixed fold height (`__FOLD_HEIGHT__` = 844), never `innerHeight`; screenshot URLs expire in 24 h, so they are downloaded immediately; a slow page can hit the 60 s scrape timeout and is recorded as `scrape-failed` rather than aborting the run.
Industry knowledge is data only: `config/industries.yaml` (slugs, aliases, archetypes + JSON-LD types), `config/detectors.yaml` (booking/review/chat/form vendor patterns, schema.org subtypes), `personas/*.md`. `website-audit/src` contains no vertical names (enforced by `test/no-industry-terms.test.ts`).
Replaced the former `audit/` (medspa-audit, med-spa-hardwired 9-module dashboard), deleted 2026-09-14 in its own commit (`git log --diff-filter=D --oneline -- audit/` finds it); its Lighthouse worker (`audit/src/modules/lighthouse-worker.mjs`) is recoverable from that commit's parent when the `lighthouse` module is built.

### `cli/` — SiteRefresh
Scrapes an outdated contractor site → extracts business data → rewrites copy with Claude → generates a modern landing page. Industry populators in `src/populators/` (plumbing, roofing, shared); rewrite prompts in `src/prompts/`.
Run: `cd cli && npm install && npx tsx src/index.ts <url>`.

### `templates/` — landing pages + design system + concierge
- `design-system.md` — the **source of truth** for typography, color, spacing, and CTAs. Read it before any visual work.
- `med-spa/`, `hvac/`, `roofing/`, `plumbing/` — each has `index.html`, `<industry>-copy.md`, `<industry>-design.md`.
- Concierge (med-spa): `serve.js` (generic, shared) + `concierge.json` (config) + `concierge-prompt.md` (system prompt). Run: `node serve.js [port]` (default 8765).

### `demo/voice-agent/` — voice-agent SaaS
Next.js 16 + React 19 admin/client app for managing AI phone agents. Stack: Vapi (calls), Supabase (data/auth), Twilio (SMS), Stripe (billing), Google Calendar (availability). Agent skills: `check_availability`, `schedule/reschedule/cancel_appointment`. Docs: `ARCHITECTURE.md`, `PRD.md`, `VAPI-INTEGRATION.md`, `DATABASE.md`, `API.md`, `IMPLEMENTATION-GUIDE.md`. Run: `cd demo/voice-agent/app && npm run dev`.

### Also
- `hyperworkflow/` — the agency's marketing site (hyperworkflow.ai), deployed to Cloudflare Pages via GitHub Actions.
- `demo/utah-aesthetic-surgery/` — a real reference build.
- `lead-gen-target-industries.md` — target verticals, lead sources, qualification signals, and ROI.

## Tech stack
Node.js 22 + TypeScript (`tsx`), Next.js 16 / React 19, Anthropic SDK (`@anthropic-ai/sdk` 0.125, structured outputs via `messages.parse`), Firecrawl v2 SDK (`firecrawl` 4.x; `/map` + `/scrape` only), sharp, cheerio, zod 4, Cloudflare Pages + GitHub Actions, Supabase, Vapi, Twilio, Stripe.

## Active projects (as of 2026-09)
- `website-audit` M1 shipped (pipeline + local UI + evals scaffold); M2 = author persona files per vertical; M3 = v2 builder via `/build-industry-site`.
- Per-client AI concierge config (shared `serve.js` + prompt files).
- Med-spa template refinement; the Utah Aesthetic Surgery demo build.
- Hyperworkflow landing-page copy.
