# Product

<!-- impeccable:product-schema 1 -->

<!-- INDUSTRY RECORD — HVAC contractor landing pages (B2C).
     This is the archetype for a client in this vertical, not a specific client.
     Seed a client build with: node .impeccable/seed-client.mjs hvac demo/<client>
     Then fill the [CLIENT] markers below with that business's real facts. -->

## Platform

web

## Stack

Static HTML/CSS generated from this template directory. Optional AI concierge via the shared `serve.js` + per-client `concierge.json` / `concierge-prompt.md`. Deployed to Cloudflare Pages.

## Users

Homeowners searching for HVAC service, arriving overwhelmingly on a phone. They land in one of three modes, and the page must serve all three from the first viewport:

- **Emergency** (highest value, least patient): no heat in a cold snap, no AC in a heat wave. Panicked, will call the first company that looks trustworthy, and will not scroll far or read carefully. This visitor decides in seconds.
- **Planned replacement:** the system is old and they are collecting quotes. Comparison-shopping, will read, wants financing and equipment specifics, and is likely visiting two or three competitor sites in adjacent tabs.
- **Maintenance:** tune-up, filter change, seasonal service. Lowest urgency, highest lifetime value — this is the visitor who becomes a service-plan subscriber.

Vertical economics from `lead-gen-target-industries.md`: average install $9,000–$16,500, average service call $150–$500, customer lifetime value $15,340, roughly 60,000 small US firms.

## Product Purpose

Convert an HVAC visitor into a phone call, form submission, or booked appointment. Emergency capture is the priority because it is both the most valuable and the most time-sensitive traffic; the page fails if an emergency visitor has to hunt for a phone number.

## Positioning

[CLIENT] — the specific mechanism this contractor can claim truthfully and a competitor cannot. Real candidates in this vertical: guaranteed response window, 24/7 live answering (not a machine), manufacturer certifications, second-generation family ownership, flat-rate pricing with no overtime charge. **Record only what the business can actually substantiate.**

## Operating Context

- Traffic is seasonal and spiky: heating failures cluster in the first cold week, AC failures in the first heat wave. The design must let the page pivot between summer and winter emphasis without a rebuild — hence the seasonal accent tokens.
- Competitors advertise via Google Local Services Ads, Angi, vehicle wraps, direct mail, and local SEO. Visitors often arrive having already seen an LSA badge and are checking legitimacy.
- Homeowners frequently call from inside a house that is too hot or too cold, sometimes with family present. Time-to-phone-number is the single dominant metric.

## Capabilities and Constraints

- Click-to-call must work on every breakpoint and every phone-number instance.
- Service area, license number, and hours are factual claims and must come from the client.
- If the business does not offer genuine 24/7 service, the page may not imply it.

## Brand Commitments

[CLIENT] — business name, logo, existing brand colors if any, tagline, and any franchise or manufacturer-dealer branding rules that constrain the design (Carrier, Trane, and Lennox dealer programs all impose logo and color requirements).

## Evidence on Hand

[CLIENT] — real review counts and ratings with their source, license number, years in business, service area, team and truck photography, manufacturer certifications, financing partners.

**Absences future work must not fabricate:** review counts, star ratings, "X,000 homes served" figures, license numbers, response-time guarantees, certifications, and years in business are all legally meaningful claims about a real contractor. If the client has not supplied one, leave a visible placeholder and say so. Never generate a testimonial.

## Product Principles

1. **The emergency visitor sets the layout.** If the panicked visitor is served, the other two modes are too.
2. **Trust is proven above the fold** — license, rating, and response time visible before any scroll.
3. **Seasonality is a content switch, not a redesign.**
4. **Every claim is the client's, verified.** No invented proof.
5. **The phone number is the product.** Everything else is supporting argument.

## Accessibility & Inclusion

WCAG AA per `/DESIGN.md`. Vertical-specific: this visitor is often stressed, sometimes elderly, frequently outdoors or in poor lighting checking a phone. Contrast in daylight, 48px touch targets, and a phone number that survives zoom are functional requirements here, not compliance items.
