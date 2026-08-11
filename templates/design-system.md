# Design System — RETIRED

> **This file is retired. The house design floor now lives at [`/DESIGN.md`](../DESIGN.md).**

Everything that was here — the type scale, 8px spacing tokens, radius and shadow
vocabularies, button/card/form/input anatomy, Phosphor icon rules, photography
guidelines, motion rules, breakpoints, accessibility floor, and the shared neutral
and semantic color tokens — was migrated into `/DESIGN.md` in impeccable's DESIGN.md
schema, and that file is now the single source of truth.

## Where things moved

| What you're looking for | Now at |
|---|---|
| House floor: type, spacing, radius, shadows, components, motion, a11y | [`/DESIGN.md`](../DESIGN.md) |
| Agency product truth (users, positioning, evidence, principles) | [`/PRODUCT.md`](../PRODUCT.md) |
| Med spa world (B2B pitch surface) | [`med-spa/DESIGN.md`](med-spa/DESIGN.md) + [`med-spa/PRODUCT.md`](med-spa/PRODUCT.md) |
| HVAC world | [`hvac/DESIGN.md`](hvac/DESIGN.md) + [`hvac/PRODUCT.md`](hvac/PRODUCT.md) |
| Roofing world | [`roofing/DESIGN.md`](roofing/DESIGN.md) + [`roofing/PRODUCT.md`](roofing/PRODUCT.md) |
| Plumbing world | [`plumbing/DESIGN.md`](plumbing/DESIGN.md) + [`plumbing/PRODUCT.md`](plumbing/PRODUCT.md) |
| Full per-industry token tables | `<industry>/<industry>-design.md` (unchanged) |

## How the layering works

Impeccable resolves context **two levels only, per file**: `<activeProject>/` then
`<repoRoot>/`. There is no intermediate chain, and an industry `DESIGN.md` overrides
the root one **whole-file** rather than merging. That is why each industry world opens
with an explicit "EXTENDS `/DESIGN.md`" directive instead of relying on inheritance.

Project boundaries are declared in [`/.impeccable/config.json`](../.impeccable/config.json).

## Seeding a client build

A client directory would otherwise inherit the *agency's* record rather than its
industry's. Seed it explicitly:

```
node .impeccable/seed-client.mjs <med-spa|hvac|roofing|plumbing> demo/<client-name>
```

Then replace every `[CLIENT]` marker with that business's verified facts.

## Asset organization (still current)

```
demo/<client-name>/
├── PRODUCT.md              ← seeded from the industry, then client-specific
├── DESIGN.md               ← seeded from the industry, then brand-token overrides
├── assets/
│   ├── images/
│   │   ├── hero/           ← Hero photos (WebP + JPEG fallback, <200KB, eager)
│   │   ├── gallery/        ← Before/after project photos (<100KB, lazy)
│   │   ├── team/           ← Team/truck photos
│   │   └── misc/           ← Badges, partner logos
│   ├── icons/              ← Custom SVG icons, SVGO-optimized
│   └── fonts/              ← Self-hosted faces if not on the Google Fonts CDN
├── styles/
│   ├── tokens.css          ← CSS custom properties from the industry DESIGN.md
│   ├── base.css            ← Reset + typography + globals
│   └── components.css      ← Cards, buttons, forms, sections
└── index.html
```
