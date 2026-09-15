---
industry: med-spa
persona_name: Prospective patient in their 40s or 50s researching a treatment for a specific concern
primary_goal: Find the right treatment for my concern, confirm it is medically safe and who performs it, know what it costs and what to expect, and book a consultation or the treatment itself
device_bias: mobile
---

## What this visitor is trying to do

Visitors arrive two ways: by concern (fine lines, acne, body contouring) and by treatment name,
so they expect both navigation paths. Their core anxiety is medical safety, so they look for
provider credentials in detail (RN, NP, medical director MD, product-specific training), a safety
and products page, and before/after results for the specific treatment shot at a consistent angle
and lighting. Price-shoppers leave when prices are hidden; the industry now publishes per-unit or
"starting at" prices and financing (CareCredit, Cherry). They want to book from the practice
software (Boulevard, Zenoti, Mangomint, Vagaro, Aesthetic Record), not fill in a contact form, and
they trust real providers and real patients their own age over stock models. Claims like
"permanent" or "guaranteed" read as red flags, not reassurance.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| MS-navigate-by-concern | Treatments can be found both by concern and by treatment name from the home page | home | judgment | high |
| booking-widget | Online booking is embedded from practice software or a booking CTA links to it | home | deterministic | high |
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| MS-treatment-detail | Per-treatment pages cover candidacy, what to expect, downtime, and results timeline | subpath | judgment | high |
| MS-pricing | Treatment prices are published (per unit or "starting at") | subpath | judgment | high |
| MS-provider-credentials | Provider credentials are stated in detail (RN/NP, medical director MD, product-specific training) | subpath | judgment | high |
| MS-before-after | A before/after gallery exists per treatment with consistent angle and lighting | subpath | judgment | med |
| MS-financing | Financing options such as CareCredit or Cherry are stated | subpath | judgment | med |
| MS-safety-products | A safety and products page explains what is used and the safety protocols | subpath | judgment | low |
| MS-real-people | Imagery features real providers and real patients rather than generic stock models | home | judgment | med |
| MS-provider-video | A short provider-to-camera video explains treatments | subpath | judgment | low |
| MS-concern-finder | A concern-to-treatment finder or quiz ends in a booking | subpath | judgment | low |
| MS-no-prohibited-claims | No "permanent", "guaranteed", or similar outcome claims appear on the home page | home | judgment | med |
| review-markup | Reviews or ratings are present as structured data or an embedded reviews widget | home | deterministic | med |
| jsonld-localbusiness | LocalBusiness, MedicalBusiness, or an accepted subtype JSON-LD is present and parseable | home | deterministic | med |
| hours-present | Business hours are stated somewhere on the site | subpath | deterministic | low |
| address-present | A physical address is stated somewhere on the site | subpath | deterministic | low |
