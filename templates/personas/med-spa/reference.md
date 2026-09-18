# med-spa

## Visitor priorities
- Which treatment addresses *my* concern — arriving either by the concern or by the treatment name,
  so both paths have to exist.
- Who performs it and what they are qualified to do, in detail, because the anxiety is medical.
- What it costs, per unit or starting at, and whether it can be financed.
- What the result actually looks like on someone their own age, and what recovery involves.
- Booking from the practice's own scheduling software, in the same session, without a phone call.

## Sections
### hero
- **Purpose:** Establish within one screen that this is a medical practice, what it treats, and
  where, with booking one tap away.
- **Required elements:**
  - The `<h1>` naming the practice, its category, and its city.
  - An opening sentence answering "what is this place and who runs it?".
  - The booking action, plus the tel link in the header.
  - A photograph of the real practice or the real provider.
- **Copy guidance:** Take the practice's own description of itself. Never add an outcome claim the
  source does not make, and never soften a missing credential into "expert" or "specialist".
- **Placeholder imagery labels:**
  - "Hero photo: the practice's own treatment room or its provider"
### services
- **Purpose:** Let the visitor arrive by concern or by treatment name and land in the same place.
- **Required elements:**
  - Treatments grouped by the concern they address, each treatment named as the source names it.
  - One sentence per treatment describing what it addresses, from the source.
- **Copy guidance:** Use the source's treatment names, including brand names it already uses. Do
  not describe a mechanism, a dosage, a duration, or a recovery time the source does not state.
- **Placeholder imagery labels:**
  - "Treatment photo: the treatment being performed in this practice"
### trust
- **Purpose:** Answer the safety question in the visitor's own terms.
- **Required elements:**
  - Provider credentials exactly as the source states them, including the medical director.
  - Products, devices, and manufacturer training named as the source names them.
  - A labelled placeholder block when the source states no credentials, tagged and left failing.
- **Copy guidance:** Credentials are quoted, never paraphrased or upgraded. If the source names a
  person, name that person.
- **Placeholder imagery labels:**
  - "Provider photo: the named provider, in the practice"
### gallery
- **Purpose:** Show results for the specific treatment, which is what the visitor is really here for.
- **Required elements:**
  - Before/after pairs grouped by treatment, each captioned with the treatment name.
- **Copy guidance:** Captions name only the treatment. Never add a session count, a timeframe, a
  patient age, or a product quantity the source does not state.
- **Placeholder imagery labels:**
  - "Before/after: the practice's own result for a treatment the source names"
### process
- **Purpose:** Remove the unknowns between booking and walking out.
- **Required elements:**
  - Consultation, treatment, and aftercare as ordered steps, one sentence each.
- **Copy guidance:** Only steps the source describes. No downtime claims, no pain descriptions, no
  "most patients" statements.
- **Placeholder imagery labels:**
  - "Process photo: the consultation room"
### faq
- **Purpose:** Answer the safety, price, and recovery questions that otherwise stop the booking.
- **Required elements:**
  - Question-form headings, each answered in one to three self-contained sentences.
- **Copy guidance:** Where the source is silent — and it often is on price and recovery — write a
  short placeholder answer that points at the consultation and states no number.
- **Placeholder imagery labels:**
  - none
### contact
- **Purpose:** Book, not enquire.
- **Required elements:**
  - The booking action first, the tel link second, a form only as a fallback.
  - Address and hours when the source states them.
- **Copy guidance:** If the source books through a named scheduling product, say so and link to it
  as the source links to it.
- **Placeholder imagery labels:**
  - "Map placeholder: the practice location"

## FAQ seeds
- Who performs the treatments here?
- Is a consultation required before treatment?
- What does a treatment cost?
- Is financing available?
- What should I expect at my first visit?
- How do I know which treatment is right for my concern?
- Which products and devices do you use?
- How do I book?

## Vocabulary to use / avoid
- **Use:** treatment, concern, consultation, provider, injector, medical director, aesthetic,
  before and after, per unit, starting at, financing, the treatment and product names the source
  already uses, the city the source names.
- **Avoid:** "permanent", "guaranteed", "risk-free", "miracle", "instant" — this persona reads
  outcome guarantees as a red flag, and a med-spa persona item fails the page for them; "anti-aging
  solutions"; "rejuvenation journey"; any credential, qualification, board certification, or
  training the source does not state; any price the source does not publish.

## Design direction
- **Mood:** Editorial and clinical at once — a magazine spread with a medical licence on the wall.
  This visitor is spending real money on their own face or body and is scanning for seriousness, so
  restraint reads as competence and decoration reads as risk. Calm, precise, expensive-feeling,
  never cute and never clinical-cold.
- **Palette:** A warm off-white or soft neutral ground rather than pure white, deep near-black ink,
  and one muted accent — a terracotta, a clay, a dusty rose — used sparingly for emphasis and the
  booking action. No gradients. No more than one accent.
