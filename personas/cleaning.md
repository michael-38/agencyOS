---
industry: cleaning
persona_name: Homeowner who wants a price and a booking in one sitting (residential); facilities manager wanting a walkthrough (commercial)
primary_goal: See what a clean costs for my home, understand exactly what is included, feel safe letting strangers in, and book a slot without a phone call
device_bias: mobile
---

## What this visitor is trying to do

The residential buyer is one of the few local-service customers who will book online on the spot
if the site shows flat-rate pricing by bedrooms and bathrooms (or a clear hourly rate), a
"what's included" checklist per tier, and a booking flow with time slots. Their core anxiety is
strangers in the home, so they look for background checks, bonding and insurance, a
same-cleaner-each-visit policy, a re-clean guarantee, photos of the actual team, and reviews with
first names and neighbourhoods. A recurring-frequency discount is what turns a one-off into a
subscription. The commercial buyer (offices, clinics) does not book online; they want industries
served, OSHA or green certifications, case studies, and a square-footage-and-frequency
walkthrough request. Instant pricing only exists if the operator prices flat-rate, so judge what is
shown, not what could be built.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| CL-pricing-visible | Flat-rate pricing by bedrooms/bathrooms, or a clear hourly rate, is visible (price list, calculator, or instant quote) | home | judgment | high |
| booking-widget | An online booking/scheduling widget is present or a booking CTA links to one | home | deterministic | high |
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| CL-trust-signals | Background checks, bonding/insurance, same-cleaner-each-visit, and a re-clean guarantee are stated | subpath | judgment | high |
| CL-whats-included | A "what's included" checklist exists per service tier or clean type | subpath | judgment | high |
| CL-team-photos | Photos show the actual cleaners in uniform in real homes, not generic stock | subpath | judgment | med |
| CL-reviews-named | Reviews are shown with first names and neighbourhoods or towns | home | judgment | med |
| review-markup | Reviews or ratings are present as structured data or an embedded reviews widget | home | deterministic | med |
| CL-frequency-discount | Recurring-frequency options are offered with the recurring discount shown | subpath | judgment | med |
| CL-tier-comparison | A tier comparison table (e.g. standard vs deep vs move-out) exists | subpath | judgment | low |
| CL-verification-named | Verification badges name the background-check vendor rather than a generic shield icon | subpath | judgment | low |
| CL-before-after | Kitchen or bathroom before/after photos, or a short clean-in-progress video, are shown | subpath | judgment | low |
| live-chat | A live chat or SMS widget is present | home | deterministic | low |
| CL-commercial-path | Commercial visitors get a walkthrough request that captures square footage and frequency, plus industries served or certifications | subpath | judgment | low |
| jsonld-localbusiness | LocalBusiness (or an accepted subtype) JSON-LD is present and parseable | home | deterministic | med |
| address-present | A physical address or service location is stated somewhere on the site | subpath | deterministic | low |
