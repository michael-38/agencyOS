# Product

<!-- impeccable:product-schema 1 -->

<!-- INDUSTRY RECORD — Med spa. NOTE THE AUDIENCE DIFFERENCE.
     Unlike hvac/roofing/plumbing (which are B2C client landing pages targeting
     homeowners), this template is AgencyOS's own B2B PITCH page targeting med spa
     OWNERS, converting them into a strategy call. The page is itself the case study.

     If you need a B2C patient-facing med spa page for a signed client, this record
     is the wrong context — that surface does not exist yet and needs its own
     PRODUCT.md written against patients, not owners. See the note in
     Capabilities and Constraints. -->

## Platform

web

## Stack

Static HTML/CSS in this directory (`index.html`), with the AI concierge wired via the shared `serve.js` + `concierge.json` + `concierge-prompt.md`. A `pitch-deck/` accompanies it.

## Users

**Med spa owners and founders — not patients.** Mostly clinical professionals (MDs, NPs, RNs) who own one or two locations, are stretched thin running operations, and know their website is dated but have neither the bandwidth nor a trusted partner to fix it.

Visitor psychology, as recorded in `med-spa-copy.md`:
- **Skeptical.** Most have been burned by an agency before.
- **Time-poor.** Running a clinic; reading this between patients.
- **Proud of their clinical credentials.** Any copy that talks down to them, or treats the practice as merely a website problem, loses immediately.

Vertical economics from `lead-gen-target-industries.md`: average revenue per visit $536, annual practice revenue $1.8M–$2M, marketing spend 7–12% of revenue, 11,000+ US med spas. They advertise on Instagram, Google Ads, Groupon, influencer partnerships, and email. Found via the AmSpa directory, Google Maps, Instagram, Yelp, and RealSelf.

## Product Purpose

Convert a med spa owner into a booked **30-minute strategy call** with the agency.

The secondary goal is load-bearing and unusual: **the page must demonstrate, by example, the design language we would build for them.** The page is the case study. An owner should feel "this is the design language my clinic wants" before reading a word of the offer.

## Positioning

We understand the *business*, not just the website. The pitch leads with respect for clinical credentials, proves comprehension of med spa economics, and shows concrete revenue math — deliberately not abstract "modernization" or "boost engagement" language.

The mechanism a competitor cannot copy: the page itself is the proof. Most agencies pitch a med spa with a generic agency site. This one is built in the exact editorial register the client's own clinic should adopt.

## Operating Context

- The owner is comparing us against agencies who have already disappointed them, and against doing nothing.
- Revenue math is the persuasive core — average revenue per visit against captured versus missed inquiries.
- The AI concierge on this page is itself a demonstration of a deliverable, not decoration.

## Capabilities and Constraints

- Voice is fixed by `med-spa-copy.md`: quiet confidence, no exclamation points, no "crush your competition" energy, evidence-based with real numbers, magazine syntax — short declarative lines, a pause, then a longer italic-tinted line that lands the meaning.
- Terracotta italics carry the emotional beat inside otherwise clinical sentences. This is a deliberate, documented device.
- **Gap to be aware of:** there is no patient-facing (B2C) med spa template in this repo. `demo/utah-aesthetic-surgery/` is the closest real patient-facing aesthetic-surgery build. A signed med spa client needing a patient-facing page requires a new record, not this one.

## Brand Commitments

AgencyOS / Hyperworkflow brand rules apply — see the root `PRODUCT.md`. The editorial register documented here is specific to this pitch surface and is not the agency's general house voice.

## Evidence on Hand

- The page itself, and `pitch-deck/`.
- Real audit output from the `audit/` CLI for any specific prospect, which is the strongest evidence available in a pitch.
- `demo/utah-aesthetic-surgery/` as a real aesthetic-vertical build.

**Absences future work must not fabricate:** there are no named med spa clients, published case studies, retained-client counts, or testimonials from med spa owners. Revenue math must be presented as modeled math with stated assumptions, never as achieved client results.

## Product Principles

1. **The page is the case study.** Craft is the argument.
2. **Respect the credentials first.** Clinical professionals, addressed as peers.
3. **Concrete math, not adjectives.** Real numbers with stated assumptions.
4. **Quiet confidence.** No agency hype register.
5. **One CTA: the 30-minute strategy call.**

## Accessibility & Inclusion

WCAG AA per `/DESIGN.md`. The editorial world uses low-contrast warm neutrals by design — every text/background pair must be verified against 4.5:1 rather than assumed, because this palette is the most likely of the four to fail.
