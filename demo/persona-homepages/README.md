# Persona home pages

One home page per industry persona in `config/industries.yaml`, designed and written against the
criteria in `personas/<slug>.md` and `personas/_common.md`. Eight mock businesses, eight distinct
designs, all copy invented.

These are a **design and SEO/AEO reference**, not client work: they show what "this persona's home
page, done properly" looks like, and they give the audit CLI eight known-good pages to check itself
against. Nothing here calls the Anthropic API, every page was authored by hand and proved with the
repo's own offline tooling.

| slug | mock business | the question the first screen answers |
|---|---|---|
| `landscaping` | Hollow Creek Landscape Co., Chagrin Falls, OH | Do you do my kind of job, in my town, and what does it cost? |
| `cleaning` | Marigold Home Cleaning, Asheville, NC | What does a clean cost for *my* home, and can I book it now? |
| `med-spa` | Juniper Aesthetics, Boulder, CO | What do you treat, who performs it, and what does it cost? |
| `senior-care` | Meadowvale at Cedar Ridge, Fort Collins, CO | Which care level, what does it cost, and can I tour today? |
| `wedding-venues` | Ravenhill Estate, Rhinebeck, NY | Is our date open, what is included, and what is the site fee? |
| `schools-camps` | Harborlight School, Marblehead, MA | Is this school for my child, what does it cost, and when do I apply? |
| `funeral-homes` | Alderman & Sons Funeral Home, Media, PA | Will someone answer right now, and what do I do next? |
| `generic` | Brightline Sign & Graphics, Tacoma, WA | What does this business do, and how do I contact them? |

## Design reads

Each page was built from an explicit read of who is arriving and what they are deciding, and the
three dials follow from that rather than from a house default. Trust-first personas get low
variance and almost no motion on purpose.

| page | read | variance / motion / density |
|---|---|---|
| `landscaping` | homeowner comparing contractors, capable-and-outdoors language | 7 / 5 / 4 |
| `cleaning` | price-first buyer who will transact on the page, bright utility language | 6 / 4 / 5 |
| `med-spa` | cautious patient spending real money, editorial-clinical language | 7 / 3 / 3 |
| `senior-care` | anxious adult daughter days after a fall, trust-first | 4 / 2 / 4 |
| `wedding-venues` | couple comparing five venues in one sitting, premium-consumer | 8 / 4 / 4 |
| `schools-camps` | parent weighing safety and cost, institutional | 5 / 4 / 5 |
| `funeral-homes` | distressed visitor on a phone at 2 a.m., trust-first | 3 / 1 / 4 |
| `generic` | unclassified visitor, neutral baseline | 5 / 4 / 4 |

Motion is transform-only where it exists at all: an opacity fade leaves an ancestor at
`opacity: 0`, which stops axe resolving the background behind its descendants and produces phantom
contrast failures. `med-spa`, `senior-care` and `funeral-homes` carry no entry motion by design.

## Results

Lighthouse, 16 runs (8 pages x mobile and desktop), via `tools/lighthouse.sh`:

```
performance 100 · accessibility 100 · best practices 100 · SEO 100
LCP 0.2-0.3 s desktop, 0.8-1.1 s mobile · CLS 0 · TBT 0 ms
```

Accessibility in **both** colour schemes, via `tools/axe.mjs` (axe-core, WCAG 2.1 A and AA):

```
16 runs (8 pages x light and dark) - no violations
```

Persona criteria and anti-slop rules, via `tools/verify.sh`:

```
82 deterministic checks: 80 pass, 0 partial, 2 declared failures (live-chat, below)
179 persona + common criteria across the eight pages: 175 tagged, 4 declared below
13 anti-slop rules x 8 pages - no failures
```

## How each page is built

**One file, no subresources.** Every page is a single `index.html` with its CSS inlined and its
imagery as inline SVG. No webfonts, no JavaScript, no third-party scripts, no network requests at
all. That is what holds performance at 100 with CLS 0, there is nothing to block rendering and
nothing that can shift.

**Light and dark, both audited.** Every page ships `prefers-color-scheme` support built on the
same token set, with surface tokens kept separate from text tokens so a dark band stays a band
when the scheme flips. Lighthouse only ever exercises whichever scheme the headless browser
prefers, so `tools/axe.mjs` drives axe-core through Playwright in both.

**System font stacks, one per persona.** Each design picks a different family so the eight pages do
not read as one template recoloured: Helvetica Neue (landscaping), Avenir Next (cleaning), Hoefler
Text (med spa), Optima (senior care), Didot (wedding venue), Charter (school), Baskerville (funeral
home), system UI (generic). Each stack falls back to Georgia or a system sans, so the pages degrade
gracefully off macOS, a real build would self-host the equivalent faces.

**Illustrated stand-ins for photography.** Every image is a hand-authored inline SVG, captioned
where it appears as a stand-in for the client's own photography, with `alt` text naming the
photograph it stands in for. That is deliberate: the personas say plainly that generic stock imagery
is what these visitors discount, so an honest labelled placeholder beats a stock-looking substitute.

