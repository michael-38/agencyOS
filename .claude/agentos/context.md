# Context — what the AgencyOS operator knows

## Domain
AgencyOS is a lead-generation and AI-automation agency for **local service businesses and local institutions**: landscaping, cleaning, med spas & aesthetics, senior care & assisted living, wedding venues, private schools & camps, funeral homes, plus HVAC, roofing, and plumbing (the audit's industry list lives in `config/industries.yaml`; each has a persona in `personas/`). The model: find businesses with a weak web presence, prove value with an audit, rebuild their site, layer on AI (chat concierge, voice agent), and deploy.

## The toolkit (what's in this repo)

### `website-audit/` — URL → industry persona audit → gap report
Resolves any URL, maps the site (Firecrawl `/map`), scrapes the home page (markdown + raw HTML + mobile/desktop full-page screenshots + an in-browser layout probe), classifies the industry (Haiku 4.5, structured output, `< 0.8 → generic`), loads `personas/<slug>.md` + `personas/_common.md` by slug, runs deterministic checks in code and judgment items through Opus 5 vision, searches candidate pages for unmet `scope: subpath` items, and writes `report.json` + `report.md` (gaps only, ranked). Every external call is cached under the run dir; `--from-cache <runDir> --offline` replays for free.
Run: `cd website-audit && npm install && npx tsx src/index.ts audit <url>`; UI: `npm run ui`. Also: `validate-personas`, `list-checks`, `list-modules`, `eval`, `check-html`, `site:build` (SiteRedesign), `site:scaffold|validate|preview` (v2). Modules (all toggleable): classify, common-checklist, persona-checklist, deterministic, judgment, subpath, desktop, facts, lighthouse (reserved).
Firecrawl behaviour learned on the first live runs (2026-09-14): `mobile: true` + `viewport: {390, 844}` returns 390-px-wide PNGs at DPR 1; `actions` (the layout probe) execute in a 360×100000 viewport before the full-page capture, so probes must use a fixed fold height (`__FOLD_HEIGHT__` = 844), never `innerHeight`; screenshot URLs expire in 24 h, so they are downloaded immediately; a slow page can hit the 60 s scrape timeout and is recorded as `scrape-failed` rather than aborting the run.
Industry knowledge is data only: `config/industries.yaml` (slugs, aliases, archetypes + JSON-LD types), `config/detectors.yaml` (booking/review/chat/form vendor patterns, schema.org subtypes), `personas/*.md`. `website-audit/src` contains no vertical names (enforced by `test/no-industry-terms.test.ts`).
Replaced the former `audit/` (medspa-audit, med-spa-hardwired 9-module dashboard), deleted 2026-09-14 in its own commit (`git log --diff-filter=D --oneline -- audit/` finds it); its Lighthouse worker (`audit/src/modules/lighthouse-worker.mjs`) is recoverable from that commit's parent when the `lighthouse` module is built.

### `site:build` — SiteRedesign: an audit run → a real site
`cd website-audit && npx tsx src/index.ts site:build --report <abs path to report.json>`; skill `/build-site`. Five stages, all artifacts written beside `report.json` in `site/`, each re-runnable with `--stage`:
1. **assets** — harvest the audited site's own images out of the saved HTML, re-encode to webp with `sharp`, classify `hero|gallery|team|logo`, flag anything hosted off the audited domain `verify_license`. Nothing generated, nothing from stock.
2. **plan pass 1** (Opus 5) — page architecture: which pages exist, the question each answers, title/description/h1, section briefs, and the facts the site may state.
3. **plan pass 2** (Opus 5, one call per page, parallel) — the copy. Every string carries a verbatim source quote or `placeholder`; a quote that cannot be found in the scraped markdown loses its credit.
4. **design** (Opus 5) — one `assets/site.css` for the whole site plus the class contract in `design.md`, from `personas/<slug>.md`, the industry reference's `## Design direction`, and `templates/design-system.md`.
5. **render** (Opus 5, one call per page) — body markup only, against that contract.
`<head>`, the JSON-LD `@graph`, breadcrumbs, `sitemap.xml`, `robots.txt` and `llms.txt` are built **in code**, never by a model. Validation runs structural/SEO/AEO/fabrication/coverage gates and feeds errors back into the render stage for up to two repair passes; anything unresolved goes in `seo-report.md` rather than shipping quietly. `--profile mockup` (default) is an offline pitch folder; `--profile production --base-url …` is Cloudflare-Pages-ready. Webfonts self-hosted from `config/fonts.yaml`. Cost control is built in and was learned the hard way (building it burned ~$12 in a single session): the corpus is prompt-cached as the leading block of every plan call, render defaults to Sonnet 5 (mechanical markup, validator-gated), the repair loop stops when a pass fails to reduce the error count, `--max-usd` (default $6) hard-stops the build, and `--dry-run` prints a per-stage estimate first. A clean 6-page build is ~$3.50 (the corpus cache is the saving; render must stay on Opus). **Iterate with `--stage`, never by re-running the whole build** — the run cache keys on prompt text, so editing a prompt re-pays for that stage. For pipeline changes, `website-audit/test/site-e2e.test.ts` drives the whole orchestrator from recorded stage outputs through an injected `LlmParser`: no network, no spend. Settled 2026-09-17: render stays on **Opus 5**. Sonnet 5 was measured on a real 6-page build and went 36 → 13 → 21 errors across its repair passes without converging (dropping `data-copy-id`, inventing step labels), where Opus went 2 → 0 — and it cost more ($1.32 vs $1.49) because it burned every repair pass and still failed. Don't re-litigate without re-running `--render-model claude-sonnet-5`.
Two schema lessons from the first live runs (2026-09-16): a deeply nested structured-output schema is rejected with "compiled grammar is too large" — hence the flat model-facing schemas in `src/site/types.ts` and the two-pass plan; and the SDK refuses a non-streaming request with `max_tokens` ≥ ~21 k, so `LlmClient.parse` streams above 20 k.

### `cli/` — SiteRefresh
Scrapes an outdated contractor site → extracts business data → rewrites copy with Claude → generates a modern landing page. Industry populators in `src/populators/` (plumbing, roofing, shared); rewrite prompts in `src/prompts/`.
Run: `cd cli && npm install && npx tsx src/index.ts <url>`. Superseded by `site:build` for the verticals it covers, and its rewrite prompt fabricates reviews when the source has none (rule 7 in `src/prompts/rewrite.ts`) — the new path forbids that.

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
- `website-audit` M1 shipped (pipeline + local UI + evals scaffold); M2 = author persona files per vertical; M3 = v2 builder via `/build-industry-site`; M4 = SiteRedesign (`site:build`, `/build-site`) shipped 2026-09-16.
- Build references (`.claude/skills/build-industry-site/references/`) are the remaining data gap: `local-service`, `landscaping`, and `med-spa` are written; the other six industries and the two other archetypes are still authoring skeletons, and `site:build` degrades and declares it when they are.
- Per-client AI concierge config (shared `serve.js` + prompt files).
- Med-spa template refinement; the Utah Aesthetic Surgery demo build.
- Hyperworkflow landing-page copy.
