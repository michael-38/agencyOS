---
name: build-industry-site
description: Build the v2 single-file preview site for an audited business from its website-audit run. Routes on the industry archetype in config/industries.yaml, scaffolds runs/<host>/<timestamp>/site/index.html with site:scaffold, rewrites the audited site's own copy (or conservatively placeholders it), tags every audit gap with data-checklist, writes copy_map.json, and proves it with site:validate + check-html. Use when asked to "build the site from the audit", "build the industry site", "generate the preview site", "make the mockup for <host>", "scaffold the site", or "turn this audit into a page".
argument-hint: [slug] [report-path]
---

Build a **$0** single-page preview site from the audit run at **$1** (a run's `report.json`); write it beside the report as `site/index.html`.

## Prerequisites
- `cd website-audit && npm install` — once.
- Personas are data. The industry, its archetype, and its checklist come from `config/industries.yaml` + `personas/<slug>.md` + `personas/_common.md`; never choose, edit, or extend them. If `$0` is not a `slug` in `industries.yaml`, stop and say so.
- `$1` is a finished run: `runs/<host>/<timestamp>/report.json` with `report.md` and `raw/pages/` beside it. `report.industry.slug` must equal `$0`; if the audit misclassified, re-run the audit with `--industry $0` rather than building against a mismatched report.
- Use absolute paths for `$1` and the site dir — the wrapper scripts `cd` into `website-audit/`.

## Inputs (read in this order)
1. `config/industries.yaml` — find `slug: $0` → `archetype`, `build_reference_file`; then the archetype's `jsonld_type` and `reference_file`.
2. `references/archetypes/<archetype>.md` (this skill) — section order, per-section required elements, JSON-LD type + required properties, anchor-nav layout.
3. `references/$0.md` (this skill) — visitor priorities, industry sections, FAQ seeds, vocabulary, and the checklist-coverage table (which section/element satisfies each persona id). Heading skeleton: `references/README.md`.
4. `templates/design-system.md` — house visual rules (type scale, 8px spacing tokens, radii, buttons, cards, forms, breakpoints, a11y). Follow it; don't restate it. v2 overrides only where the offline rule forces it: system font stack instead of Inter/Google Fonts, inline SVG instead of the Phosphor CDN, labelled placeholders instead of photos.
5. `$1` — `industry.slug`; `facts` (`business_name`, `phones[]`, `address`, `hours`, `services[]`); `items[]` (`id`, `verdict`, `weight`, `criterion`, `scope`, `check`, `evidence.summary`); `pages[]` (`page_key`, `url`, `markdown_path`, `html_path`).
6. Source text — for every `pages[]` entry with a `markdown_path`, read `<run dir>/<markdown_path>` (= `raw/pages/<page_key>/page.md`). This is the only permitted copy source.

## Steps
1. **Scaffold.** `cd website-audit && npx tsx src/index.ts site:scaffold --slug $0 --report $1` (wrapper: `.claude/skills/build-industry-site/scripts/scaffold.sh --slug $0 --report $1`). Writes `<run dir>/site/index.html` + `site/copy_map.json`: sections `hero, services, trust, gallery, process, faq, contact`; one `<!-- gap <id> (<verdict>, <weight>): … -->` stub per non-pass item routed into a section; `data-checklist` on each section wrapper; `data-copy-id="pNNN"` + `data-copy="placeholder"` on every paragraph; the sticky `.notice`; JSON-LD `@graph` with the archetype node (name/url/telephone/address from `facts`) + an empty `FAQPage`; header tel link; mobile sticky bar.
2. **Fill sections** in the archetype's section order with the industry reference's required elements. Drop a scaffold section only if the archetype marks it optional and no gap routes to it; add a section only if the industry reference defines it. Keep the header anchor nav in sync with the sections present. The scaffold's gap-to-section routing is a keyword heuristic — the reference's coverage table wins.
3. **Copy.** For each paragraph, find the passage in `raw/pages/<key>/page.md` it comes from; rewrite it in the industry vocabulary but keep every factual claim verbatim (business name, service area, phone, hours, licences, years in business, named services). Remove `data-copy="placeholder"` only on paragraphs with a real source passage. No passage → write conservative copy (no numbers, dates, credentials, named clients, review quotes) and keep the attribute. Every `<p>` and `<li>` inside `<main>` carries a unique `data-copy-id`. The first sentence of every section must answer its H2 on its own.
4. **Imagery.** Replace each `.placeholder-img` div with an inline `<svg role="img" aria-label="…">` (solid fill + visible text label) sized for the intended asset, e.g. "Project photo: before/after patio". The hero placeholder must be an `<svg>` or `<img>` inside `<header>` or the first `<main> > section` — that is what the offline `above-fold-images` rule looks for. Never copy `src` URLs from the audited site.
5. **JSON-LD.** Fill the archetype node only from `facts` and source pages (name, telephone, address, `openingHours` if `facts.hours`, `areaServed` if the source states it). Fill `FAQPage.mainEntity` with the FAQ you wrote: `name` = the H3 text, `acceptedAnswer.text` = its paragraph. Both nodes stay in the one `@graph`. No `AggregateRating`/`Review` unless the source pages contain those exact reviews.
6. **Tag gaps.** For every item with verdict `partial` or `fail`, move `data-checklist="<id>"` from the section wrapper onto the element that satisfies it (tel link, form, `<h1>`, FAQ section, placeholder block); space-separate multiple ids. `scope: subpath` items are satisfiable on this one page. Delete each `<!-- gap … -->` stub as you satisfy it. A gap you cannot honestly satisfy (e.g. `review-markup` with no real reviews in the source) still gets a visible, labelled placeholder block tagged with its id — it will fail the self-test, and that is the correct result.
7. **Write `copy_map.json`.** One entry per `data-copy-id`: `text_sha256` = SHA-256 of the element's trimmed text (`printf '%s' "$text" | shasum -a 256`), `source` = `{ "url", "quote" }` (the page URL from `pages[]` and the verbatim source sentence(s)) or the string `"placeholder"`. `placeholder_ratio` = placeholder entries / total entries.
8. **Validate.** `npx tsx src/index.ts site:validate <run dir>/site` (wrapper: `scripts/validate.sh <run dir>/site`). Must end `OK — placeholder copy N/M`. Fix every `error:`; read every `warning:`. It checks: doctype/lang/title/meta/viewport; the four landmarks; one `<h1>`; an `<h2>` per section; alt text; zero external `src`/`href`/`action`/`url()`/`@import`; no `fetch`/XHR/beacon; no CDN or web-font hosts; JSON-LD parses and contains `FAQPage`; every `data-copy-id` is in `copy_map.json`; every `<p>`/`<li>` in `<main>` is tagged; the notice exists iff placeholders exist and is not dismissible; every non-pass report item has a `data-checklist` element; then the self-test. (`--slug` is not wired on this subcommand in `website-audit/src/index.ts`; the slug is read from `report.json`, and the archetype `@type` check is covered by step 9.)
9. **Self-test.** `npx tsx src/index.ts check-html <run dir>/site/index.html --slug $0` → `site/self-test.json`. Every deterministic gap should now be `pass`. `not-testable-offline` is acceptable only for layout items with no static rule; judgment ids appear under `judgment_items_present` only if you tagged them.
10. **Preview.** `npx tsx src/index.ts site:preview <run dir>/site` (wrapper: `scripts/preview.sh <run dir>/site`) opens the file over `file://`. Check at 390px and desktop: notice visible, tel link in the header, primary CTA in the first screen, sticky bar on mobile, zero network requests in devtools, focus rings visible, nothing overflows.
11. **Update `report.md`.** Append, using the exact wording the audit renderer uses, with N/M from step 8:
    ```
    Placeholder copy: N of M paragraphs (P%).
    Note: the single-page preview is a layout/content mockup, not the SEO page-architecture recommendation.
    ```
12. **Report back** with the file list, the `site:validate` and self-test summary lines, the placeholder ratio, which gap ids are tagged, and anything you could not satisfy and why.

## Rules
- **One file.** `runs/<host>/<timestamp>/site/index.html`: inline CSS, inline SVG, single page, in-page anchor nav. No other pages, no assets directory.
- **Offline.** Renders from `file://` with no server and no network: no CDN scripts, no web fonts, no `fetch()`/XHR/beacon, no analytics, no external `src`/`href`/`action`/`url()`. System font stacks only.
- **Source copy.** Rewrite the audited site's own text; preserve every factual claim exactly. Never invent facts, reviews, testimonials, credentials, statistics, or awards — not even "plausible" ones.
- **Thin source.** Conservative industry copy with no specific numbers, dates, credentials, named clients, or review quotes; every such element carries `data-copy="placeholder"`; the non-dismissible `.notice` stays at the top of `<body>` while any placeholder exists.
- **`copy_map.json`** maps every paragraph to its source passage or to `"placeholder"`. No unmapped text in `<main>`.
- **SEO/AEO/GEO.** One `<h1>`; a descriptive `<h2>` per section; answer-first opening sentence per section; FAQ with question-form `<h3>`s and short answers; `header`/`nav`/`main`/`section`/`footer` landmarks; descriptive `alt`/`aria-label` on every placeholder; `<title>` + meta description; inline JSON-LD (archetype type from `industries.yaml` + `FAQPage`). Sitemap, robots, canonical, and OG URLs are out of scope until there is a host.
- **Imagery.** Inline SVG or solid-colour placeholders, sized and labelled for the intended asset. Never reuse the audited site's images. When critiquing the source site's imagery, call generic visuals "generic stock photo / AI-generated"; never assert an image was AI-generated as fact.
- **Gaps.** Every `partial`/`fail` item maps to a visible section and its satisfying element is tagged `data-checklist="<id>"` so `check-html` can re-run v1's deterministic checks. `scope: subpath` counts as satisfiable on the one page.
- **`report.md`** gets the placeholder line and the mockup note (step 11).
- **Routing.** Read `references/archetypes/<archetype>.md`, then `references/<slug>.md`. A new archetype or industry is one reference file + one YAML entry; no code changes.
- **Quality bar.** Mobile-first; WCAG AA contrast, visible focus rings, 48px touch targets, `prefers-reduced-motion`; tel link in the header, primary CTA in the first screen, sticky mobile CTA bar; single file, zero external requests.
- **Out of scope.** Hosting, CI, deploy, domain handling, approval gates.
- Facts come from `report.json` and `raw/pages/` only — never from memory or the web.

## Output contract
Beside `report.json`:

| path | written by | contents |
|---|---|---|
| `site/index.html` | scaffold, then you | the one-file page |
| `site/copy_map.json` | scaffold, then you | `{ paragraphs: [...], placeholder_ratio }` |
| `site/self-test.json` | `site:validate` / `check-html` | v1 deterministic checks re-run against the file |
| `report.md` | audit, then you append | placeholder line + mockup note |

Data attributes the tooling reads:
- `data-checklist="<id> [<id> …]"` — on the element that satisfies a report item. Ids come only from `personas/<slug>.md`, `personas/_common.md`, and the scaffold's `sticky-mobile-cta`.
- `data-copy-id="pNNN"` — on every `<p>`/`<li>` inside `<main>`; unique; every id has a `copy_map.json` entry.
- `data-copy="placeholder"` — on every element whose text has no source passage.
- `.notice` (or `[data-placeholder-notice]`) — first child of `<body>`, no `<button>`, no `dismiss`/`close` class.

Worked example — a services paragraph rewritten from the source, satisfying two persona items:

```html
<section id="services" aria-labelledby="services-h">
  <h2 id="services-h">[Named services] in [service area as written on the source page]</h2>
  <p data-copy-id="p003" data-checklist="LS-services-clear LS-service-area">
    [First sentence: the named services and the service area — verbatim facts from the source, rewritten for clarity.]
  </p>
</section>
```

Matching `copy_map.json` entries — one sourced, one placeholder:

```json
{
  "paragraphs": [
    { "copy_id": "p003", "text_sha256": "<sha256 of the rendered paragraph text>",
      "source": { "url": "https://<host>/services", "quote": "<verbatim sentence(s) from raw/pages/<key>/page.md>" } },
    { "copy_id": "p021", "text_sha256": "<sha256>", "source": "placeholder" }
  ],
  "placeholder_ratio": 0.05
}
```
