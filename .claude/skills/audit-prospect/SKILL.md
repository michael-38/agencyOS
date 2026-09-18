---
name: audit-prospect
description: Audit a prospect's or client's website end to end before a pitch or onboarding. Runs the website-audit CLI (industry persona checklist: deterministic checks + Opus 5 vision judgment, mobile-first) and turns report.json / report.md into a prioritized, evidence-backed findings summary and outreach angle. Use when asked to "audit this site", "score this prospect", "run an audit", or to prep outreach.
argument-hint: [url] [--industry <slug>]
---

Audit target: **$ARGUMENTS**

## Steps
1. `cd website-audit`, then `npm install` once. `.env` (repo root or `website-audit/.env`) needs `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY`. See `.claude/agentos/connections.md`.
2. Run it:
   - Single URL: `npx tsx src/index.ts audit $0` (add `--industry <slug>` to skip classification; `--disable judgment` for a free deterministic-only pass; `--from-cache <runDir>` to re-evaluate without spending credits).
   - Or the local UI: `npm run ui` → http://127.0.0.1:8790 (URL + industry + module toggles → live progress → report).
   - Several prospects: loop the single command over a URL list; each run gets its own `runs/<host>/<timestamp>/`; the UI's previous-runs list is the index.
3. Read `runs/<host>/<timestamp>/report.md` (gaps only, ranked by weight) and `report.json` (`items[]` with evidence, `facts`, `pages[]`, `run_meta`). Screenshots: `raw/pages/<key>/mobile.fold.png`, `mobile.tiles/`, `desktop.fold.png`.
4. Summarize the top 3–5 highest-impact gaps **with the evidence line behind each** (the quote, probe value, or screenshot region). Lead with what costs the business leads. Say what was not evaluated if the report has a `Not evaluated:` line.
5. Distill one outreach angle: the single most compelling "here's what's broken and what fixing it is worth" hook.
6. **OpenSEO enrichment, if the run requested it.** If `report.json` has a non-null `openseo` block, the
   operator ticked enrichment modules the CLI cannot run itself. Each entry in `openseo.requests[]`
   carries `tools` (the OpenSEO MCP tools to call, in order), `args` pre-filled from this audit, and
   `billing`. Execute them, then fold the results into the findings summary — market demand, local-pack
   position and backlink reality are what turn a gap list into a business case.
   - Run every `billing: "free"` request without ceremony.
   - For `billing: "dataforseo"`, show the module list and its cost estimate and **get a yes before
     spending**. `whoami` reports the credit balance; the `/openseo:*` skills know the cheaper paths.
   - Prefer the matching skill over raw tools where one exists: `/openseo:seo-audit`,
     `/openseo:local-seo`, `/openseo:keyword-research`, `/openseo:competitor-analysis`.
   - `args` with a `note` field (for example a missing business name) means the audit could not source
     that value — confirm it with the client rather than guessing.

## Rules
- Evidence over adjectives — cite the report's evidence, not a vibe. Never report an unverified item (`[unverified: …]`) as a finding.
- Design critique: call generic imagery "generic stock photo / AI-generated"; never assert an image was AI-generated as fact.
- Personas are data (`personas/*.md`, `config/industries.yaml`): never pick a checklist by hand; use `--industry <slug>` only to override classification.
- OpenSEO enrichment never runs silently: `report.json` records what was requested, and DataForSEO-billed requests need an explicit yes before the call.
- Hand qualified targets to `/build-industry-site` (v2 preview from the report), `/refresh-site`, or `/build-landing-page`.
