# local-service

A local-service business sells its availability inside a geography. The visitor already has a
problem or a plan; what they are deciding is whether this business can be trusted with it and how
fast they can start. The page therefore exists to make one of two things happen — the phone rings,
or a request form arrives — and everything on it is judged by whether it moves the visitor toward
that. This is the opposite of a professional-services page, where the visitor is evaluating a
relationship over months and will read at length before acting; here the visitor is mid-task, often
on a phone, and will leave for the next result if the answer is not already on the screen.

## Section order
1. hero — required
2. services — required
3. trust — required
4. gallery — optional (required when the work has a visible result the visitor is buying)
5. process — optional
6. faq — required
7. contact — required

Industry-added sections are inserted after `services` unless the industry file says otherwise.

## Per-section required elements
### hero
- One `<h1>` naming what the business does, for whom, and where.
- An answer-first opening paragraph that answers the visitor's first question on its own.
- The primary CTA, in the first screen, above everything else on mobile.
- The hero image as an `<svg>` or `<img>` inside `<header>` or the first `<main> > section`.
- The service area stated in words, not implied by a map.
### services
- A list or card grid of the services actually named on the source site, each with its own heading.
- One sentence per service saying what the visitor gets, not what the business does.
- A path to the detail for each service: an anchor, or a link to its own page.
### trust
- The proof the source site already carries: credentials, memberships, years, named affiliations.
- Reviews or ratings only when the source page contains those exact reviews or that exact rating.
- When the source carries no proof at all, a visibly labelled placeholder block that stays failing.
### gallery
- Images of the business's own completed work, each with a caption naming what it is.
- Before/after pairing wherever the source presents work that way.
### process
- Ordered steps from first contact to finished job, one sentence each.
- Where a recurring or seasonal arrangement exists on the source, the step that explains it.
### faq
- Question-form headings, each answered in one to three self-contained sentences.
- The same questions, verbatim, mirrored into `FAQPage.mainEntity`.
### contact
- A tap-to-call link using the source's phone number.
- A request form: name, phone, and one free-text field describing the job.
- The service area, the hours, and the address when the source states them.

## JSON-LD
- Type: `LocalBusiness` (from `config/industries.yaml` → `archetypes[id=local-service].jsonld_type`)
- Required properties: `name`, `url`, `description`, plus `telephone` and `address` whenever
  `report.json` `facts` carries them.
- Optional properties, each emitted only when its source exists: `openingHoursSpecification` from
  `facts.hours`; `areaServed` from places the source says the business serves; `hasOfferCatalog`
  from services the source describes; `image` in the production profile when a photograph was
  recovered; `aggregateRating` only when the source states both a rating value and a review count.
- Paired with `FAQPage` in the same `@graph`: always
- Multi-page builds additionally carry `WebSite`, a `WebPage` per page, `BreadcrumbList` below the
  home page, and a `Service` node on each service page.

## Navigation
- Header nav: home, then the service pages, then areas, then the FAQ. Labels are the service's own
  name as the source writes it, never a category word the business does not use.
- The tel link sits inside `<header>` so it is reachable without scrolling, and it is the boldest
  text in the header.
- The primary CTA appears in the first screen, and again at the end of every page.
- Sticky mobile bar: call, and request a quote. Two actions, never three.
