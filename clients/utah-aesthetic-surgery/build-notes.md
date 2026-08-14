# Build notes — Utah Aesthetic Surgery

Built 2026-08-11 from `https://utah-aesthetic-surgery.com/` via `/redesign-site`.

## Live URLs

| What | URL |
|---|---|
| Compare page (send this to the client) | https://utahaestheticsurgery.pages.dev |
| Direction A | https://a.utahaestheticsurgery.pages.dev |
| Direction B | https://b.utahaestheticsurgery.pages.dev |

**Slug note:** the Cloudflare project is `utahaestheticsurgery`, but the client directory is
`clients/utah-aesthetic-surgery/`. They differ because Cloudflare refused to create a project
named `utah-aesthetic-surgery` (HTTP 500, code 8000000) even though that hostname does not
resolve and every variant tested was free. Not an auth or outage issue: the same credentials
created `utahaestheticsurgery`, `utah-aesthetic`, and `utah-aesthetic-surgery-co` seconds
later. Treat the name as blocked and do not retry it.

## Archetype and why

`med-spa`. Signals: premium/editorial positioning, considered (not emergency) buying
trigger, and 63 usable real photographs, comfortably over the ≥6 threshold.

**The med-spa `PRODUCT.md` was rewritten, not just filled in.** The seeded archetype is
AgencyOS's own B2B pitch record aimed at *med spa owners* — its Users, Product Purpose,
Positioning, Operating Context, Evidence and Principles sections were all about selling
agency services. Every one was rewritten against patients. The med-spa `DESIGN.md` was kept
as-is; the editorial/premium visual world is correct for an aesthetic practice.

## Industry profile

- **Industry:** plastic and reconstructive surgery (aesthetic), single surgeon practice.
- **Buying trigger:** considered. High cost, irreversible, months of research.
- **Primary conversion:** phone call. `801-810-0761` is the only CTA the current site
  repeats, and there is no online booking.
- **Proof currency:** before/after imagery, then verbatim reviews, then credentials.
- **Price posture:** quote-only. Nothing is published.
- **Usable real photos:** 63.

## The two directions

Both are built from the identical `fact-sheet.md`, the identical image pool, and the same
seeded `DESIGN.md`. Only the design differs.

**A — warm editorial, structured** (`/impeccable`, mode Persuade, on the house floor).
Sand ground, card-based sections, three-column review grid, dark contact block. The
conservative, guaranteed-shippable option.

**B — editorial, typographic, sparser** (`/design-taste-frontend`, Redesign-Overhaul).
Paper ground held for the whole page (theme lock), no cards anywhere, oversized display
type, asymmetric hero, numbered procedure rows, varied-size gallery, one giant pull quote.
Seven distinct layout families, each used once.

Three of taste-skill's rules were deliberately allowed to beat house habit on B, which is
the entire reason B exists: no 3-column equal feature cards, the section-layout-repetition
ban, and the zigzag cap. Everything else (palette, Fraunces + Inter Tight, Phosphor icons,
self-hosted fonts, vanilla single file) was pinned by `briefs/taste-brief.md`.

## Facts: sourced vs assumed

Everything on both pages traces to `source-content/`. Nothing was invented.

**Deliberately omitted because it is not published anywhere on the client's site.** Each of
these is a question for the client, not a gap to fill:

- **Board certification body.** The site says "board-certified" and once "double
  board-certified precision" but never names a board. Both pages use only the client's own
  word "board-certified" and name no board.
- **Star rating and review count.** No aggregate is published, so neither page shows one.
- **Pricing, financing, payment plans.** None published.
- **Clinic founding year.** "Over two decades of surgical experience" describes the surgeon,
  not the practice. Not converted into a founding date.
- **Named staff besides Dr. Rodrigues.** Reviews mention a PA, MAs and estheticians; no
  names are published.
- **Service areas beyond South Jordan.**
- **Online booking.** Does not exist; both pages route to phone and email instead.

## Imagery

63 photographs harvested from the client's own site into `assets/`, provenance in
`assets/PROVENANCE.txt`. Ten were staged per version and recompressed (2.5 MB to 804 KB on
A). **No stock and no generated imagery** — none was used and none is available, since no
image-generation credential is configured.

One thing worth raising with the client: their current site's liposuction section uses a
file named `Liposuction-Wikipedia.png`. That did not pass the harvest filter and is not on
either new page, but if it is a Wikipedia-sourced image on their live site it is worth
checking the licensing.

## Crawl

10 of 12 mapped pages scraped. Skipped `/gallery` (image-only, its images were harvested
from the home page) and one duplicate.

Two things the crawl forced:

1. **`onlyMainContent: true` drops the footer, and the footer is where the NAP lives.** The
   contact page returned no address, zip, or hours. A second pass with
   `onlyMainContent: false` plus a JSON schema returned all three.
2. **Roughly 40 to 60% of the raw markdown was boilerplate** — a 100-language GTranslate
   list, a date picker, an age gate. Stripped before persisting.

**The Firecrawl MCP server disconnected mid-session**, so the crawl ran against the
Firecrawl v2 REST API directly with the same key. Same service, same credential, same
results. Note the v2 API takes `formats: [{type:"json", ...}]`; `jsonOptions` is v1 only and
is rejected.

## Not done

- **No AI concierge.** `serve.js` exposes `/api/chat` from Node, which 404s on Cloudflare
  Pages. Shipping the widget requires porting it to a Pages Function first, following
  `hyperworkflow/functions/api/audit.ts`.
- **No contact form.** A form needs a handler; both pages use `tel:` and `mailto:` instead,
  which work on static hosting and match how this practice actually converts.
- **No "before" audit.** `/audit-prospect` was not run, so there is no Lighthouse
  before/after comparison to show the client.

## Next

1. Send https://utahaestheticsurgery.pages.dev to the client.
2. Get answers on the `[CONFIRM]` items above, especially board certification.
3. On their pick: `scripts/deploy-pages.sh clients/utah-aesthetic-surgery/versions/<a|b> utahaestheticsurgery main`
