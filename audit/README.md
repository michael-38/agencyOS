# medspa-audit

Comprehensive website audit for med spa clinics. Ingests a URL (or a batch of URLs), runs nine independent audit modules, and produces a self-contained, shareable HTML dashboard.

> **Note:** `design-review` and `ux-medspa` are **disabled by default**. Enable them with `--enable design-review,ux-medspa`.

## Audits

1. **Lighthouse** — mobile + desktop, all four categories (performance, a11y, best practices, SEO).
2. **SEO on-page** — meta, headings, schema, alt text, robots, sitemap.
3. **SEO ranking** — Google SERP rank for clinic name + service+city keywords (SerpAPI).
4. **Traffic & authority** — estimated monthly visits, domain rank, backlinks, referring domains, top organic keywords, domain age, social-profile presence (DataForSEO + free RDAP).
5. **LLM copy / AEO** — does the site copy follow AEO/GEO best practices?
6. **LLM discoverability** — what do Claude / Perplexity / ChatGPT say when asked about this clinic?
7. **Copy & conversion** — does the copy answer the buyer's questions and drive consultation booking?
8. **Design review** — Claude vision rates the screenshots against a med-spa design rubric.
9. **UX (med-spa-specific)** — click-to-call, book-consultation CTA, sticky mobile CTA, live chat detection.

## Setup

```sh
npm install
cp .env.example .env
# fill in keys (only ANTHROPIC_API_KEY + FIRECRAWL_API_KEY are required)
```

Playwright Chromium is installed automatically via `postinstall`. If it fails, run:

```sh
npx playwright install chromium
```

## Usage

Single URL:

```sh
npx tsx src/index.ts https://example-medspa.com --open
```

Batch (primary mode for sales prospecting):

```sh
npx tsx src/index.ts --batch prospects.csv --index --concurrency 2
```

Reports land in `output/<domain>-<timestamp>/report.html`. With `--index`, an `output/index.html` summary table links every report.

### CLI options

| Flag | Default | Notes |
|---|---|---|
| `--batch <file>` | – | CSV/XLSX/TXT. CSV columns: `url` (required), `name`, `city`, `keywords`. |
| `--output <dir>` | `./output` | |
| `--concurrency <n>` | `2` | Lighthouse + Playwright are heavy. |
| `--skip <list>` | – | Comma-separated module ids: `lighthouse,seo-onpage,seo-ranking,traffic-metrics,llm-copy-aeo,llm-discoverability,copy-conversion,design-review,ux-medspa`. |
| `--enable <list>` | – | Re-enable modules that are off by default (`design-review`, `ux-medspa`). |
| `--keywords <list>` | auto-derived | Comma-separated keyword overrides for SEO ranking. |
| `--open` | false | Open `report.html` when done (single URL only). |
| `--index` | false | Generate `output/index.html` summary across all clinics in the run. |
| `--verbose` | false | |

## Graceful degradation

Each optional API key (SERPAPI, PERPLEXITY, OPENAI, DATAFORSEO_LOGIN+DATAFORSEO_PASSWORD) gates a single module. If a key is missing, that module is skipped with a banner in the dashboard rather than failing the run.
