# website-audit

URL → industry persona audit → gap report. Runs as a plain script (no Claude Code session), caches every
external call so re-running is free, and is industry-agnostic by construction: every piece of industry
knowledge lives in data (`config/industries.yaml`, `config/detectors.yaml`, `personas/*.md`), never in
`src/`.

## Setup

```bash
cd website-audit && npm install
# secrets: website-audit/.env or the repo-root .env (ANTHROPIC_API_KEY, FIRECRAWL_API_KEY)
```

## Run

```bash
npx tsx src/index.ts audit <url> [--industry <slug>] [--enable m1,m2] [--disable m1,m2] \
  [--exclude-items id1,id2] [--from-cache <runDir>] [--offline] [--judge-model claude-sonnet-5] \
  [--tiles 4] [--max-candidate-pages N] [--lenient] [--json-progress] [--dry-run] [--verbose]
npm run ui                       # local web UI at http://127.0.0.1:8790
npx tsx src/index.ts validate-personas
npx tsx src/index.ts list-checks # deterministic check ids persona authors can use
npx tsx src/index.ts list-modules
npx tsx src/index.ts eval [--site name] [--refresh]
npx tsx src/index.ts check-html <site/index.html> --slug <slug>   # v2 self-test
npm test && npm run typecheck
```

Runs land in `runs/<host>/<timestamp>/` with `report.json`, `report.md`, every raw Firecrawl and LLM
response, screenshots + tiles, and `cache/index.json`. `--from-cache <runDir>` reuses a previous run's
responses; `--offline` fails on any cache miss.

## Pipeline

1. Resolve the input (scheme optional, redirects followed, `www.`/`m.` treated as the same site).
2. Home rule after the root scrape: `root-2xx` by default; `root-non-2xx`, `host-mismatch`, or
   `splash-detected` send a Haiku chooser to pick among mapped URLs. `input-page-fallback` when nothing to choose.
3. Firecrawl `/map` (`sitemap: include`, subdomains included, limit 100); a second map without subdomains
   when they exceed 30 % of results. URLs normalized, deduped, legal/asset/noise pages dropped.
4. Scrape the home page: markdown + rawHtml + links + full-page mobile screenshot (390×844) + an in-browser
   layout probe; desktop full-page screenshot (1366×768). Mobile shots are tiled to ≤ 2576 px for the judge.
5. Classify the industry (Haiku, structured output, `confidence < 0.8 → generic`).
6. Load `personas/<slug>.md` + `personas/_common.md` by slug; validate; merge.
7. Evaluate: deterministic checks in code; judgment items in one Opus 5 vision call per page; unmet
   `scope: subpath` items trigger one batched candidate-selection call, candidate scrapes, and per-page
   evaluation. Best verdict across pages wins; `candidates_checked[]` and `satisfied_at_url` are recorded.
8. Report: `report.json` (schema in `src/report/schema.ts`) and `report.md` (gaps only, ranked).

## Modules

Every optional part is a module (`list-modules`): `classify`, `common-checklist`, `persona-checklist`,
`deterministic`, `judgment`, `subpath`, `desktop`, `facts`, `lighthouse` (reserved). Toggle with
`--enable/--disable` or from the UI. Skipped work is declared in `summary.skipped` and as a
`Not evaluated:` line in `report.md`.

## Adding an industry

1. Add an entry to `config/industries.yaml` (slug, display_name, aliases, archetype, persona_file, build_reference_file).
2. Write `personas/<slug>.md` (frontmatter + goals prose + checklist table). Deterministic rows must use a
   registered check id (`list-checks`); judgment rows use any persona-specific id.
3. `npx tsx src/index.ts validate-personas`. No code changes.

New vendor patterns (booking, reviews, chat, forms) go in `config/detectors.yaml`.
