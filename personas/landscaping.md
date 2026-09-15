---
industry: landscaping
persona_name: Homeowner comparing landscapers for a specific project (design/build) or for recurring maintenance
primary_goal: Get a credible quote for a specific project this week, or sign up for maintenance, from a company that clearly does this work nearby and will not abandon the job
device_bias: mobile
---

## What this visitor is trying to do

Two buyers arrive here with different budgets. The design/build buyer has a specific job in mind
(a patio, a retaining wall, a drainage problem, a full redesign); their anxiety is scope creep and
being abandoned mid-project, so they look for a clear process (site visit, design, proposal, build
timeline), "starting at" price ranges per project type, and proof the company finishes work: real
finished projects in good light, before/after pairs, crews in uniform with trucks. The maintenance
buyer wants recurring mowing or seasonal clean-ups and expects lot-size-based pricing and a simple
recurring signup. Both read local specificity (neighbourhood names, service-area towns) as proof,
trust licensing and insurance statements, and will tap a call/text bar or a quote form that lets
them describe the property; they will not hunt for it.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| sticky-mobile-cta | A sticky mobile call/text bar stays available while scrolling | home | deterministic | med |
| LS-quote-cta | A "get a quote" / "free estimate" call to action appears in the first mobile screen | home | judgment | high |
| LS-services-clear | The main services (e.g. design/build, hardscaping, lawn care, maintenance) are named and visible within the first two screens | home | judgment | high |
| LS-two-buyers | Design/build project quotes and recurring maintenance signup are presented as separate paths, not one generic contact form | home | judgment | med |
| LS-service-area | The service area (cities, counties, or radius) is stated on the home page | home | judgment | high |
| above-fold-images | At least one real, reasonably sized image appears above the fold on mobile | home | deterministic | med |
| review-markup | Reviews or ratings are present as structured data or an embedded reviews widget | home | deterministic | med |
| jsonld-localbusiness | LocalBusiness (or an accepted subtype) JSON-LD is present and parseable | home | deterministic | med |
| LS-project-gallery | Photos of this company's own completed projects are shown, ideally as before/after pairs, in good light and wide shots | subpath | judgment | high |
| LS-gallery-organized | The project gallery is organized or filterable by project type and/or local neighbourhood names | subpath | judgment | low |
| LS-process | A process page or section explains the steps from site visit to design, proposal, and build timeline | subpath | judgment | med |
| LS-price-ranges | "Starting at" price ranges per project type are published (or lot-size-based pricing for maintenance) | subpath | judgment | med |
| LS-credentials | Licensing (state contractor, pesticide applicator), insurance, or an industry affiliation such as NALP is stated | subpath | judgment | med |
| LS-service-area-pages | Service-area pages or sections exist per town or neighbourhood | subpath | judgment | low |
| LS-crew-fleet | Photos show the crew in uniform and/or branded trucks | subpath | judgment | low |
| contact-form | A quote-request or contact form exists somewhere on the site | subpath | deterministic | med |
| LS-quote-form-qualifies | The quote form collects the property address, allows photo uploads, or includes a budget-range selector | subpath | judgment | med |
| LS-maintenance-plan | A recurring maintenance or seasonal service plan is described with how to sign up | subpath | judgment | med |
| hours-present | Business hours are stated somewhere on the site | subpath | deterministic | low |
