# Product

<!-- impeccable:product-schema 1 -->

<!-- SEEDED from templates/med-spa/PRODUCT.md, then REWRITTEN.
     The med-spa archetype is AgencyOS's own B2B pitch record aimed at med spa OWNERS.
     This surface is patient-facing, so every section below was rewritten against
     prospective patients. prep-report.json set audienceRewriteRequired: true.
     Facts trace to source-content/ only; every [CONFIRM] item in fact-sheet.md must
     not ship. Re-seed with:
     node .impeccable/seed-client.mjs med-spa clients/labellevie-medspa --force -->

## Platform

web

## Stack

One self-contained `index.html` per version — inline `<style>`, no build step, no framework,
self-hosted fonts, images from `assets/`. Two independent builds live in `versions/a` and
`versions/b`, with a comparison page in `versions/compare`. Deployed to Cloudflare Pages via
`scripts/deploy-pages.sh`.

## Users

**Prospective patients in and around Draper, Utah — people considering a treatment for
themselves. Not clinic owners, not operators, not anyone evaluating the practice as a business.**

Primarily women, roughly 30 to 60, arriving in one of four distinct states:

- **Curious but hesitant.** The practice's owner writes an entire article to this person: *"I know
  that for a lot of people, the idea of walking into a 'med spa' feels a little intimidating. You
  might be worried about looking 'plastic,' or maybe you're concerned that it's all just vanity."*
  She names the exact fear — being talked into too much, and coming out looking different rather
  than rested. This is the single best-evidenced visitor on the whole site.
- **Specific and researching.** Arrives on Sculptra, Renuva, laser, or PDO threads with a named
  procedure already in mind, comparing providers on competence rather than price.
- **Struggling with weight.** Arrives via the Ozempic content, often already on a GLP-1 prescribed
  elsewhere, looking for guidance rather than another prescription.
- **Dealing with something private.** Sexual wellness, post-augmentation implant rippling, urinary
  leakage, erectile dysfunction. This visitor needs discretion, plain language, and no sense of
  being sold to. The practice's own framing is *"expertise, compassion, and discretion"* in a
  *"supportive, judgment-free environment."*

What the site tells us about their psychology, in the practice's own words:

- **They fear the overfilled look.** *"We've all seen the 'overfilled' look on social media, and
  honestly? We're not fans of it either."* Restraint is the product.
- **They fear the conveyor belt.** *"One of the reasons people feel hesitant is the 'conveyor belt'
  feel of some big med spa chains."*
- **They want to know it will not hurt.** The comfort question is answered explicitly on three
  separate pages.
- **They feel silly for caring.** *"I've sat across from women in my office who whisper, 'I feel
  silly being upset about this.' But you are not silly. You're human."*

A page that addresses an owner, an operator, or a buyer of marketing services is wrong for every one
of these people.

## Product Purpose

Convert a hesitant researcher into a **booked free consultation**.

Three published paths, in order of how well they suit this audience:

1. **Call 801-987-8384** — the single most repeated call to action on the site, present on every
   page.
2. **Book online** via Podium (`booking.podium.com/medspa/019805bd-0a79-7949-8a5f-284144f5b4e0`),
   which has per-treatment deep links.
3. **Free Virtual Consultation** via the contact page — the lowest-commitment option, and the right
   one for the private-concern visitor who is not ready to walk in.

The consultation is free, it is the practice's own standing offer, and it is stated on nearly every
page. It is the ask. There is no secondary conversion goal.

## Positioning

**One nurse practitioner, thirty years of medical experience, treating you as a neighbor rather
than a chart number.**

Kelly Lance, MSN, APRN, FNP-C is the owner, the primary practitioner, the author of the site's
content, and the only named person on it. That is not a limitation to work around — it is the
positioning. The whole site is one person's voice, and its distinctiveness is the practice's actual
competitive asset against the chains it explicitly positions against.

Her stated philosophy is **"Artistic Restoration"**: *"We aren't trying to give you a 20-year-old's
face; we're trying to give you your face on its very best day."*

Three claims the source supports and a chain competitor cannot copy:
- **Medical oversight is personal.** *"Because I am a Nurse Practitioner, your safety and medical
  history are always the top priority."*
- **No packages, no upsell script.** *"We don't just sell 'packages.' We create a roadmap that is
  specific to your face and your goals."*
- **She turns business away.** The practice does not prescribe Ozempic and says so twice, in the
  middle of its own weight-loss content. That is the most credible sentence on the site.

## Operating Context

The visitor is comparing La Belle Vie against other Salt Lake County med spas, injector-run studios,
and chains — most of which compete on promotions and unit pricing.

**This page has almost no conventional proof to spend.** There are zero published reviews, zero star
ratings, zero awards, zero before/after images, and no photograph of the provider. Confirmed by a
full sweep of all ten crawled pages. Every reflex a med spa page usually reaches for is unavailable.

So the proof currency, in order, is:
1. **Kelly Lance by name, credentials, and thirty years.**
2. **Her own writing**, which is specific, self-deprecating, and unlike competitor copy. Long
   verbatim passages are on hand and are the most persuasive material available.
3. **The named device and product roster** — Harmony®XL, Profound by Syneron, Sculptra®, Renuva,
   CoolSculpting, Hair-Free™, Clitoxin®, PDO threads. Specificity substitutes for social proof.
4. **The free consultation and the free virtual consultation.**
5. **The live August 2026 promotion**, which expires 08/31/2026 and must carry its own expiry.

Price is not a lever: no standard price is published for any service.

## Capabilities and Constraints

