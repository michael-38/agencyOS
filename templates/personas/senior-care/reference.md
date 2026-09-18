# senior-care

<!-- TODO (author): this file is the industry layer on top of references/archetypes/local-service.md. Fill every heading; keep the H2s exactly as they are (the builder parses them). No invented industry facts, no numbers. -->

## Visitor priorities
<!-- TODO (author): 3–5 bullets, in order, derived from personas/senior-care.md "What this visitor is trying to do" (the three questions it names, then what earns trust). No numbers. -->
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
<!-- TODO (author): every row below is a proposal: ids, source, check, weight, and scope are copied from personas/senior-care.md and personas/_common.md; section and satisfying element are derived from the scaffold's structure. Confirm each row; resolve every TODO cell. -->
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | tag `<main>`; every section's `<h2>` is descriptive |
| C-answer-first | common | judgment | med | home | main | tag `<main>`; the first `<p>` of every section answers its `<h2>` |
| faq-present | common | deterministic | med | subpath | faq | `<section id="faq">` with question-form `<h3>`s + short answers |
| SC-tour-cta | persona | judgment | high | home | gallery | TODO — a schedule-a-tour call to action is visible in the first mobile screen |
| tel-link-above-fold | persona | deterministic | high | home | hero | `<a href="tel:…">` inside `<header>` (offline static rule) |
| SC-care-levels | persona | judgment | high | home | services | TODO — care levels (independent, assisted, memory care, respite) are explained plainly, including what happens when needs increase |
| SC-pricing | persona | judgment | high | subpath | contact | TODO — "Starting at" pricing with an explanation of community fees and care-level tiers is published, not gated behind a form |
| SC-leadership | persona | judgment | med | subpath | trust | TODO — the executive director and director of nursing are named with their tenure |
| SC-staffing-ratios | persona | judgment | med | subpath | trust | TODO — staffing ratios are stated |
| SC-license-inspections | persona | judgment | med | subpath | trust | TODO — the state license is stated with a link to inspection results |
| SC-daily-life | persona | judgment | med | subpath | process | TODO — an activity calendar, sample menu, and floor plans with dimensions are available |
| SC-benefits-faq | persona | judgment | med | subpath | faq | TODO — fAQs cover Medicaid waivers, VA benefits, and long-term care insurance |
| SC-family-testimonials | persona | judgment | med | subpath | gallery | TODO — family testimonials are shown, preferably as video |
| SC-educational-content | persona | judgment | low | subpath | services | TODO — educational content such as "signs it's time" exists for early-stage researchers |
| SC-real-photos | persona | judgment | med | home | gallery | TODO — imagery shows real residents and staff interacting, bright interiors, food, and outdoor spaces rather than generic stock |
| SC-virtual-tour | persona | judgment | low | subpath | gallery | TODO — a 360° virtual tour or interactive floor plans exist |
| SC-readability | persona | judgment | med | home | contact | TODO — type is large and navigation simple enough for an anxious visitor or a senior on a phone |
| live-chat | persona | deterministic | low | home | trust | not satisfiable offline (vendor script); labelled placeholder block that stays failing |
| booking-widget | persona | deterministic | med | subpath | gallery | a booking CTA `<a>` (widget scripts are not allowed offline; the CTA words satisfy the check as partial) |
| review-markup | persona | deterministic | low | home | head | only real reviews/ratings from the source as structured data; otherwise a labelled placeholder block that stays failing |
| address-present | persona | deterministic | med | home | contact | `<address>` from `facts.address` or the source; placeholder block if absent |
