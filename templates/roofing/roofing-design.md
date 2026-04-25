# Roofing — Industry Design Tokens & Assets

> Extends the shared design system (`../design-system.md`) with roofing-specific colors, imagery, and component treatments.

---

## Brand Personality

**Keywords:** Tough, protective, dependable, straightforward
**Mood:** Strong and grounded, but approachable. Think "your neighbor who happens to be a roofing expert" — not corporate, not scrappy.

---

## Color Palette

### Primary Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-primary` | `#1E3A5F` | 30, 58, 95 | Dark navy — headers, hero overlay, footer, trust elements |
| `--brand-primary-light` | `#2A4F7F` | 42, 79, 127 | Hover state for primary |
| `--brand-primary-dark` | `#142841` | 20, 40, 65 | Active state, dark backgrounds |

### Accent / CTA Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-accent` | `#E8552D` | 232, 85, 45 | Primary CTA buttons, links, highlights |
| `--brand-accent-light` | `#F06840` | 240, 104, 64 | Hover state |
| `--brand-accent-dark` | `#C74422` | 199, 68, 34 | Active state |
| `--brand-accent-glow` | `rgba(232, 85, 45, 0.25)` | — | CTA button shadow |
| `--brand-accent-bg` | `rgba(232, 85, 45, 0.06)` | — | Light accent background for sections |

### Supporting Colors

| Token | Hex | Usage |
|---|---|---|
| `--brand-slate` | `#475569` | Body text on light backgrounds |
| `--brand-warm-gray` | `#F8F6F4` | Alternate section background (warmer than pure gray) |
| `--brand-storm` | `#334155` | Storm damage emergency banner background |

### Why This Palette
- **Navy** conveys stability and protection — exactly what a roofing company sells
- **Burnt orange** is attention-grabbing without being aggressive, stands out from the navy for clear CTA contrast
- Together they feel established and professional, differentiating from the "red and black" cliché that plagues roofing sites
- Warm gray alternate backgrounds prevent the cold/sterile feel

---

## Color Application Map

| Page Element | Background | Text | Accent/Border |
|---|---|---|---|
| Sticky header | `--white` | `--gray-800` | `--brand-accent` (CTA button) |
| Hero section | `--brand-primary-dark` at 60% over photo | `--white` | `--brand-accent` (CTA button) |
| Emergency/storm banner | `--brand-storm` | `--white` | `--warning` (alert icon) |
| Services cards | `--white` | `--gray-800` / `--gray-600` | `--brand-accent` (icon, hover border) |
| Why choose us | `--brand-warm-gray` | `--gray-800` | `--brand-primary` (icons) |
| Reviews | `--white` | `--gray-800` | `--warning` (stars) |
| Booking form section | `--brand-primary` | `--white` | `--brand-accent` (submit button) |
| Before/after gallery | `--brand-warm-gray` | `--gray-800` | `--brand-primary` (labels) |
| How it works | `--white` | `--gray-800` | `--brand-accent` (step numbers) |
| Service area | `--brand-warm-gray` | `--gray-700` | `--brand-primary` (map accent) |
| Final CTA | `--brand-primary-dark` | `--white` | `--brand-accent` (buttons) |
| Footer | `--gray-900` | `--gray-300` / `--white` | `--brand-accent` (links) |

---

## Component Variations

### Hero Treatment
- Background: Client's best project photo or team photo
- Overlay: Linear gradient from `--brand-primary-dark` at 70% (left) to 50% (right)
- This creates a dramatic, dark left side where text sits, fading to reveal more of the photo on the right
- Desktop: Text left-aligned, occupying ~55% width
- Mobile: Center-aligned, full overlay at 60%

### Service Cards (Roofing-Specific)
- Icons: Custom SVG in `--brand-accent` on `--brand-accent-bg` circular background (48px circle)
- Hover: Top border appears in `--brand-accent` (3px), card lifts
- Card order: Roof Replacement → Storm Damage → Inspection → Repair

### Before/After Slider
- Slider handle: `--brand-accent` with white arrow icons
- Handle line: 3px solid `--brand-accent`
- Labels: "Before" / "After" badges in `--brand-primary` with white text, `--radius-sm`
- Container: `--radius-lg`, `--shadow-md`

### Trust Badges
- Style: Pill shape (`--radius-full`)
- Background: `--brand-primary` at 8% opacity
- Text: `--brand-primary`, 14px, 600 weight
- Icon: `--brand-primary`, 18px, left of text
- Examples: `✓ Licensed & Insured` `★ 4.9 Google Rating` `🛡 GAF Certified`

