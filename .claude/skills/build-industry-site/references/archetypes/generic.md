# generic

<!-- TODO (author): one paragraph on when this archetype is used (the classifier could not place the business with confidence) and the consequence: the page makes the fewest assumptions and leans on what the source pages actually say. No industry specifics here. -->

## Section order
<!-- TODO (author): confirm the scaffold's default below and mark each section required or optional. State where industry-added sections are inserted. -->
1. hero — required
2. services — required
3. trust — <!-- TODO (author): required or optional -->
4. gallery — <!-- TODO (author): required or optional -->
5. process — <!-- TODO (author): required or optional -->
6. faq — required
7. contact — required

## Per-section required elements
<!-- TODO (author): one bullet per element every generic page must have in that section. Structure only. -->
### hero
- <!-- TODO (author): e.g. the one H1 stating what the business does and for whom; an answer-first opener paragraph; one primary CTA; the hero placeholder as an inline <svg> inside this section -->
### services
- <!-- TODO (author) -->
### trust
- <!-- TODO (author): proof only when present in the source; otherwise a labelled placeholder block -->
### gallery
- <!-- TODO (author) -->
### process
- <!-- TODO (author) -->
### faq
- <!-- TODO (author): question-form H3s, one short paragraph each, mirrored into FAQPage.mainEntity -->
### contact
- <!-- TODO (author): tel link, form fields, address -->

## JSON-LD
- Type: `Organization` (from `config/industries.yaml` → `archetypes[id=generic].jsonld_type`)
- Required properties: <!-- TODO (author): list only properties fillable from report.json facts (business_name, phones, address) or a source page -->
- Optional properties: <!-- TODO (author): each only when the source states it -->
- Paired with `FAQPage` in the same `@graph`: always

## Navigation
- <!-- TODO (author): which sections appear in the header anchor nav and in what order -->
- <!-- TODO (author): tel link placement in <header> and primary CTA placement in the first screen -->
- <!-- TODO (author): sticky mobile bar — which two actions -->
