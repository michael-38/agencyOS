# funeral-homes

<!-- TODO (author): this file is the industry layer on top of references/archetypes/local-service.md. Fill every heading; keep the H2s exactly as they are (the builder parses them). No invented industry facts, no numbers. -->

## Visitor priorities
<!-- TODO (author): 3–5 bullets, in order, derived from personas/funeral-homes.md "What this visitor is trying to do" (the three questions it names, then what earns trust). No numbers. -->
- <!-- TODO (author) -->

## Sections
<!-- TODO (author): one ### block per section in the archetype's section order, plus any industry-added section (define it here and say where it goes). Use the scaffold ids as the ### text. -->

### hero
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author) -->
- **Copy guidance:** <!-- TODO (author): what to pull from the source home page for the H1 and the opener; the opener must answer the persona's first question on its own -->
- **Placeholder imagery labels:**
  - <!-- TODO (author): e.g. "Hero photo: <what the asset should show>" -->

### services
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): how services are listed (cards vs list), what each entry needs -->
- **Copy guidance:** <!-- TODO (author): use only services named on the source pages; how to group them -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### trust
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): what counts as proof for this persona; what to show when the source has none (labelled placeholder block, never fabricated reviews or ratings) -->
- **Copy guidance:** <!-- TODO (author) -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### gallery
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): before/after pairing, captions, how many placeholder slots -->
- **Copy guidance:** <!-- TODO (author): caption format; only project types the source mentions -->
- **Placeholder imagery labels:**
  - <!-- TODO (author): e.g. "Project photo: before/after <project type>" -->

### process
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): ordered steps from first contact to finished job; where a recurring or seasonal plan is described if the source has one -->
- **Copy guidance:** <!-- TODO (author) -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### faq
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): question-form H3s, one short paragraph each, mirrored into FAQPage.mainEntity -->
- **Copy guidance:** <!-- TODO (author): answer only from the source; otherwise a placeholder answer with no numbers -->
- **Placeholder imagery labels:**
  - none

### contact
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): tel link, quote form fields, service area statement, hours, address if the source has one -->
- **Copy guidance:** <!-- TODO (author): service area and hours verbatim from the source or facts; placeholder if absent -->
- **Placeholder imagery labels:**
  - <!-- TODO (author): e.g. "Map placeholder: service area" -->

## FAQ seeds
<!-- TODO (author): question-form only, no answers, no numbers. These are prompts for the builder; it answers from the source or marks the answer placeholder. -->
- <!-- TODO (author) -->

## Vocabulary to use / avoid
- **Use:** <!-- TODO (author): the words this persona searches and says -->
- **Avoid:** <!-- TODO (author): jargon, superlatives, and any phrasing that implies an unverified claim -->

## Checklist coverage
<!-- TODO (author): every row below is a proposal: ids, source, check, weight, and scope are copied from personas/funeral-homes.md and personas/_common.md; section and satisfying element are derived from the scaffold's structure. Confirm each row; resolve every TODO cell. -->
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | tag `<main>`; every section's `<h2>` is descriptive |
| C-answer-first | common | judgment | med | home | main | tag `<main>`; the first `<p>` of every section answers its `<h2>` |
| faq-present | common | deterministic | med | subpath | faq | `<section id="faq">` with question-form `<h3>`s + short answers |
| tel-link-above-fold | persona | deterministic | high | home | hero | `<a href="tel:…">` inside `<header>` (offline static rule) |
| FH-24-7 | persona | judgment | high | home | hero | TODO — "24/7" or "available any time" is stated next to the phone number in the first mobile screen |
| sticky-mobile-cta | persona | deterministic | high | home | hero | the `.sticky-bar` with inline `position:fixed; bottom:0` (offline static rule) |
| FH-immediate-need | persona | judgment | high | subpath | services | TODO — an "immediate need" page or section says what to do right now, step by step |
| FH-obituaries | persona | judgment | high | home | gallery | TODO — an obituary listing with search is reachable from the home page, with photo, service details, guestbook, or flower ordering |
| FH-service-options | persona | judgment | high | subpath | services | TODO — service options include cremation, green burial, and celebrations of life |
| FH-pricing | persona | judgment | high | subpath | services | TODO — the General Price List or package pricing is published online |
| FH-preplanning | persona | judgment | med | subpath | contact | TODO — pre-planning is explained with payment options, plus a planning guide download or a pre-arrangement form |
| FH-staff-heritage | persona | judgment | med | subpath | trust | TODO — staff bios include licenses and tenure, and family ownership history is told |
| FH-livestream | persona | judgment | med | subpath | services | TODO — livestreaming of services is offered |
| FH-veterans | persona | judgment | low | subpath | services | TODO — veterans' services are described |
| FH-grief-resources | persona | judgment | low | subpath | services | TODO — grief resources are provided |
| FH-faq-topics | persona | judgment | med | subpath | faq | TODO — fAQs cover cost, timing, and what to bring |
| FH-real-imagery | persona | judgment | med | home | gallery | TODO — imagery shows real staff and real facilities (chapel, gathering room, exterior) rather than generic stock |
| FH-readability | persona | judgment | med | home | contact | TODO — type is large and navigation simple for an older, stressed visitor on a phone |
| address-present | persona | deterministic | med | home | contact | `<address>` from `facts.address` or the source; placeholder block if absent |
| hours-present | persona | deterministic | low | subpath | contact | hours from `facts.hours` or the source; placeholder block if absent |
| jsonld-localbusiness | persona | deterministic | low | home | head | the archetype node in the `@graph` |
