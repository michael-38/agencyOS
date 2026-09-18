# website-audit

URL → industry persona audit → gap report. Runs as a plain script (no Claude Code session), caches every
external call so re-running is free, and is industry-agnostic by construction: every piece of industry
knowledge lives in data (`config/industries.yaml`, `config/detectors.yaml`, `personas/*.md`), never in
`src/`.

## Setup

```bash
cd website-audit && npm install
npm run shots:setup   # once, only if you want site:shot (downloads Chromium, ~94MB)
# secrets: website-audit/.env or the repo-root .env (ANTHROPIC_API_KEY, FIRECRAWL_API_KEY)
```

## Run

```bash
npx tsx src/index.ts audit <url> [--industry <slug>] [--enable m1,m2] [--disable m1,m2] \
  [--exclude-items id1,id2] [--from-cache <runDir>] [--offline] [--judge-model claude-sonnet-5] \
  [--tiles 4] [--max-candidate-pages 8] [--judge-text lean|full] [--lenient] [--json-progress] [--dry-run] [--verbose]
npm run ui                       # local web UI at http://127.0.0.1:8790
npx tsx src/index.ts validate-personas
npx tsx src/index.ts list-checks # deterministic check ids persona authors can use
npx tsx src/index.ts list-modules
npx tsx src/index.ts eval [--site name] [--refresh]
npx tsx src/index.ts check-html <site/index.html> --slug <slug>   # v2 self-test
npm test && npm run typecheck
```

SiteRedesign — turn a finished audit into a site:

```bash
npx tsx src/index.ts site:build --report <abs path to report.json> \
  [--preview] [--profile mockup|production] [--base-url https://…] [--max-pages 12] [--max-assets 24] \
  [--assets reuse|placeholder] [--stage assets|plan|design|render|validate] \
  [--repair-passes 2] [--from-cache <runDir>] [--offline] [--dry-run]
npx tsx src/index.ts site:shot <site dir> [--viewport mobile|desktop|both] [--no-compare] [--hide-notice]
npx tsx src/index.ts site:scaffold --slug <slug> --report <report.json>   # the older one-page mockup
npx tsx src/index.ts site:validate <site dir>
npx tsx src/index.ts site:preview <site dir>
```