- **Type:** A serif or high-contrast display face paired with a quiet neutral sans for body text,
  and optionally a monospace for metadata such as prices and treatment durations. The display face
  is the whole personality; let it be large. Body stays modest and highly legible.
- **Density and rhythm:** Airy, with a wider container than a utility page would use and long
  vertical gaps between sections. Whitespace is the luxury signal; resist filling it.
- **Hero form:** Editorial — a large display headline with generous margin, the photograph beside
  or beneath it rather than behind it. Text over a photograph reads as an advertisement here.
- **Motion:** Minimal. A slow fade on entry at most. Nothing that bounces, nothing that counts up,
  and nothing at all under reduced motion.
- **Proof:** Credentials are set as text, with the provider's name and qualification given room —
  not compressed into a badge row. Before/after pairs are presented at a consistent size and
  alignment, captioned, never in a carousel that hides them.
- **Imagery:** The practice's own rooms, its own providers, its own results. Portrait and square
  crops, soft natural light, minimal retouching. Where the source has no usable photography, prefer
  an honest labelled placeholder over a generic interior — a generic stock or AI-generated-looking
  image is exactly what this visitor discounts.
- **Avoid:** Purple-to-pink gradients; lotus, leaf, and sparkle motifs; a model with her eyes
  closed touching her own cheek; countdown offers; script fonts; "as seen in" logo walls.

## Page architecture
- **Generate:** one page per treatment the source describes with real substance; one page per
  concern when the source groups treatments that way; one page per city or neighbourhood the source
  explicitly says it serves; one FAQ page once there are three or more sourced questions.
- **Home page answers:** "What does this practice treat, who performs it, and how do I book?"
- **Query intents:**
  - med spa near me
  - <treatment name> in <city>
  - what treatment is best for <concern>
  - how much does <treatment name> cost
  - who injects in <city>
  - <treatment name> before and after
- **Entities to name:** every treatment by the source's own name, including brand names it already
  uses; every provider name and qualification exactly as written; the medical director; the city;
  the scheduling product the practice books through.
- **Internal linking:** the home page links to every concern page and treatment page; each concern
  page links to the treatments that address it; each treatment page links back to its concern and
  to the booking action; the FAQ links to the treatment page each answer concerns.

## Checklist coverage
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| MS-navigate-by-concern | persona | judgment | high | home | services | the concern grouping above the treatment list |
| booking-widget | persona | deterministic | high | home | contact | the booking action linking to the source's own scheduling product; a labelled placeholder that stays failing when the source has none |
| tel-link-above-fold | persona | deterministic | high | home | header | the `<a href="tel:…">` inside `<header>` |
| MS-treatment-detail | persona | judgment | high | subpath | services | the generated treatment pages |
| MS-pricing | persona | judgment | high | subpath | services | the per-unit or starting-at price, only when the source publishes one; otherwise a labelled placeholder that stays failing |
| MS-provider-credentials | persona | judgment | high | subpath | trust | the provider credential block, quoted from the source |
| MS-before-after | persona | judgment | med | subpath | gallery | the before/after pairs grouped by treatment |
| MS-financing | persona | judgment | med | subpath | contact | the financing sentence, only when the source names a financing provider |
| MS-safety-products | persona | judgment | low | subpath | trust | the products and devices list, named as the source names them |
| MS-real-people | persona | judgment | med | home | hero | the hero photograph of the real practice or provider |
| MS-provider-video | persona | judgment | low | subpath | trust | the provider introduction, or its labelled placeholder |
| MS-concern-finder | persona | judgment | low | subpath | services | the concern index on the services page |
| MS-no-prohibited-claims | persona | judgment | med | home | main | the whole page: the fabrication gate and the vocabulary list above keep outcome guarantees off it |
| review-markup | persona | deterministic | med | home | trust | real reviews or rating from the source as structured data; otherwise a labelled placeholder block that stays failing |
| jsonld-localbusiness | persona | deterministic | med | home | head | the `LocalBusiness` node in the `@graph` |
| hours-present | persona | deterministic | low | subpath | contact | the hours block from `facts.hours` or the source; a labelled placeholder when absent |
| address-present | persona | deterministic | low | subpath | contact | the `<address>` element |
| structured-data | common | deterministic | high | home | head | the `<script type="application/ld+json">` `@graph` |
| meta-title-description | common | deterministic | med | home | head | `<title>` + `<meta name="description">` |
| single-h1 | common | deterministic | med | home | hero | the one `<h1>` |
| h2-structure | common | deterministic | med | home | main | every section's `<h2>` |
| C-answer-first | common | judgment | med | home | main | the `[data-answer-first]` opener in each section |
| faq-present | common | deterministic | med | subpath | faq | the FAQ list with question-form headings |
