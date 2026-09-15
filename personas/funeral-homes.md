---
industry: funeral-homes
persona_name: At-need family member on a phone, possibly at 2 a.m., who needs a number that answers now; pre-need planner second
primary_goal: Reach a person right now and know what to do next; or, when planning ahead, understand the options and prices and start a pre-arrangement
device_bias: mobile
---

## What this visitor is trying to do

The at-need visitor is distressed, often older, and on a phone: the first screen must offer a 24/7
number that answers, and an "immediate need" page must say what to do right now, step by step.
Heritage is the primary trust signal, so they look for staff bios with licenses and tenure, family
ownership history, and real staff and facilities (chapel, gathering room, exterior) rather than
gray-and-lilies stock. Cremation is now the majority disposition, so service options must include
cremation, green burial, and celebrations of life; pricing (the General Price List or packages) is
a growing expectation online. The pre-need visitor wants pre-planning explained with payment
options and a guide or questionnaire to start. The largest audience, obituary visitors, expects a
searchable obituary listing with photo, service details, guestbook, flowers, and a livestream
link. Large type, simple navigation, and fast load matter because the primary user is older and
stressed.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| tel-link-above-fold | A tap-to-call phone link is visible without scrolling on mobile | home | deterministic | high |
| FH-24-7 | "24/7" or "available any time" is stated next to the phone number in the first mobile screen | home | judgment | high |
| sticky-mobile-cta | A sticky 24/7 call button stays available while scrolling on mobile | home | deterministic | high |
| FH-immediate-need | An "immediate need" page or section says what to do right now, step by step | subpath | judgment | high |
| FH-obituaries | An obituary listing with search is reachable from the home page, with photo, service details, guestbook, or flower ordering | home | judgment | high |
| FH-service-options | Service options include cremation, green burial, and celebrations of life | subpath | judgment | high |
| FH-pricing | The General Price List or package pricing is published online | subpath | judgment | high |
| FH-preplanning | Pre-planning is explained with payment options, plus a planning guide download or a pre-arrangement form | subpath | judgment | med |
| FH-staff-heritage | Staff bios include licenses and tenure, and family ownership history is told | subpath | judgment | med |
| FH-livestream | Livestreaming of services is offered | subpath | judgment | med |
| FH-veterans | Veterans' services are described | subpath | judgment | low |
| FH-grief-resources | Grief resources are provided | subpath | judgment | low |
| FH-faq-topics | FAQs cover cost, timing, and what to bring | subpath | judgment | med |
| FH-real-imagery | Imagery shows real staff and real facilities (chapel, gathering room, exterior) rather than generic stock | home | judgment | med |
| FH-readability | Type is large and navigation simple for an older, stressed visitor on a phone | home | judgment | med |
| address-present | The funeral home's physical address is stated | home | deterministic | med |
| hours-present | Office hours are stated (separately from 24/7 availability) | subpath | deterministic | low |
| jsonld-localbusiness | LocalBusiness (or an accepted subtype) JSON-LD is present and parseable | home | deterministic | low |