The outreach path is `--preview` then `site:shot`: build the home page only (~$1.65 instead of
~$4.25), screenshot it beside the audit's own screenshot of the current site, send that, and finish
the site in the same run directory only if the prospect replies. See
[Preview first, build the rest later](#preview-first-build-the-rest-later).

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
7. Evaluate: deterministic checks in code; judgment items in one Opus 5 vision call per page. Unmet
   `scope: subpath` items are then checked on the top-level pages linked from the home page (document order,
   `--max-candidate-pages`, default 8, written to `candidate_pool.json`), one call per page for the items
   still unmet. An item stops being judged once it passes, and the loop stops once every unmet item has
   passed. Candidate-page text is `lean` by default: link targets and image markup are stripped and blocks
   the home page already showed are dropped (`--judge-text full` disables this; the home page always gets
   full text). Best verdict across pages wins; `candidates_checked[]` and `satisfied_at_url` are recorded,
   and `report.md` states the scope so a fail never claims content is absent site-wide.
8. Report: `report.json` (schema in `src/report/schema.ts`) and `report.md` (gaps only, ranked).

## site:build

Rewrites the audited business's own content into a small multi-page site, designed for its industry
persona and optimised for search engines and answer engines. Everything it says is traceable to the
source site; everything it cannot source is a visible placeholder.

1. **assets** — harvest the audited site's own images from the saved HTML, re-encode to webp with
   `sharp`, classify (`hero`/`gallery`/`team`/`logo`), and flag anything hosted off the audited domain
   `verify_license`. Nothing is generated and nothing is fetched from elsewhere.
2. **plan, pass 1** — one Opus 5 call decides the architecture: which pages exist, the question each
   answers, its title/description/h1, its section briefs, and the facts the site is entitled to state.
3. **plan, pass 2** — one call per page writes the copy. Every string carries either a verbatim quote
   from a scraped page or `placeholder`. A quote that cannot be found in the source loses its credit,
   which forces the block to make no specific claim.
4. **design** — one call writes `assets/site.css` for the whole site plus the class contract, from the
   persona, the industry reference's `## Design direction`, and `templates/design-system.md`. One
   stylesheet is what keeps a dozen separately rendered pages looking like one site.
5. **render** — one call per page writes the body markup against that contract.
6. **head, JSON-LD, breadcrumbs, sitemap, robots.txt, llms.txt — all in code**, never a model. A
   plausible-but-wrong canonical, breadcrumb, or FAQ mirror is the failure mode that survives review.
7. **validate** — structural, SEO, AEO, fabrication, and audit-coverage gates; errors are fed back
   into the render stage for up to two repair passes, and anything still failing is written to
   `seo-report.md` rather than shipped quietly.

The fabrication gate is the load-bearing one: every number, credential, and superlative in the
rendered text must appear in a verified source quote or in `report.facts`, and copy with no verified
source may contain no specific claim at all. `npm test` exercises each gate against a crafted-bad
fixture.

### What it costs, and how not to overspend

`--dry-run` prints a per-stage estimate before anything is billed, and `--max-usd` (default **$6**)
stops the build if it gets there. A clean 6-page build is roughly **$4.25**, which is what the
estimator in `estimateCost` is calibrated against. Three things keep it there, and all three were
learned the expensive way:

- **The corpus is prompt-cached.** The scraped pages are the first block of every plan-stage call and
  are marked as a cache breakpoint, so five of six copy calls read them at a tenth of input price
  instead of re-paying. Anything large and invariant in a prompt belongs first and marked
  `cacheable` (`ContentPart` in `src/llm/client.ts`).
- **Render stays on Opus 5, and that was measured, not assumed.** Sonnet 5 was tried on a real
  6-page build: it went 36 → 13 → 21 errors across its repair passes and never converged (omitted
  `data-copy-id`, invented step labels), while Opus went 2 → 0. It was not even cheaper in the end,
  because it burned every repair pass and still failed. `--render-model` is there to retest.
- **The repair loop gives up when it stops helping.** A pass that does not reduce the error count
  ends the loop and says so in `seo-report.md`. Without this, a build once went 23 → 27 → 35 errors
  across two passes and charged for every re-render.

**Iterate with `--stage`, not by re-running the whole thing.** Each stage caches independently, so
`--stage render` reuses `plan.json` and `design.json` for free. Note the run cache keys on prompt
text: editing a prompt invalidates that stage. To change pipeline behaviour without paying at all,
work against `test/site-e2e.test.ts`, which drives the entire orchestrator from recorded stage
outputs through an injected `LlmParser` — no network, no spend, and it catches the structural class
of bug (duplicate FAQ, untracked text, dead links) that is otherwise only visible in a paid build.

### Preview first, build the rest later

`--preview` writes the **home page only**. The architecture pass still plans the whole site at the
full `--max-pages` budget — that is what makes the preview worth showing and the resume free:

| | expected | worst case |
|---|---|---|
| `--preview` | **$1.65** | $2.07 |
| full 6-page build | **$4.25** | $6.75 |

The floor is architecture ($0.49) + design ($0.56) = **$1.05**, two thirds of a preview. Both are
whole-site calls, so a one-page build cannot get much cheaper than that.

Because the architecture call is issued at the same page budget either way, its request is
byte-identical between the preview and the build that finishes the job, and the run cache keys on the
exact request — so acceptance costs only the pages that are new:

```bash
npx tsx src/index.ts site:build --report <…>/report.json --preview   # $1.65, home page only
npx tsx src/index.ts site:shot <…>/site                              # the images you send
# they reply:
npx tsx src/index.ts site:build --report <…>/report.json --stage plan  # the rest, ~$2.60
```

Architecture, design, and the home page's copy are cache hits on that second command; only the
remaining pages and a re-render of the home page (its nav and internal links now point at real files)
are billed. Preview + finish costs about the same as one full build, with a free go/no-go in the
middle. `test/site-preview.test.ts` asserts that request identity rather than trusting it.

Pages the preview deferred stay in `plan.json` as `deferred_pages`: they appear in the navigation
(pointing at the home page, not at a file that does not exist), they are listed in `seo-report.md`,
and audit gaps the architecture assigned to them are reported as **deferred warnings** rather than
coverage errors — otherwise the repair loop would spend the whole budget trying to cram a twelve-page
checklist onto one page. `--preview` and `--profile production` are refused together, because a
sitemap describing a one-page site would be a lie told to a search engine.

### site:shot — the images you actually send

Screenshots the built page with Playwright at the same viewports the audit uses (390×844, 1366×768),
and composites each against the audit's own screenshot of the business's current home page.

```
shots/after-<viewport>.png          full page, retina (--scale, default 2)
shots/after-<viewport>-fold.png     the first screen
shots/before-after-<viewport>.png   their site today | the rebuild, side by side
```

This is a screenshot of real HTML, not a generated mockup image, on purpose. An image model would
have to invent the business's copy — exactly what the fabrication gate exists to prevent — and the
result would be thrown away the moment the prospect said yes.

The comparison uses the **fold**, not the full page: a 7,700px-tall "before" beside a differently tall
"after" is unreadable at email size, and the first screen is what the audit judges anyway. It also
never carries the unverified-copy banner, which is an internal QA device rather than part of the
design and covers a quarter of a 390px fold. The standalone `after-*.png` shots keep it (`--hide-notice`
drops them too), and the placeholder count is printed either way.

Needs a browser: `npm run shots:setup` (`playwright install chromium`, ~94MB, once).

`--profile mockup` (default) emits a folder that opens over `file://` with zero network requests, for
pitching. `--profile production --base-url https://…` adds canonical, Open Graph, `sitemap.xml`,
`robots.txt` (naming the AI crawlers explicitly), `llms.txt` with per-page markdown mirrors, and a
Cloudflare Pages `_headers`. Webfonts are self-hosted from `config/fonts.yaml`, so neither profile
touches the network at runtime.

Output lands in `<run dir>/site/`: the pages, `assets/`, `plan.json`, `copy_map.json`, `assets.json`,
`design.md`, `validate.json`, `self-test.json`, and `seo-report.md`.

## Modules

Every optional part is a module (`list-modules`), in two groups. Toggle either group with
`--enable/--disable` or from the UI.

**Audit pipeline** — `classify`, `common-checklist`, `persona-checklist`, `deterministic`, `judgment`,
`subpath`, `desktop`, `facts`, `lighthouse` (reserved). All on by default except `lighthouse`. Skipped
work is declared in `summary.skipped` and as a `Not evaluated:` line in `report.md`.

**OpenSEO enrichment** — all **off by default**, and never counted as skipped audit coverage:

| Module | Billing | What it adds |
|---|---|---|
| `openseo-crawl` | free | Whole-site technical crawl: broken links, duplicate/missing titles, redirect chains, orphan pages, thin content |
| `openseo-search-console` | free | Clicks, impressions, position + striking-distance pages (needs GSC connected) |
| `openseo-analytics` | free | GA4 organic sessions, engagement, revenue by landing page (needs GA4 connected) |
| `openseo-project-context` | free | Create/match the OpenSEO project and write the audit's brief into its shared memory |
| `openseo-lighthouse` | DataForSEO | Lighthouse + Core Web Vitals on a page sample, mobile + desktop |
| `openseo-keywords` | DataForSEO | Volume, difficulty, CPC and intent for the services the audit found |
| `openseo-rankings` | DataForSEO | Organic traffic estimate + the keywords the domain already ranks for |
| `openseo-serp` | DataForSEO | Live SERP for the target keywords |
| `openseo-competitors` | DataForSEO | Which domains actually compete for that keyword set |
| `openseo-backlinks` | DataForSEO | Backlinks, referring domains, authority/spam signals |
| `openseo-local-pack` | DataForSEO | Google Business Profile + Maps/local-finder results |
| `openseo-local-grid` | DataForSEO | Maps rank grid around the business — the local pitch's best visual |
| `openseo-reviews` | DataForSEO | Review count, text and owner replies for the competitor gap |
| `openseo-rank-tracking` | DataForSEO | Rank tracker setup (setup is free; checks bill) |

**free** = needs a connected OpenSEO account but makes no DataForSEO call. **DataForSEO** = bills your
DataForSEO key per call; `list-modules` prints the per-module estimate.

The audit runs as a plain script, so it cannot call OpenSEO's MCP tools itself. Enabling a module
writes a **pre-filled request** to `report.json` under `openseo.requests` — the domain, business
identity, locality and keyword seeds all taken from the audit that just ran — plus an
`## OpenSEO enrichment` section in `report.md`. An agent session then executes them with the OpenSEO
MCP tools or the `/openseo:*` skills. **A run never spends DataForSEO credits by itself**;
`openseo.status` stays `not-run` until an agent does it.

## Adding an industry

1. Add an entry to `config/industries.yaml` (slug, display_name, aliases, archetype, persona_file, build_reference_file).
2. Write `personas/<slug>.md` (frontmatter + goals prose + checklist table). Deterministic rows must use a
   registered check id (`list-checks`); judgment rows use any persona-specific id.
3. Fill `.claude/skills/build-industry-site/references/<slug>.md` — the audit does not need it, but
   `site:build` reads `## Design direction` and `## Page architecture` from it, and says so in
   `seo-report.md` when they are missing. The contract is in that directory's `README.md`.
4. `npx tsx src/index.ts validate-personas`. No code changes.

New vendor patterns (booking, reviews, chat, forms) go in `config/detectors.yaml`. Self-hostable
webfonts go in `config/fonts.yaml`.
