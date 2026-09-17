---
name: build-site
description: Rewrite an audited site's own content into an SEO/AEO-optimised, conversion-focused multi-page site whose design is driven by the industry persona. Runs the site:build pipeline (harvest the client's own images → plan the architecture → rewrite the copy with provenance → author a persona-specific stylesheet → render → validate), then does the human-taste pass. Use when asked to "rebuild this site", "build the new site from the audit", "rewrite their content for SEO", "make them a better site", or "turn this audit into a real site".
argument-hint: [report-path] [--profile production --base-url https://…]
---

Build a replacement site for the business audited at **$0** (a run's `report.json`), written from that
business's own content and designed for its industry persona.

## Prerequisites
- `cd website-audit && npm install` — once.
- `ANTHROPIC_API_KEY` in `website-audit/.env` or the repo-root `.env`.
- **$0 is a finished audit run**: `runs/<host>/<timestamp>/report.json` with `raw/pages/*/page.md`
  beside it. If there is no run yet, run `/audit-prospect` first — this skill rewrites an audit, it
  does not scrape.
- Personas and build references are data. Industry knowledge comes from `config/industries.yaml`,
  `personas/<slug>.md`, and `.claude/skills/build-industry-site/references/<slug>.md`. Never choose,
  edit, or inline it. If a reference file is still an authoring skeleton the build says so in
  `seo-report.md` and produces a weaker site; fill the file rather than compensating in the prompt.

## Run it

```
cd website-audit
npx tsx src/index.ts site:build --report <abs path to report.json>
```

Useful flags: `--profile production --base-url https://…` (deployable output with canonical, OG,
sitemap, robots, llms.txt and `_headers`), `--max-pages <n>`, `--assets placeholder` (skip reusing
the client's photographs), `--stage <assets|plan|design|render|validate>` to restart partway using
the artifacts already on disk, `--from-cache <runDir>` to replay a previous build for free.

**Money.** A clean 6-page build is about **$2.30**, and `--max-usd` (default $6) stops it there.
Always `--dry-run` first on an unfamiliar run — it prints a per-stage estimate before anything is
billed — and say the number to the user before you spend it on their key. When you need to change
something and re-run, use `--stage`: re-running the whole build to check one fix costs full price,
because the run cache keys on prompt text. For changes to the pipeline itself, work against
`website-audit/test/site-e2e.test.ts`, which exercises the whole orchestrator offline for nothing.

Exit code is 0 only when validation passes. **Never report a non-zero exit as success.**

## What the pipeline does

| stage | who decides | output |
|---|---|---|
| assets | code | downloads the audited site's own images, re-encodes to webp, classifies and licence-flags them → `assets.json`, `assets/img/` |
| plan (pass 1) | Claude | page architecture, titles, meta descriptions, per-page query, section briefs, the facts the site may state → part of `plan.json` |
| plan (pass 2) | Claude, one call per page | the copy, every string carrying a verbatim source quote or marked placeholder → `plan.json`, `copy_map.json` |
| design | Claude | one stylesheet for the whole site plus the class contract → `assets/site.css`, `design.md` |
| render | Claude, one call per page | the body markup only |
| head, JSON-LD, breadcrumbs, sitemap, robots, llms.txt | code | never a model — a plausible-but-wrong canonical or FAQ mirror is the failure that survives review |
| validate | code | `validate.json`, `self-test.json`, `seo-report.md`; errors are fed back for up to two repair passes |

## Then do the part the pipeline cannot

1. **Read `seo-report.md` first.** It lists unresolved validation errors, unsourced claims, images
   needing a licence check, and any build reference that was still unwritten. Everything in it is
   something you must either fix or tell the user about.
2. **Look at the site.** `npx tsx src/index.ts site:preview <run dir>/site`, then check at 390px and
   at desktop: the phone link in the header without scrolling, the primary action in the first
   screen, the sticky bar on mobile, focus rings visible, nothing overflowing, zero network requests
   in devtools, and the nav working across pages.
3. **Judge the design against the persona,** not against your own taste. A funeral-home page and a
   med-spa page should not look alike; if the output looks like a generic template, the
   `## Design direction` block in the industry reference is thin — improve the reference, then
   `--stage design`. Follow `templates/design-system.md` as the floor and the house rule on imagery
   critique: call generic visuals "generic stock photo / AI-generated", never assert provenance.
4. **Check the placeholder ratio.** A high ratio is not a bug; it means the source site said little.
   Say so plainly and list what the client needs to supply.
5. **Confirm the licence flags.** Any image marked `verify_license` came from a host other than the
   audited domain. Do not publish those until the client confirms they own or licence them.

## Rules
- **Never invent a fact.** No review, rating, credential, price, statistic, award, or guarantee
  appears unless the source site already stated it. The fabrication gate enforces this; do not
  work around it by editing the generated HTML by hand. If a gate is wrong, fix the gate.
- **Fix the source, not the symptom.** Copy problems belong in the plan stage, layout problems in
  the design stage, markup problems in the render stage. Re-run with `--stage`; do not hand-patch
  `index.html`, because the next run overwrites it.
- **Confirm before anything outward-facing.** Deploying to a live domain, pointing DNS, or sending
  the site to a client is a separate, explicitly confirmed step.
- `robots.txt` allows the AI crawlers by name. That is deliberate — an assistant cannot cite a page
  it may not fetch — but it is the client's call, so mention it at handoff.
- The generated site is a proposal built from the client's own words. Say that when you hand it over.

## Output contract

Beside `report.json`, in `site/`:

| path | contents |
|---|---|
| `index.html`, `<section>/<slug>/index.html` | the pages |
| `assets/site.css`, `assets/fonts/*`, `assets/img/*` | everything the pages load, all local |
| `plan.json` | the architecture and the copy, with provenance |
| `copy_map.json` | every rendered block → its source quote or `"placeholder"` |
| `assets.json` | every image → its source URL and licence flag |
| `design.md` | the class contract and the design rationale |
| `validate.json`, `self-test.json` | every gate's findings; the audit's deterministic checks re-run per page |
| `seo-report.md` | what was optimised, what is unresolved, what is unverified |
| `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, `_headers`, `*/index.md` | production profile only |

## Related
- `/audit-prospect` produces the run this skill consumes.
- `/build-industry-site` is the older single-page offline mockup (`site:scaffold`), filled in by hand.
  Use it when you want a pitch artefact with no LLM spend; use this skill when you want a real site.
