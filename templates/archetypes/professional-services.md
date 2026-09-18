# professional-services

<!-- TODO (author): one paragraph on what unites this archetype (advice- or expertise-led businesses where the visitor is choosing a person or firm, not booking a truck) and how that shapes the page versus local-service. No industry specifics here; those live in references/<slug>.md. No industry in config/industries.yaml maps to this archetype yet. -->

## Section order
<!-- TODO (author): confirm or reorder the scaffold's default below, mark each section required or optional, and state where industry-added sections are inserted. Keep the scaffold ids; if a section reads differently for this archetype (e.g. services shown as practice areas), change the visible H2, not the id. -->
1. hero — required
2. services — required
3. trust — <!-- TODO (author): required or optional -->
4. gallery — <!-- TODO (author): required or optional; may not apply to this archetype -->
5. process — <!-- TODO (author): required or optional -->
6. faq — required
7. contact — required

## Per-section required elements
<!-- TODO (author): one bullet per element every professional-services page must have in that section. Structure only. -->
### hero
- <!-- TODO (author): e.g. the one H1; an answer-first opener paragraph; the primary CTA; the hero placeholder as an inline <svg> inside this section -->
### services
- <!-- TODO (author) -->
### trust
- <!-- TODO (author): credentials, memberships, and named clients only when present in the source; otherwise a labelled placeholder block -->
### gallery
- <!-- TODO (author): or state that this section is dropped for this archetype -->
### process
- <!-- TODO (author) -->
### faq
- <!-- TODO (author): question-form H3s, one short paragraph each, mirrored into FAQPage.mainEntity -->
### contact
- <!-- TODO (author): tel link, form fields, address, hours -->

## JSON-LD
- Type: `ProfessionalService` (from `config/industries.yaml` → `archetypes[id=professional-services].jsonld_type`)
- Required properties: <!-- TODO (author): list only properties fillable from report.json facts or a source page -->
- Optional properties: <!-- TODO (author): each only when the source states it -->
- Paired with `FAQPage` in the same `@graph`: always

## Navigation
- <!-- TODO (author): which sections appear in the header anchor nav and in what order -->
- <!-- TODO (author): tel link placement in <header> and primary CTA placement in the first screen -->
- <!-- TODO (author): sticky mobile bar — which two actions -->
