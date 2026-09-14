---
industry: landscaping
persona_name: Homeowner comparing landscapers for a specific project
primary_goal: Get a quote for a specific project this week from someone who clearly does this kind of work nearby
device_bias: mobile
---

## What this visitor is trying to do

A homeowner on their phone, often in the evening, comparing two or three local landscaping
companies they found on Google Maps or a neighbour's recommendation. They have a specific job in
mind (a new patio, a lawn that needs regular care, a drainage problem, spring clean-up) and they
want to know three things fast: do you do this kind of work, do you work in my area, and how do I
get a price. They trust photos of real finished projects and recent reviews far more than
adjectives. They will call or tap a quote button if it is right there; they will not hunt for it.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| LS-quote-cta | A "get a quote" / "free estimate" call to action appears in the first mobile screen | home | judgment | high |
| LS-services-clear | The main services offered (e.g. lawn care, hardscaping, design, maintenance) are named and visible within the first two screens | home | judgment | high |
| LS-service-area | The service area (cities, counties, or radius) is stated on the home page | home | judgment | high |
| above-fold-images | At least one real, reasonably sized image appears above the fold on mobile | home | deterministic | med |
| review-markup | Reviews or ratings are present as structured data or an embedded reviews widget | home | deterministic | med |
| jsonld-localbusiness | LocalBusiness (or an accepted subtype) JSON-LD is present and parseable | home | deterministic | med |
| LS-project-gallery | Photos of this company's own completed projects (not stock imagery) are shown, ideally with before/after pairs | subpath | judgment | high |
| contact-form | A short quote-request or contact form exists somewhere on the site | subpath | deterministic | med |
| hours-present | Business hours are stated somewhere on the site | subpath | deterministic | low |
| LS-maintenance-plan | A recurring maintenance or seasonal service plan is described somewhere on the site | subpath | judgment | low |
