# Reference files — what the builder reads

`/build-industry-site` is data-driven. For each build it reads two Markdown files from this
directory and parses them by heading, so the skeletons below are a contract, not a suggestion.
Adding an archetype or an industry is one file here plus one entry in `config/industries.yaml`;
no code changes.

| file | selected by | role |
|---|---|---|
| `archetypes/<archetype>.md` | `industries.yaml` → `archetypes[].reference_file` | page skeleton: section order, per-section required elements, JSON-LD type + properties, anchor nav |
| `<slug>.md` | `industries.yaml` → `industries[].build_reference_file` | what this industry's visitor needs: sections, copy guidance, placeholder imagery labels, FAQ seeds, vocabulary, and which section/element satisfies each checklist id |

Current archetypes: `local-service` (`LocalBusiness`), `professional-services` (`ProfessionalService`), `generic` (`Organization`). Current industries: `landscaping` (local-service), `generic` (generic).

## Authoring rules (both kinds)
- Headings are parsed. The H1 text must equal the archetype id or industry slug exactly. The H2s must appear exactly as written in the skeletons, in that order. Put content under headings; never add H2s.
- Section ids are the scaffold's (`website-audit/src/site/commands.ts`): `hero`, `services`, `trust`, `gallery`, `process`, `faq`, `contact`, plus `head` (title, meta description, JSON-LD) and `header` (anchor nav + tel link). An industry may add a section id (lowercase, hyphenated) only by defining it under `## Sections`; the builder inserts it where the archetype's `## Section order` says industry-added sections go. Keep the scaffold's id and change the visible H2 when an industry calls a section something else.
- No invented industry facts: no prices, statistics, typical timelines, regulations, credential or licence names, or "most customers…" claims. Describe what to pull from the source, not what the answer is.
- No numbers in FAQ seeds or copy guidance. The builder's copy must be sourced or marked placeholder, and reference text tends to leak into pages.
- `<!-- TODO (author): … -->` comments mark what still needs writing. Delete them as you fill the file. The builder ignores HTML comments, but a file that still contains TODOs is incomplete and the builder must say so in its report.
- Visual rules live in `templates/design-system.md`. Reference files may name a component ("service card", "review card", "sticky mobile bar") but must not restate tokens, sizes, or colours.
- Imagery guidance is always a placeholder label in the form `"<Asset kind>: <what it should show>"` (for example `"Project photo: before/after patio"`). Never reference the audited site's images.

## Archetype file skeleton (`archetypes/<archetype>.md`)

```markdown
# <archetype>

## Section order
1. <section-id> — required | optional
2. …
(ordered list of the scaffold's section ids; state where industry-added sections are inserted)

## Per-section required elements
### <section-id>
- (one bullet per element every page of this archetype must have in this section:
   heading level, CTA, tel link, form fields, list type, placeholder block — structure only)
### <next section-id>
- …

## JSON-LD
- Type: `<jsonld_type from industries.yaml>`
- Required properties: (list; each must be fillable from report.json `facts` or a source page)
- Optional properties: (list, same constraint; state the condition under which each is emitted)
- Paired with `FAQPage` in the same `@graph`: always

## Navigation
- (which sections appear in the header anchor nav, in what order, label style)
- (tel link placement in the header; primary CTA placement in the first screen)
- (sticky mobile bar contents: which two actions)
```

## Industry file skeleton (`<slug>.md`)

```markdown
# <slug>

## Visitor priorities
- (3–5 bullets: what this persona wants to know first, in order; derived from
   personas/<slug>.md "What this visitor is trying to do"; no numbers)

## Sections
### <section-id>
- **Purpose:** one sentence
- **Required elements:**
  - …
- **Copy guidance:** what to pull from the source; tone; what to avoid
- **Placeholder imagery labels:**
  - "Hero photo: …"
  - …
### <next section-id>
- …

## FAQ seeds
- Question in question form?
- …
(questions only; no answers; the builder answers each from the source or marks it placeholder)

## Vocabulary to use / avoid
- **Use:** term, term, …
- **Avoid:** term (why), …

## Checklist coverage
| id | source | check | weight | scope | section | satisfying element |
|---|---|---|---|---|---|---|
| (one row for every id in personas/<slug>.md and personas/_common.md) |
```

### Checklist coverage rules
- One row per id in `personas/<slug>.md` **and** `personas/_common.md`. `source`, `check`, `weight`, `scope` are copied from those files verbatim.
- `section` is one section id (or `head` / `header`, or `main` for items that span every section). `satisfying element` names the element that gets `data-checklist="<id>"`.
- Deterministic ids must map to an element the offline check can see (`website-audit/src/checks/registry.ts`; layout-dependent checks use `STATIC_LAYOUT_RULES` there — e.g. the tel link must be inside `<header>`, the above-fold image must be an `<svg>`/`<img>` in `<header>` or the first `<main> > section`).
- Items that need facts the source may lack (reviews, hours, address, credentials) say so in `satisfying element`: the builder places a labelled placeholder block tagged with the id and lets the self-test fail rather than fabricate.
- A `TODO` cell means "use the scaffold's default routing"; the builder reports every TODO it hit.