**Sourced and safe to ship:** business name, address, phone, email, five days of published hours,
both booking systems, three social profiles, nine service categories with the practice's own
descriptions, six signature services verbatim, seven laser treatments verbatim, full Sculptra /
Renuva / Clitoxin / O-Shot detail, the medical weight-loss framework, three published FAQ answers,
three lines of policy fine print, Kelly Lance's title and credentials, and 31 harvested images.

**Absences that must not be fabricated** — the full 25-item list is in `fact-sheet.md` under
"Explicitly NOT available". The load-bearing ones:

- **No reviews or testimonials of any kind.** Neither version may contain a testimonial section,
  a placeholder quote, a star rating, or a review count.
- **No awards, badges, or press.** No "as seen in" band.
- **No prices**, and the site contradicts itself on the first-treatment discount ($50 in three
  places, $100 in two). Ship "free consultation" with no dollar figure.
- **No founding year.** The "11 Year Anniversary" trace is image alt text, not published copy.
- **No second team member.** The copy says "Nurse Practitioners" plural but names one person.
- **No provider photograph, no logo file, no interior photography, no before/after images.**
- **No weekend hours** — render the five published days, not "Closed" for Saturday and Sunday.

**Hard content constraints specific to this practice:**

- **Never imply GLP-1 prescribing.** *"At La Belle Vie, we don't prescribe Ozempic."* Stated twice.
  What is offered is a guided medical weight-loss program and education alongside medication
  prescribed elsewhere. No injection imagery, no "GLP-1 program", no pounds-lost claims.
- **Sexual-wellness services are real services and are recorded factually.** Clitoxin® and the
  O-Shot are published, and both may appear. They belong in the same clinical register as Sculptra
  and lasers — plain service names, source-derived benefit language, neutral imagery. No euphemism,
  no innuendo, no suggestive photography, no coy headline play, and no quarantining them into a
  separate "spicy" zone. Clitoxin ships with the practice's own disclaimer attached: *"results are
  not guaranteed with this therapy."*
- **The O-Shot page dates from 2020 and is written far more crudely than the rest of the site.** Use
  only its clinical paragraphs and its candidate list. Carry none of its voice.
- **Thirteen published claims are flagged in the fact sheet's risk register**, including "pain-free
  way to permanently eliminate hair", "these little miracles", "boost your self-esteem immediately",
  and "we can fix it". Omit or soften each; do not footnote and keep.
- **Their own typos are theirs, not ours.** "Jeveau" is Jeuveau; "C02" is CO2; "Its called Renuva"
  needs an apostrophe; the home page ships an unedited Elementor placeholder heading. Fix silently,
  reproduce nothing.

## Brand Commitments

Medical-claims discipline outranks persuasion, every time. No outcome guarantees. No "permanent".
No "pain-free". No implied physician oversight — there is no physician on this site. A general
qualifier belongs on both versions: *individual results vary; a consultation determines
candidacy.* That is consistent with the practice's own published caveats and invents nothing.

Discretion is a brand commitment, not a design flourish. Intimate services are described in the
words a clinician would use with a patient, and never in the words an advertiser would use to sell.

Five of the 31 harvested images carry Shutterstock copyright in their EXIF, one of them
Shutterstock AI stock. The client's licence covers the client's own site, not an agency-hosted
demo. Prefer the other 26; flag any of the five that ships.

## Evidence on Hand

- **Kelly Lance's own writing** across five long-form pages — the strongest asset available, and
  effectively a voice guide.
- **Roughly fifty named treatments, devices and brands**, most with the practice's own descriptions.
- **31 harvested images** from the client's own WordPress uploads, provenance in
  `assets/PROVENANCE.txt`, including twelve treatment/condition headers and two pieces of
  promotional artwork with real published offers baked in.
- **Complete, single-location NAP** with five days of hours.
- **The observed brand marks** — script "La Belle Vie" wordmark with a daisy glyph, and a
  black / white / saturated-yellow promotional palette.

**Absences future work must not fabricate:** reviews, ratings, awards, prices, financing,
memberships, founding year, staff beyond one person, certifying bodies, patient volume,
before/after results, and any second location.

## Product Principles

1. **One practitioner is the story.** Kelly Lance by name, credentials, and voice — not a faceless
   "our team of experts". It is the only proof asset that exists.
2. **Her words beat our words.** Where a section can be built from a verbatim passage, build it from
   the verbatim passage.
3. **Specificity substitutes for social proof.** With no reviews to spend, named devices, named
   mechanisms, and honest timelines carry the credibility load.
4. **Restraint is the offer.** The audience fears looking overdone. A page that shouts contradicts
   the product it is selling.
5. **The free consultation is the only ask**, and calling is the primary way to take it.
6. **Clinical register on intimate services.** Factual, discreet, unsensationalised, not hidden.
7. **Never invent proof.** No testimonial block, no rating, no badge, no price, no founding year.

## Accessibility & Inclusion

WCAG AA per the active design rulebook, plus the following, which are specific to this practice:

- The phone number is a `tel:` link with tabular numerals, reachable without a mouse, and a real
  touch target on mobile — it is the primary conversion path.
- Address and hours ship as selectable, machine-readable text, never baked into an image.
- The August specials artwork carries real offer copy inside a JPEG; it needs full alt text
  transcribing the offers and the 08/31/2026 expiry, or the offers must be set in HTML alongside it.
- Ageing, weight, and sexual-function copy must not shame. The source models this well
  (*"punishing yourself for existing in your body"*, *"you are not silly"*) — hold that standard.
- Treatment and model photography needs descriptive alt text that states what is shown without
  editorialising about the subject's face or body.
- Intimate-health sections need headings that are unambiguous when read aloud by a screen reader in
  a shared room — plain clinical names, no innuendo.
- Nothing load-bearing behind hover; every disclosure reachable by keyboard.
- Reduced-motion honoured.
