# Med Spa — Industry Design Tokens & Assets

> Extends the shared design system (`../design-system.md`) with med-spa-specific colors, typography, and component treatments. **This template breaks from the home-services system intentionally** — med spa is a luxury/aesthetic vertical, so the visual language is editorial-magazine instead of trustworthy-utility.

> Design source: handoff bundle from Claude Design (`Revitalize Clinic.html`). The visual identity is preserved; the *content* is reframed to pitch a redesigned website to med spa **owners**, not patients.

---

## Brand Personality

**Keywords:** Editorial, evidence-based, restrained, luxe-but-clinical, quietly confident
**Mood:** A high-fashion magazine spread crossed with a peer-reviewed paper. Whitespace, italic serif accents, monospace metadata. Zero gradients, zero stock-photo "happy doctor" energy.

**Why this aesthetic for med spa owners (not patients):**
A med spa owner who clicks our pitch must immediately feel "*this is the design language my clinic wants*." They're not buying a website — they're buying the perception their clinic gives off. The pitch page itself has to model that perception.

---

## Color Palette

### Cream Theme (Default)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#f4e8e0` | Page background — warm cream |
| `--bg-2` | `#ece0d5` | Alternate section bg |
| `--paper` | `#faf2ea` | Card / inset surfaces |
| `--ink` | `#1a1412` | Primary text, dark CTAs, footer |
| `--ink-2` | `#3a2d26` | Secondary text |
| `--muted` | `#7a675a` | Eyebrows, captions, monospace metadata |
| `--line` | `#d9c7b7` | Borders, dividers |
| `--accent` | `#b8644a` | Terracotta — italic emphasis, italic numerals, links on hover |
| `--accent-deep` | `#8f4a34` | Hover state |
| `--accent-soft` | `#e6b8a3` | On dark bg (testimonials, footer) |

### Tonal Palette (for gradient placeholders)

| Token | Hex |
|---|---|
| `--tone-a` | `#e8c9b3` (light terracotta) |
| `--tone-b` | `#c98f73` (mid clay) |
| `--tone-c` | `#8a5640` (deep terracotta) |
| `--tone-d` | `#f0d8c4` (palest cream) |

### Why This Palette

- **Cream** signals "spa", "skin", "warmth" without going pink (which reads as cheap/dated)
- **Terracotta** as the accent — distinctive, earthy, photographs well, doesn't compete with the medical/aesthetic photography that med spas live and die by
- **Deep ink instead of pure black** — softer, premium, less screen glare
- Together: feels like a Kinfolk/Cereal magazine — premium without trying too hard

### Optional Theme Variants (kept from source design but not exposed in pitch page)
- `sand` — desaturated cream + slate accent
- `noir` — dark mode with antique gold accent
- `bone` — pure white with carbon accent (most clinical)

These are documented in CSS for future site builds but the pitch page locks to `cream`.

---

## Typography

### Font Stack

| Role | Font | Fallback | Weights |
|---|---|---|---|
| **Display / Headlines** | Fraunces (variable, optical sizing) | "Times New Roman", serif | 300, 400 (italic), 500 |
| **Body / UI** | Inter Tight | system-ui, -apple-system, sans-serif | 400, 500, 600 |
| **Metadata / Eyebrows** | JetBrains Mono | ui-monospace, monospace | 400, 500 |

### Why

- **Fraunces** is the heart of the design — its variable optical-size and SOFT axes give the headlines their warm, magazine-cut feel. Italic Fraunces *is* the brand voice.
- **Inter Tight** for body — slightly tighter than Inter, pairs better with Fraunces' high-contrast cuts.
- **JetBrains Mono** for monospace metadata (numbered sections, eyebrows, captions). Doing all-caps tracking-out in mono is the magazine touch.

### Typography Rules

- Headlines: sentence case, **always** with one italic phrase as accent (e.g., "The science of *converting clicks*").
- Italic = terracotta. Roman = ink. This rule is sacred.
- Eyebrows: monospace, 11px, 0.18em letter-spacing, uppercase, muted color
- Section numbers: italic Fraunces in terracotta (e.g., *№01*)
- No drop shadows on text. No emoji.

### Type Scale (clamp-based, fluid)

| Element | Size |
|---|---|
| H1 (Hero) | `clamp(56px, 9vw, 148px)` line-height 0.98 |
| H2 (Section) | `clamp(40px, 5.4vw, 84px)` line-height 0.98 |
| H3 (Cards) | `clamp(24px, 2.2vw, 32px)` line-height 1.1 |
| Lead | `clamp(17px, 1.4vw, 20px)` line-height 1.5 |
| Body | 14–16px line-height 1.55 |
| Eyebrow / mono | 10–11px, 0.15–0.18em tracking |

---

## Spacing & Layout

