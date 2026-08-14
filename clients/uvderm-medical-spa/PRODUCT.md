# Product

<!-- impeccable:product-schema 1 -->

<!-- SEEDED from templates/med-spa/PRODUCT.md, then REWRITTEN.
     The med-spa archetype is AgencyOS's own B2B pitch record aimed at med spa OWNERS.
     This surface is patient-facing, so every section was rewritten against patients.
     Facts trace to source-content/ only; [CONFIRM] items in fact-sheet.md must not ship. -->

## Platform

web

## Stack

A single self-contained `index.html` per version — inline `<style>`, no build step, no framework,
self-hosted fonts. Deployed to Cloudflare Pages via `scripts/deploy-pages.sh`.

## Users

**Prospective aesthetic patients in Utah County**, not clinic owners. Mostly women, roughly 30 to
60, who have hit the limit of a home skincare routine. Crystal, in the practice's own published
review, states the job exactly: *"When I hit 40 I found my home care routine was not enough to
stop the signs of aging like dark spots and wrinkles. I needed just that extra boost that a
dermatologist and spa treatments can give."*

Three recurring jobs, all evidenced by published treatments:

- **Hold the line on ageing** — Botox, fillers, Morpheus8. The largest driver.
- **Fix skin texture and tone** — microneedling, chemical peels, HydraFacial, laser.
- **Be treated by a doctor, not a counter** — the reason this practice wins against a
  standalone spa.

Visitor psychology, evidenced by the reviews:

- **Fear of a bad injector.** Margaret has "been at this for 15 years and had many different
  injectors" and rates Dr. Myers above all of them. This audience shops injectors, not clinics.
- **Fear of commitment before understanding.** The free consultation with a Master Aesthetician
  is the practice's own answer, and it is the lowest-friction step on offer.
- **Wanting reassurance it will not hurt.** Lexi's review volunteers "pain free with the numbing
  cream" unprompted.

## Product Purpose

Convert a researching patient into a **booked free consultation**.

Two published paths, both first-class: the Klara booking link
(`https://l.klara.com/YrDQnWz9cighdPwT`), and **text or call (801) 768-8800** — the site
explicitly invites texting, which suits this audience better than a form.

## Positioning

**A dermatology practice that also does the spa work, not a spa that borrowed a doctor.**

Three claims a standalone med spa cannot make: a physician **Expert Injector** performing the
injectables; Master Aestheticians on staff, led by Mariah Webber; and dermatology under the same
roof, which is exactly what Crystal's review names as the reason she came.

## Operating Context

The visitor is comparing this against standalone med spas and injector-run studios across Utah
County, most competing on price and promotions. This practice publishes **no prices at all**, so
price is not a lever available to the page. Proof currency, in order: the physician injector,
then the verbatim reviews, then Best of Utah Valley 2025 and 2026.

## Capabilities and Constraints

Sourced and safe: treatment list, team names and roles, six verbatim reviews, three locations,
phone, email, booking link, the free-consultation offer, both award years.

**Absences that must not be fabricated** — the full list is in `fact-sheet.md` under
"Explicitly NOT available". The load-bearing ones: **no opening hours are published anywhere**,
no prices, no ratings or review counts, no phone numbers for Saratoga Springs or Provo, no
current promotion (the promotions page returned no offer text), and it is unconfirmed whether the
two other named physicians work in the med spa at all.

## Brand Commitments

Medical-claims discipline outranks persuasion. No outcome guarantees, no "permanent", no implied
clinical superiority beyond what is published. Botox timing ships only as their own published
figure, "visible improvement in 10-14 days". Reviews ship verbatim including the patients' own
spelling; they are not corrected or tightened.

## Evidence on Hand

Six verbatim reviews with first names; 25 real photographs including portraits of Dr. Myers,
Mariah Webber and Grace Barney; two award badges; a published treatment list with the practice's
own descriptions.

## Product Principles

1. **Lead with the injector, not the spa.** Every review that names a person names Dr. Myers or
   an aesthetician; none praise the room.
2. **The free consultation is the ask.** It is lower friction than any procedure page and it is
   already the practice's own offer.
3. **Texting is a first-class action**, not a fallback. The source page invites it explicitly.
4. **Real photography only.** No stock, no generated imagery.
5. **Never invent an offer.** No prices, no promotion, no hours until the client supplies them.

## Accessibility & Inclusion

WCAG AA per the active design rulebook. Specific here: the phone must be a `tel:` link with
tabular numerals; ageing-related copy must not shame; treatment photography needs descriptive
alt text that does not editorialise about faces or bodies; nothing load-bearing behind hover.
