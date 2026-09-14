# generic

<!-- TODO (author): this file is the industry layer on top of references/archetypes/generic.md, used when the classifier could not place the business. Fill every heading; keep the H2s exactly as they are (the builder parses them). Make the fewest assumptions; no invented facts, no numbers. -->

## Visitor priorities
<!-- TODO (author): 3–5 bullets, in order, derived from personas/generic.md "What this visitor is trying to do" (what the business does, is it for me, how to contact). No numbers. -->
- <!-- TODO (author) -->

## Sections
<!-- TODO (author): one ### block per section in the archetype's section order. Use the scaffold ids as the ### text. -->

### hero
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): the H1 must say what the business does and for whom; one primary CTA -->
- **Copy guidance:** <!-- TODO (author): pull the positioning sentence from the source home page; do not sharpen it beyond what the source supports -->
- **Placeholder imagery labels:**
  - <!-- TODO (author): e.g. "Hero photo: <what the asset should show>" -->

### services
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author) -->
- **Copy guidance:** <!-- TODO (author): use only offerings named on the source pages -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### trust
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author): only proof present in the source (reviews, named clients, credentials, years in business); otherwise a labelled placeholder block -->
- **Copy guidance:** <!-- TODO (author) -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### gallery
- **Purpose:** <!-- TODO (author): or state that this section is dropped for generic when no gap routes to it -->
- **Required elements:**
  - <!-- TODO (author) -->
- **Copy guidance:** <!-- TODO (author) -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

### process
- **Purpose:** <!-- TODO (author) -->
- **Required elements:**
  - <!-- TODO (author) -->
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
  - <!-- TODO (author): tel link, contact form fields, address or service location -->
- **Copy guidance:** <!-- TODO (author): address verbatim from facts or the source; placeholder if absent -->
- **Placeholder imagery labels:**
  - <!-- TODO (author) -->

## FAQ seeds
<!-- TODO (author): question-form only, no answers, no numbers. Keep these industry-neutral (what do you do, who do you work with, how do I get in touch, where are you). -->
- <!-- TODO (author) -->

## Vocabulary to use / avoid
- **Use:** <!-- TODO (author): plain words; mirror the source's own terms for its offerings -->
- **Avoid:** <!-- TODO (author): superlatives and any phrasing that implies an unverified claim -->

## Checklist coverage
<!-- TODO (author): every row below is a proposal: ids, source, check, weight, and scope are copied from personas/generic.md and personas/_common.md; section and satisfying element are derived from the scaffold's structure. Confirm each row; resolve every TODO cell. -->
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | tag `<main>`; every section's `<h2>` is descriptive |
| C-answer-first | common | judgment | med | home | main | tag `<main>`; the first `<p>` of every section answers its `<h2>` |
| faq-present | common | deterministic | med | subpath | faq | `<section id="faq">` with question-form `<h3>`s + short answers |
| tel-link | persona | deterministic | high | home | header | `<a href="tel:…">` inside `<header>` |
| G-what-they-do | persona | judgment | high | home | hero | the `<h1>` + opener `<p>` |
| G-primary-cta | persona | judgment | high | home | hero | the primary CTA `<a>` in the first screen |
| contact-form | persona | deterministic | med | subpath | contact | the `<form>` |
| G-trust | persona | judgment | med | subpath | trust | TODO — only proof present in the source; otherwise a labelled placeholder block that stays failing |
| address-present | persona | deterministic | low | subpath | contact | `<address>` from `facts.address` or the source; placeholder block if absent |
