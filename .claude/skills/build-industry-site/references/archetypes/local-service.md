# local-service

<!-- TODO (author): one paragraph on what unites this archetype (a business serving a physical area whose site exists to make the phone ring or a quote form get sent) and how that shapes the page versus professional-services. No industry specifics here; those live in references/<slug>.md. -->

## Section order
<!-- TODO (author): confirm the order below (it is the scaffold's default), mark each section required or optional, and state where industry-added sections are inserted (e.g. "after services"). -->
1. hero — required
2. services — required
3. trust — <!-- TODO (author): required or optional -->
4. gallery — <!-- TODO (author): required or optional -->
5. process — <!-- TODO (author): required or optional -->
6. faq — required
7. contact — required

## Per-section required elements
<!-- TODO (author): one bullet per element every local-service page must have in that section. Structure only (heading level, CTA, tel link, form fields, list types, placeholder blocks). Copy and imagery guidance belong in the industry file. -->
### hero
- <!-- TODO (author): e.g. the one H1; an answer-first opener paragraph; the primary CTA; the hero placeholder as an inline <svg> inside this section (the offline above-fold-images rule looks in <header> or the first <main> section) -->
### services
- <!-- TODO (author) -->
### trust
- <!-- TODO (author): proof elements are only allowed when present in the source; otherwise a labelled placeholder block -->
### gallery
- <!-- TODO (author) -->
### process
- <!-- TODO (author) -->
### faq
- <!-- TODO (author): question-form H3s, one short paragraph each, mirrored into FAQPage.mainEntity -->
### contact
- <!-- TODO (author): tel link, form fields, address or service area, hours -->

## JSON-LD
- Type: `LocalBusiness` (from `config/industries.yaml` → `archetypes[id=local-service].jsonld_type`)
- Required properties: <!-- TODO (author): list only properties fillable from report.json facts (business_name, phones, address) or a source page -->
- Optional properties: <!-- TODO (author): e.g. areaServed, openingHoursSpecification, url — each only when the source states it -->
- Paired with `FAQPage` in the same `@graph`: always

## Navigation
- <!-- TODO (author): which sections appear in the header anchor nav and in what order -->
- <!-- TODO (author): tel link placement (the scaffold puts it in <header>, which is what the offline tel-link-above-fold rule checks) and primary CTA placement in the first screen -->
- <!-- TODO (author): sticky mobile bar — which two actions (scaffold default: Call + Request a quote) -->