**Persona criteria are tagged in the markup.** Every criterion in `personas/<slug>.md` and
`personas/_common.md` is carried by an element marked `data-checklist="<id>"`, the same convention
`site:build` uses to point the audit's judge at the element that satisfies a judgment criterion.
`tools/coverage.mjs` diffs the persona tables against the markup, so a criterion cannot be silently
dropped.

## SEO and AEO

Per page:

- `<title>` 56-62 chars and `<meta name="description">` 150-165 chars, inside the audit's windows.
- One `<h1>`, 8-12 descriptive `<h2>` section headings, no skipped heading levels.
- A JSON-LD `@graph`: `WebSite`, the archetype's business type (`LocalBusiness`,
  `HomeAndConstructionBusiness`, `MedicalBusiness`, `AssistedLiving`, `EventVenue`, `School`),
  `WebPage` with a `speakable` selector, and `FAQPage`. Plus `Event` nodes for the school's two open
  houses and a `SearchAction` for the funeral home's obituary search.
- Entities named in full inside sentences, every service, town, credential, licence number, price
  and staff qualification, so an assistant can quote a sentence without needing the surrounding
  page.
- An answer-first opener in every section, marked `data-answer-first`, which the JSON-LD
  `speakable.cssSelector` points at.
- FAQ questions in question form as `<h3>`, mirrored verbatim into `FAQPage.mainEntity`.
- `index.md` (a markdown mirror, linked with `<link rel="alternate" type="text/markdown">`),
  `llms.txt` (key facts and the questions the page answers), `robots.txt` naming thirteen AI
  crawlers explicitly, and `sitemap.xml`.

The sidecars are derived from the HTML by `tools/emit-seo.mjs`, so they cannot drift from the page.

## The anti-slop pass

The first draft of these pages failed the taste-skill Pre-Flight Check badly, in ways that are
invisible until you count them. `tools/taste-lint.mjs` mechanises the rules that were broken, so
they cannot come back:

| rule | first draft | now |
|---|---|---|
| em-dash and en-dash in visible text | 178 | 0 |
| eyebrow micro-labels (max `ceil(sections / 3)`) | 65, one above every section | 25 |
| middle dots per line (max 1) | 117, many lines with 2 to 3 | within budget |
| trust micro-strip inside the hero | 6 pages | 0, each moved to its own band |
| grids of N identical feature cards | 8 | 0, each grid has a feature cell |
| CTAs sharing one intent with different labels | 6 pages | one label per intent |
| headline-left / explainer-right section header | 2 | 0 |
| long list with a hairline under every row | 2 | 0 |
| hand-rolled icon paths | 79 | 0, replaced with Phosphor regular geometry |
| dark mode | none | all 8, audited |

The icons are real [Phosphor](https://phosphoricons.com) `regular` path data, inlined at build time
from `@phosphor-icons/core` rather than drawn by hand, which is why they share one optical weight.

## Declared gaps

Four criteria are deliberately unsatisfied. They are listed in `tools/coverage.mjs` and printed by
every verification run rather than dropped:

| criterion | pages | why |
|---|---|---|
| `live-chat` | cleaning, senior-care | The check detects a third-party chat vendor script. These pages load no third-party JavaScript, which is also why they hold a perfect performance score. A real build would add Podium or similar and accept the cost. |
| `MS-provider-video` | med-spa | Needs a provider-to-camera video. No footage exists for a mock practice. |
| `SK-video` | schools-camps | Needs a day-in-the-life video. Same reason. |

Criteria scoped `subpath` in the persona files refer to pages beyond the home page. Where one could
be answered on the home page it was, per-treatment candidacy and downtime, the tuition estimator,
the before/after pairs, the vendor policy, and the rest are carried by the section that would link
to them.

## Running them

```sh
cd demo/persona-homepages

node tools/serve.mjs            # http://127.0.0.1:8099/<slug>/
tools/verify.sh                 # persona checks + criterion coverage + sidecar freshness
tools/lighthouse.sh             # 8 pages × mobile and desktop, prints a score table
node tools/coverage.mjs         # criterion coverage on its own
node tools/taste-lint.mjs       # anti-slop rules on their own
node tools/axe.mjs              # axe-core, light and dark
SHOT_SCHEME=dark node tools/shots.mjs   # screenshots in dark mode
node tools/shots.mjs            # full-page screenshots into .context/persona-shots/
node tools/contrast.mjs --fix "#6b6f72" "#f4f0e8" 4.6   # pick a passing colour
```

`tools/serve.mjs` rewrites each site's mock production origin to the origin it is served from.
The pages carry absolute canonical, `og:url` and sitemap URLs because that is what ships; without
the rewrite Lighthouse would flag a cross-domain canonical that is correct in production.

Lighthouse is not a repo dependency. Install it once into the gitignored scratch directory:

```sh
mkdir -p .context/lh && cd .context/lh && npm init -y && npm install lighthouse axe-core
```

The Phosphor icon source is installed the same way when icons need regenerating:

```sh
mkdir -p .context/icons && cd .context/icons && npm init -y && npm install @phosphor-icons/core
```

## Reading a page against its persona

```sh
cd website-audit
npx tsx src/index.ts check-html ../demo/persona-homepages/med-spa/index.html --slug med-spa
```

That runs the same deterministic checks the audit runs against a live prospect, using the static
layout rules, and writes `self-test.json` next to the file.
