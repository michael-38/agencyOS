---
industry: wedding-venues
persona_name: Engaged couple arriving from The Knot, Zola, or Instagram, inquiring at several venues at once
primary_goal: Find out whether our date is available, what the venue includes and costs, and book a tour, fast
device_bias: mobile
---

## What this visitor is trying to do

The couple is comparing several venues in one sitting and will inquire wherever answering is
easiest; the site's job is to convert directory traffic into a tour request, usually phrased as a
date-availability question. Their unit of comparison is the inclusions list (tables, chairs,
linens, coordinator hours, parking) and the vendor policy (open vendor, preferred list, or in-house
catering), followed by pricing by season and day of week or packages, and each space's capacity,
dimensions, and layouts. They need to imagine their own event, so they want each space empty and
dressed, in several seasons and at night, and a real-weddings gallery with photographer credits.
Hidden pricing is their most cited complaint. They expect an explicit response-time promise and
FAQs on rain plan, noise curfew, alcohol policy, accessibility, and nearby lodging.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| WV-date-inquiry | A date-availability checker or "inquire about this date" form is reachable from the first mobile screen | home | judgment | high |
| contact-form | An inquiry form exists somewhere on the site | subpath | deterministic | high |
| WV-inquiry-fields | The inquiry form captures the date, guest count, and budget range | subpath | judgment | med |
| WV-pricing | Pricing by season and day of week, or packages, is published | subpath | judgment | high |
| WV-inclusions | The inclusions list is stated (tables, chairs, linens, coordinator hours, parking) | subpath | judgment | high |
| WV-vendor-policy | The vendor policy is stated (open vendor, preferred list, or in-house catering) | subpath | judgment | high |
| WV-spaces | Each space lists capacity, dimensions, and layouts | subpath | judgment | high |
| WV-real-weddings | A real-weddings gallery exists, filterable by season or style, with photographer credits | subpath | judgment | med |
| WV-space-photos | Each space is shown in multiple seasons or at night, both empty and dressed | subpath | judgment | med |
| WV-response-time | An explicit response-time commitment is stated | home | judgment | med |
| WV-faq-topics | FAQs cover rain plan, noise curfew, alcohol policy, accessibility, and nearby lodging | subpath | judgment | med |
| WV-virtual-tour | A Matterport-style virtual tour or walkthrough video exists | subpath | judgment | low |
| WV-package-table | A package comparison table exists | subpath | judgment | low |
| WV-recency | An Instagram embed or dated recent real-wedding imagery shows the venue is active | home | judgment | low |
| above-fold-images | At least one real, reasonably sized image appears above the fold on mobile | home | deterministic | med |
| tel-link | A tap-to-call phone link exists on the page | home | deterministic | med |
| address-present | The venue's physical address is stated | home | deterministic | med |
| jsonld-localbusiness | LocalBusiness, EventVenue, or an accepted subtype JSON-LD is present and parseable | home | deterministic | low |
