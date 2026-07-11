---
name: audit-prospect
description: Audit a prospect's or client's website end to end before a pitch or onboarding. Runs the medspa-audit CLI (Lighthouse, SEO, LLM copy/AEO, discoverability, conversion, design, UX) and turns the HTML dashboard into a prioritized, evidence-backed findings summary and outreach angle. Use when asked to "audit this site", "score this prospect", "run an audit", or to prep outreach.
argument-hint: [url-or-csv]
---

Audit target: **$ARGUMENTS**

## Steps
1. `cd audit`, then `npm install`. `.env` needs `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY` (optional: `SERPAPI_API_KEY`, `DATAFORSEO_*`, `PERPLEXITY_API_KEY` — those modules skip if absent). See `.claude/agentos/connections.md`.
2. Run it:
   - Single URL: `npx tsx src/index.ts $0 --open`
   - Batch (prospecting): `npx tsx src/index.ts --batch $0 --index --concurrency 2` — CSV needs a `url` column; optional `name`, `city`, `keywords`.
   - Include the vision design + med-spa UX modules with `--enable design-review,ux-medspa`.
3. Read the report at `audit/output/<domain>-<timestamp>/report.html` (batch: `audit/output/index.html`).
4. Summarize the top 3–5 highest-impact findings **with the numbers behind them** (Lighthouse scores, missing schema/CTAs, ranking gaps). Lead with what costs the business leads.
5. Distill one outreach angle: the single most compelling "here's what's broken and what fixing it is worth" hook.

## Rules
- Evidence over adjectives — cite the metric, not a vibe.
- Design critique: call generic imagery "generic stock photo / AI-generated"; never assert an image was AI-generated as fact.
- Hand qualified targets to `/refresh-site` or `/build-landing-page`.
