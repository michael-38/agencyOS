# Product

<!-- impeccable:product-schema 1 -->

<!-- CLIENT RECORD — Utah Aesthetic Surgery. Patient-facing (B2C).
     NOT seeded from templates/med-spa/, because that template is AgencyOS's B2B
     *pitch* page aimed at med spa owners. This surface is aimed at patients.
     The visual world IS inherited from med-spa (see DESIGN.md in this directory).

     Every fact below is transcribed from repo evidence — primarily
     concierge-prompt.md and source-content/, which are the practice's own
     published content. Nothing here is inferred. Confirm with the client
     before treating any of it as current. -->

## Platform

web

## Stack

Static HTML/CSS (`index.html`) with the AI concierge on the shared `serve.js` + `concierge.json` + `concierge-prompt.md`. Scraped source material in `source-content/`. An audit dashboard for the incumbent site is at `audit-report.html`.

## Users

Prospective plastic surgery patients in the South Jordan / Salt Lake City area, researching a specific procedure they are already considering. They arrive with a goal in mind ("tummy tuck after weight loss", "breast augmentation"), and they are:

- **Price-anxious.** Cosmetic surgery is elective and out-of-pocket. They want a number before they will call, and they distrust practices that hide one.
- **Risk-aware.** They are researching a surgeon, not a service. Board certification, facility accreditation, and the surgeon's own credentials carry more weight than any design decision.
- **Privacy-sensitive.** Many are researching without telling anyone. Nothing on the surface should feel like it exposes them.
- **Long-consideration.** Weeks to months of research across multiple practices, RealSelf, and reviews. This is not an emergency vertical — the opposite of plumbing.

## Product Purpose

Convert a researching patient into a **booked free, no-obligation consultation** with Dr. Rodrigues. That consult is the conversion event; the surgery is not sold on the page.

## Positioning

The practice of **Dr. Robert Rodrigues, a double board-certified plastic surgeon** in South Jordan, Utah.

The differentiating mechanism, as published: the free consultation produces a **customized surgical plan and a written, itemized price quote** — surgeon, anesthesia, and accredited-facility fees included, with no hidden costs — and the visitor meets Dr. Rodrigues personally, with no pressure to book. Published "starting from" prices appear on the page; the exact figure always comes from the written quote.

That combination — a named double board-certified surgeon, published starting prices, and an itemized all-in written quote — is what a competitor advertising "from $X" without the surgeon or the fee breakdown cannot truthfully match.

## Operating Context

- Contact: **(801) 810-0761**, plus a request form on the page. Both must reach the consultation booking.
- Published starting prices in evidence include breast augmentation from $6,500, tummy tuck from $7,500, and BBL from $8,500. The full procedure list with recovery windows and price ranges is in `concierge-prompt.md` — treat that file as the authoritative service list and keep the page in sync with it.
- Financing is offered and is a real part of the decision at these price points.
- The AI concierge is live on this surface and is bound by the medical-advice rule below.

## Capabilities and Constraints

**The binding constraint on this surface is medical:**

- The site and its concierge **must not provide medical advice** — no diagnoses, no candidacy determinations, no individualized risk assessment, no surgical or anesthesia recommendations, no pre-op or post-op instructions, no medication guidance, and no interpretation of a visitor's history, symptoms, photos, or imaging.
- Everything is framed as general information about procedures the practice offers, never as a recommendation for a specific visitor. Any candidacy, safety, or "is this right for me" question routes to the free consultation.
- Prices are published **"starting from"** figures. The page may never present one as a final or guaranteed price.
- Before/after imagery in this vertical carries consent and state-advertising obligations. Do not add, crop, retouch, or reuse patient imagery without written confirmation that consent covers that use.

## Brand Commitments

Editorial-clinical world inherited from `templates/med-spa/DESIGN.md`, with the practice's own accent and muted tokens — see `DESIGN.md` in this directory. Fraunces + Inter Tight, warm cream ground, terracotta accent.

## Evidence on Hand

- `concierge-prompt.md` — procedures, published starting prices, recovery windows, financing, the consultation offer, and the medical-advice rule. The richest and most reliable record here.
- `source-content/` — scraped pages from the incumbent site, including "Meet the Doctor", "Contact Us", and per-procedure pages.
- `audit-report.html` — the audit CLI's findings on the incumbent site.
- `images/` — assets currently in the build.

**Absences future work must not fabricate:** patient testimonials, review counts and ratings, before/after pairs, complication or satisfaction statistics, procedure volumes, years in practice, hospital affiliations, and any board or society membership beyond the published "double board-certified". These are medical advertising claims about a named physician and several are regulated. If the client has not supplied one, leave a visible placeholder.

## Product Principles

1. **The consultation is the ask.** Every path leads to booking it; nothing else competes.
2. **Publish the starting price.** Price transparency is the trust mechanism in this vertical, not a risk.
3. **The surgeon is the product.** Credentials and the personal consult outrank any visual flourish.
4. **Never give medical advice.** Route to the consult, without exception.
5. **No fabricated proof.** In a regulated medical vertical this is a legal exposure, not a style rule.

## Accessibility & Inclusion

WCAG AA per `/DESIGN.md`. Two vertical-specific notes: the inherited cream/terracotta palette is the lowest-contrast in the repo and every text/background pair must be measured rather than assumed; and body-related content should avoid imagery or copy that reads as judgmental about the visitor's current appearance.
