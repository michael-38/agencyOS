---
industry: senior-care
persona_name: Adult daughter in her 50s or 60s researching care for a parent, suddenly urgent after a fall or hospital discharge
primary_goal: Understand which care level fits, what it really costs, who runs the place and how safe it is, and schedule a tour or call today
device_bias: mobile
---

## What this visitor is trying to do

She has researched for weeks and is now anxious, often guilty, and in a hurry. She needs care
levels explained plainly (independent, assisted, memory care, respite) and what happens when needs
increase. Pricing is the number one thing she wants and the thing most operators hide; "starting at"
plus a clear explanation of community fees and care-level tiers keeps her on the site instead of
sending her back to an aggregator. She judges safety by a named executive director and director of
nursing with tenure, staffing ratios, the state license with a link to inspection results, and
family testimonials (video best). She wants to picture daily life: activity calendar, sample menu,
floor plans with dimensions, real residents and staff (not the stock couple on a beach). FAQs on
Medicaid waivers, VA benefits, and long-term care insurance answer the money questions she is
embarrassed to ask. The tour scheduler and a phone number are the conversion; seniors themselves
also visit, so large type and simple navigation matter. Pricing gated behind a form counts as hidden.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| SC-tour-cta | A schedule-a-tour call to action is visible in the first mobile screen | home | judgment | high |
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| SC-care-levels | Care levels (independent, assisted, memory care, respite) are explained plainly, including what happens when needs increase | home | judgment | high |
| SC-pricing | "Starting at" pricing with an explanation of community fees and care-level tiers is published, not gated behind a form | subpath | judgment | high |
| SC-leadership | The executive director and director of nursing are named with their tenure | subpath | judgment | med |
| SC-staffing-ratios | Staffing ratios are stated | subpath | judgment | med |
| SC-license-inspections | The state license is stated with a link to inspection results | subpath | judgment | med |
| SC-daily-life | An activity calendar, sample menu, and floor plans with dimensions are available | subpath | judgment | med |
| SC-benefits-faq | FAQs cover Medicaid waivers, VA benefits, and long-term care insurance | subpath | judgment | med |
| SC-family-testimonials | Family testimonials are shown, preferably as video | subpath | judgment | med |
| SC-educational-content | Educational content such as "signs it's time" exists for early-stage researchers | subpath | judgment | low |
| SC-real-photos | Imagery shows real residents and staff interacting, bright interiors, food, and outdoor spaces rather than generic stock | home | judgment | med |
| SC-virtual-tour | A 360° virtual tour or interactive floor plans exist | subpath | judgment | low |
| SC-readability | Type is large and navigation simple enough for an anxious visitor or a senior on a phone | home | judgment | med |
| live-chat | A staffed live chat widget is present | home | deterministic | low |
| booking-widget | A tour scheduler with a calendar is embedded or linked | subpath | deterministic | med |
| review-markup | Reviews or ratings are present as structured data or an embedded reviews widget | home | deterministic | low |
| address-present | The community's physical address is stated | home | deterministic | med |
