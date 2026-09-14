---
industry: generic
persona_name: Visitor deciding whether to contact this business
primary_goal: Understand what the business offers and get in touch with minimal effort
device_bias: mobile
---

## What this visitor is trying to do

Used when the industry could not be classified with confidence. The visitor landed here from a
search or a referral and wants to know, within a few seconds: what does this business do, is it
for me, and how do I contact them. They will leave if the first screen does not answer the first
question or if contacting the business takes more than a couple of taps.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| tel-link | A tap-to-call phone link exists on the page | home | deterministic | high |
| G-what-they-do | Within the first mobile screen it is clear what the business does and for whom | home | judgment | high |
| G-primary-cta | One obvious primary call to action (call, book, request, contact) is visible on the first screen | home | judgment | high |
| contact-form | A contact form exists somewhere on the site | subpath | deterministic | med |
| G-trust | Some form of social proof is shown: reviews, named clients, credentials, or years in business | subpath | judgment | med |
| address-present | A physical address or service location is stated somewhere on the site | subpath | deterministic | low |
