# schools-camps

<!-- TODO (author): this file is the industry layer on top of references/archetypes/local-service.md. Fill every heading; keep the H2s exactly as they are (the builder parses them). No invented industry facts, no numbers. -->

## Visitor priorities
<!-- TODO (author): 3–5 bullets, in order, derived from personas/schools-camps.md "What this visitor is trying to do" (the three questions it names, then what earns trust). No numbers. -->
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
<!-- TODO (author): every row below is a proposal: ids, source, check, weight, and scope are copied from personas/schools-camps.md and personas/_common.md; section and satisfying element are derived from the scaffold's structure. Confirm each row; resolve every TODO cell. -->
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | tag `<main>`; every section's `<h2>` is descriptive |
| C-answer-first | common | judgment | med | home | main | tag `<main>`; the first `<p>` of every section answers its `<h2>` |
| faq-present | common | deterministic | med | subpath | faq | `<section id="faq">` with question-form `<h3>`s + short answers |
| SK-prospect-first | persona | judgment | high | home | services | TODO — the home page speaks to prospective families first, with the current-family portal routed away in one click |
| SK-differentiators | persona | judgment | high | home | services | TODO — concrete differentiators are visible early (class size, ratios, outcomes; or session dates, ages, and prices for camps) rather than mission language |
| SK-inquiry-visit | persona | judgment | high | home | hero | TODO — an inquiry, open-house, visit, or registration call to action is visible in the first mobile screen |
| SK-cost | persona | judgment | high | subpath | services | TODO — tuition with financial aid share and average grant (schools) or per-session prices (camps) is published |
| SK-steps-dates | persona | judgment | high | subpath | process | TODO — admissions or registration steps and dates are listed |
| SK-safety | persona | judgment | high | subpath | trust | TODO — safety information is stated: accreditation, background checks, staff ratios, lifeguard/medical staffing, or health policies |
| SK-staff-bios | persona | judgment | med | subpath | trust | TODO — faculty or staff bios include credentials and tenure |
| SK-stories | persona | judgment | med | subpath | trust | TODO — student, parent, or camper stories or reviews are shown |
| SK-real-photos | persona | judgment | med | home | gallery | TODO — imagery shows candid students or campers in action rather than posed brochure stock |
| SK-program-finder | persona | judgment | low | subpath | services | TODO — a program finder by age or grade exists |
| SK-camp-availability | persona | judgment | low | subpath | process | TODO — for camps, remaining spots per session and a waitlist are shown |
| SK-estimator | persona | judgment | low | subpath | services | TODO — a tuition or financial-aid estimator exists |
| SK-video | persona | judgment | low | subpath | gallery | TODO — a day-in-the-life video exists |
| booking-widget | persona | deterministic | low | subpath | contact | a booking CTA `<a>` (widget scripts are not allowed offline; the CTA words satisfy the check as partial) |
| contact-form | persona | deterministic | med | subpath | contact | the `<form>` |
| tel-link | persona | deterministic | med | home | contact | an `<a href="tel:…">` anywhere on the page |
| address-present | persona | deterministic | low | subpath | contact | `<address>` from `facts.address` or the source; placeholder block if absent |
| jsonld-localbusiness | persona | deterministic | low | home | head | the archetype node in the `@graph` |
