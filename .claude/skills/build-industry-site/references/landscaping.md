# landscaping

<!-- TODO (author): this file is the industry layer on top of references/archetypes/local-service.md. Fill every heading; keep the H2s exactly as they are (the builder parses them). No invented industry facts, no numbers. -->

## Visitor priorities
<!-- TODO (author): 3–5 bullets, in order, derived from personas/landscaping.md "What this visitor is trying to do" (the three questions it names, then what earns trust). No numbers. -->
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
<!-- TODO (author): every row below is a proposal: ids, source, check, weight, and scope are copied from personas/landscaping.md and personas/_common.md; section and satisfying element are derived from the scaffold's structure. Confirm each row; resolve every TODO cell. -->
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | tag `<main>`; every section's `<h2>` is descriptive |
| C-answer-first | common | judgment | med | home | main | tag `<main>`; the first `<p>` of every section answers its `<h2>` |
| faq-present | common | deterministic | med | subpath | faq | `<section id="faq">` with question-form `<h3>`s + short answers |
| tel-link-above-fold | persona | deterministic | high | home | header | `<a href="tel:…">` inside `<header>` (offline static rule) |
| LS-quote-cta | persona | judgment | high | home | hero | the primary CTA `<a>` in the first screen |
| LS-services-clear | persona | judgment | high | home | services | TODO — the services list; must sit within the first two mobile screens |
| LS-service-area | persona | judgment | high | home | TODO (hero or contact) | the sentence naming the service area, verbatim from the source |
| above-fold-images | persona | deterministic | med | home | hero | inline `<svg role="img">` placeholder inside the first `<main> > section` (offline static rule) |
| review-markup | persona | deterministic | med | home | trust | only real reviews/ratings from the source as structured data; otherwise a labelled placeholder block that stays failing |
| jsonld-localbusiness | persona | deterministic | med | home | head | the `LocalBusiness` node in the `@graph` |
| LS-project-gallery | persona | judgment | high | subpath | gallery | labelled before/after placeholder pairs; project types only from the source |
| contact-form | persona | deterministic | med | subpath | contact | the `<form>` |
| hours-present | persona | deterministic | low | subpath | contact | hours from `facts.hours` or the source; placeholder block if absent |
| LS-maintenance-plan | persona | judgment | low | subpath | TODO (process or services) | the paragraph describing a recurring/seasonal plan, only if the source has one |