### Emergency/Storm Banner
- Background: `--brand-storm`
- Left border: 4px solid `--warning`
- Icon: Storm cloud or warning triangle in `--warning`
- Text: White, 500 weight
- CTA: `--brand-accent` button or white underlined phone link

---

## Photography Direction

### Hero Image Options (Rank by preference)
1. **Crew on a completed roof** — team standing on/near a beautiful finished roof, blue sky, house visible
2. **Handshake moment** — owner/foreman shaking hands with homeowner in front of the house
3. **Aerial drone shot** — completed roof from above showing clean lines, new shingles
4. **Branded truck + team** — crew standing in front of wrapped company vehicle

### Gallery / Before-After
- **Before:** Show the damage clearly — missing shingles, storm damage, aging/deterioration
- **After:** Same angle, same lighting conditions, clean new roof
- **Drone shots are gold** — most competitors don't have them, they're dramatic and unique
- Include 1-2 detail shots: clean flashing, ridge vent, gutter line
- Minimum 4 before/after pairs at launch

### Team Photos
- Uniformed (company shirt/hat minimum)
- Hard hats when on roof (signals safety consciousness)
- Smiling, approachable
- On-site, not studio

### Image Specifications

| Image Type | Dimensions | Max File Size | Format |
|---|---|---|---|
| Hero (desktop) | 1920 x 1080 | 180KB | WebP (JPEG fallback) |
| Hero (mobile) | 800 x 1000 | 100KB | WebP (JPEG fallback) |
| Before/after pair | 800 x 600 each | 80KB each | WebP |
| Gallery thumbnail | 400 x 300 | 40KB | WebP |
| Team photo | 800 x 600 | 80KB | WebP |
| Trust badge logos | 120 x 60 | 10KB | SVG preferred, PNG fallback |

---

## Custom Icons (Roofing-Specific SVGs)

Create these in the Phosphor style (1.5px stroke, rounded caps, matching proportions):

| Icon | Description | Used In |
|---|---|---|
| `roof-house` | House silhouette with emphasized roofline | Roof Replacement card |
| `roof-storm` | House with lightning bolt / rain | Storm Damage card |
| `roof-inspect` | Magnifying glass over roof | Inspection card |
| `roof-repair` | Roof with wrench/tool | Repair card |
| `roof-shield` | Shield with roof silhouette inside | Warranty/protection messaging |
| `roof-drone` | Simple drone icon | Drone inspection mention |

### Icon Style
- Stroke: 1.5px
- Corners: Rounded (2px radius on joins)
- Viewbox: 32 x 32
- Color: Inherit from CSS (use `currentColor`)
- Format: Inline SVG or SVG sprite

---

## Roofing-Specific UI Patterns

### Insurance Claim Badge
Roofing is unique in that many customers use insurance. Highlight this:
- Placement: In hero trust badges + in "Why Choose Us"
- Style: Slightly larger than other badges, with a document/clipboard icon
- Text: "We Handle Your Insurance Claim"
- Color: `--brand-primary` background, white text

### Storm Event Mode
When the client activates storm mode (after a hail/wind event):
- Emergency banner becomes full-width, higher contrast
- Hero headline swaps to storm-focused messaging
- "Storm Damage" service card moves to first position
- Emergency phone number gets additional emphasis
- Optional: Add a "Storm Damage Gallery" section with local damage photos

### Warranty Callout
- Dedicated visual treatment for manufacturer warranty info
- Logo of warranty provider (GAF Golden Pledge, Owens Corning Platinum, etc.)
- "XX-Year Warranty" in a badge/seal treatment
- Placement: Within "Why Choose Us" or as a standalone trust element below hero

---

## Sample Color Preview (CSS Custom Properties)

```css
:root {
  /* Roofing Brand Colors */
  --brand-primary: #1E3A5F;
  --brand-primary-light: #2A4F7F;
  --brand-primary-dark: #142841;
  --brand-accent: #E8552D;
  --brand-accent-light: #F06840;
  --brand-accent-dark: #C74422;
  --brand-accent-glow: rgba(232, 85, 45, 0.25);
  --brand-accent-bg: rgba(232, 85, 45, 0.06);
  --brand-slate: #475569;
  --brand-warm-gray: #F8F6F4;
  --brand-storm: #334155;
}
```