- **Max width:** 1360px (wider than the 1200px home-services norm — magazine layouts breathe more)
- **Section padding:** `clamp(80px, 12vh, 140px)` top and bottom
- **Container padding:** 32px desktop / 20px mobile
- **Grid:** 12-col implicit, but most sections use named grid templates (e.g., `1.15fr 0.85fr` for hero, `1fr 1.2fr` for section heads)
- **Border radius:** `2px` (almost-square — editorial, not friendly-rounded)

---

## Component Treatments

### Hero
- Editorial split: 1.15fr text / 0.85fr figure
- Headline reveals line-by-line via `translateY` rise animation, 120ms stagger
- Right column figure is a CSS-rendered tonal placeholder (no Unsplash dependency on the pitch page — Lighthouse-friendly)
- Hero stats row at bottom: 4 columns, large italic Fraunces numerals, mono labels

### Marquee
- Infinite-scroll horizontal band of capabilities, large Fraunces, dotted separators, italic terracotta accents on every other phrase

### Capability Grid (formerly "treatments")
- 3-col grid (2 on tablet, 1 on mobile)
- Each card has: number tag (mono), tonal SVG/CSS hero block, italic-accented title, copy, 4-cell metadata footer
- Hover: warmer background, no transform — restraint

### Featured Comparison Slider
- Full-width 16:9 before/after slider
- Drag, keyboard arrows, auto-preview animation on first scroll into view
- Used to compare an outdated competitor design vs. the SiteRefresh redesign

### Case Study Cards
- 4:5 aspect portrait media (CSS-rendered tonal mockup, not photo)
- Italic title, monospace age/segment tag, blockquote, 4-cell specs grid

### Approach Steps
- 4 horizontal steps separated by ink top-borders
- Step numerals are italic Roman (i, ii, iii, iv) in terracotta — a magazine touch

### Booking Calendar Widget (NEW vs source)
- Inline month grid with prev/next arrows
- Available days marked, weekends greyed, past days disabled
- Click a day → time-slot list slides in, click slot → confirmation card
- Pure JS, no calendar library — keeps the page fast

### FAQ Accordion
- Single-column on right, intro on left
- `+` icon rotates to `−` on open
- `max-height` transition for smooth expand/collapse

### Footer
- Black (`var(--ink)`) inverted block
- Footer-big text: Fraunces clamp 60–140px italic accent line
- 4-col link grid + brand block

---

## Animations & Motion

- **Animation level:** "5/10" — present, not aggressive
- Hero headline lines rise on load (~900ms each, 120ms stagger)
- Reveal-on-scroll: `translateY(24px)` + opacity, 900ms ease-out, 80–240ms stagger between siblings
- Marquee: linear infinite, 44s loop
- Pulse dot on hero eyebrow: 2.6s ease-in-out
- Hover transitions: 200–300ms, never longer
- **`prefers-reduced-motion`**: every animation/transition collapsed to 0.01ms

---

## Iconography

- No icon font / Phosphor pack — the page uses **inline SVG** sparingly:
  - Phone icon in nav and contact card
  - Calendar arrows (chevrons rendered as SVG)
  - Plus/minus for FAQ rendered with two `::before`/`::after` lines (no SVG needed)
- Italic Fraunces section numerals and serif glyphs do most of the visual work — fewer icons keeps Lighthouse asset count low.

---

## Imagery Strategy (Pitch Page)

**The pitch page uses zero photography.** All visual blocks are CSS gradients and SVG mockups. Reasons:

1. **Lighthouse score** — every external image is an LCP/CLS risk
2. **Authenticity** — we cannot use real client photos in a generic pitch template; stock photos undercut the editorial premise
3. **Self-similar** — a page selling design polish must itself be polishable; CSS-rendered placeholders telegraph "your photos go here"

When a client commissions a real site, the same component slots accept real images with `loading="lazy"`, `decoding="async"`, and explicit `width`/`height`.

---

## Performance Budget

| Metric | Target |
|---|---|
| LCP | < 1.8s on 4G |
| CLS | < 0.05 |
| TBT | < 200ms |
| HTML size | < 70KB gzipped |
| External requests (above the fold) | 1 (font CSS only, async) |
| Critical CSS | inlined |
| JS | inlined, deferred until DOMContentLoaded, < 8KB minified |

---

## Accessibility

- Semantic HTML (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`)
- Landmark roles: nav has `aria-label="Primary"`, calendar has `role="grid"` + `aria-labelledby`
- All form inputs have explicit `<label>` + `id` association
- FAQ buttons use `aria-expanded`
- Slider uses `role="slider"`, `aria-valuemin/max/now`, `tabindex="0"`, ArrowLeft/Right keyboard support
- Color contrast: ink on cream is 13.1:1 (AAA), muted on cream is 4.6:1 (AA), terracotta on cream is 4.5:1 (AA)
- `:focus-visible` outlines on all interactive elements (3px terracotta, 2px offset)
- `prefers-reduced-motion` respected

---

## File Naming

```
templates/med-spa/
├── index.html              ← Single-file pitch page
├── med-spa-copy.md         ← Page copy & content structure
└── med-spa-design.md       ← This file
```
