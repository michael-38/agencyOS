# Product

<!-- impeccable:product-schema 1 -->

<!-- SEEDED from templates/med-spa/PRODUCT.md, then REWRITTEN.
     The med-spa archetype is AgencyOS's own B2B pitch record aimed at med spa OWNERS.
     This client's surface is patient-facing, so every section below was rewritten
     against patients. The med-spa DESIGN.md (editorial/premium visual world) was kept.
     Facts here trace to source-content/ only. Anything unsourced is marked
     [CONFIRM] and must not ship until the client verifies it. -->

## Platform

web

## Stack

A single self-contained `index.html` per version — inline `<style>`, no build step, no
framework, self-hosted fonts. Deployed to Cloudflare Pages via `scripts/deploy-pages.sh`.

## Users

**Prospective aesthetic surgery patients in the Salt Lake valley**, not clinic owners.
They arrive mid-research, usually comparing two to four surgeons, and are making a
high-cost, irreversible, appearance-altering decision. Three recurring jobs, all evidenced
by the services the practice actually publishes:

- **Post-pregnancy or post-weight-loss body restoration** — tummy tuck, BBL, breast
  augmentation, liposuction. Often the largest emotional driver.
- **Facial rejuvenation** — facelift/neck, rhinoplasty, blepharoplasty, Morpheus8.
- **Revision cases** — patients whose prior surgery elsewhere needs correcting. The
  practice's reconstructive background is the specific reason they land here.

Visitor psychology, evidenced by the practice's own published reviews:

- **Fear of looking "done."** The practice's stated philosophy answers this directly:
  results that "still allow you to look like yourself."
- **Fear of being upsold.** Multiple published reviews independently praise him for
  *discouraging* a procedure — one says he "even discouraged me from the procedure that
  would have made him more money."
- **Credential scrutiny.** This audience checks training. The training page is a
  conversion asset, not an about-page afterthought.

## Product Purpose

Convert a researching patient into a **booked consultation**.

Primary conversion is the phone call — `801-810-0761` is the single repeated CTA across
every page of the current site. Secondary is the appointment form. There is no online
booking calendar and no published pricing, so the page's job ends at "make contact," not
"transact."

## Positioning

**Reconstructive-trained, artistically motivated, and willing to tell you no.**

Three claims the practice can make that a high-volume cosmetic competitor cannot:

1. **Training depth** — University of Colorado School of Medicine; integrated plastic
   surgery training at Case Western Reserve and the University of Michigan; advanced
   fellowship at Mayo Clinic; over two decades of surgical experience.
2. **Reconstructive foundation** — breast reconstruction, complex wound reconstruction,
   hand and wrist surgery, before elective aesthetics. Their own argument: this is what
   makes revision work possible, and it is a real differentiator against surgeons who
   entered cosmetic practice directly.
3. **Restraint as the aesthetic** — "natural, balanced results that remain beautiful over
   time," explicitly against trends and exaggerated features.

## Operating Context

The patient is comparing this practice against high-volume cosmetic clinics and med spas
offering the same procedure names at lower prices. Proof currency, in order of weight:
**before/after imagery**, then **verbatim patient reviews**, then **credentials**. Price is
not a lever the practice has chosen to pull — nothing is published.

## Capabilities and Constraints

Sourced and safe to use: full procedure list, credential and training history, 13 verbatim
reviews with first names and month/year, published NAP and hours, before/after gallery.

**Absences that must not be fabricated:**

- **[CONFIRM] Board certification.** The site says "board-certified" and, in one place,
  "double board-certified precision," but never names the certifying board. Ship the
  practice's own wording or nothing; do not name ABPS or any board.
- **[CONFIRM] Aggregate rating and review count.** No star rating or review total is
  published anywhere. Do not invent "4.9 from 127 reviews."
- **[CONFIRM] Pricing, financing, and payment plans.** None published.
- **[CONFIRM] Years-in-business as a practice.** "Over two decades of surgical experience"
  is about the surgeon, not the clinic's founding date. Do not convert one into the other.
- **[CONFIRM] Staff beyond Dr. Rodrigues.** Reviews reference "his PA, MAs, and
  estheticians," but no named team exists on the site.

## Brand Commitments

Medical-claims discipline outranks persuasion everywhere. No outcome guarantees, no
"permanent" or "risk-free," no implied clinical superiority that isn't published, no
before/after presented as typical. Patient reviews ship verbatim with the first name and
date as published, never edited for punch.

## Evidence on Hand

- 13 verbatim reviews, first name + month/year, published on the practice's own site.
- 63 real photographs harvested from the practice's site, including the before/after set.
- A documented training pathway and a stated surgical philosophy in the surgeon's own words.

## Product Principles

1. **Credentials early.** This audience scrutinizes training before aesthetics.
2. **One phone number, everywhere, tappable.** It is the practice's only real conversion.
3. **Restraint mirrors the offer.** A page promising natural, un-overdone results cannot
   itself be loud. The design is an argument for the surgery.
4. **Real photography only.** No stock, no generated imagery, no illustrated stand-ins for
   surgical results.
5. **Never fabricate a medical claim** to fill a section. Cut the section instead.

## Accessibility & Inclusion

WCAG AA per `/DESIGN.md`. Specific to this surface: before/after imagery needs descriptive
alt text that does not editorialize about bodies; the phone number must be a `tel:` link
with tabular numerals; and nothing load-bearing may depend on hover, since this audience
skews mobile.
