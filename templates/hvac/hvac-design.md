# HVAC — Industry Design Tokens & Assets

> Extends the shared design system (`../design-system.md`) with HVAC-specific colors, imagery, and component treatments.

---

## Brand Personality

**Keywords:** Comfortable, reliable, technical expertise, family-safe
**Mood:** Warm and competent. The feeling of walking into a perfectly climate-controlled home. Professional but not cold — these people keep your family comfortable.

---

## Color Palette

### Primary Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-primary` | `#0F4C75` | 15, 76, 117 | Deep teal-blue — headers, hero overlay, footer, trust elements |
| `--brand-primary-light` | `#1B6B9E` | 27, 107, 158 | Hover state for primary |
| `--brand-primary-dark` | `#0A3452` | 10, 52, 82 | Active state, dark backgrounds |

### Accent / CTA Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-accent` | `#FF6B2C` | 255, 107, 44 | Primary CTA buttons, links, highlights — warm orange for energy/warmth |
| `--brand-accent-light` | `#FF8550` | 255, 133, 80 | Hover state |
| `--brand-accent-dark` | `#E55A1F` | 229, 90, 31 | Active state |
| `--brand-accent-glow` | `rgba(255, 107, 44, 0.25)` | — | CTA button shadow |
| `--brand-accent-bg` | `rgba(255, 107, 44, 0.06)` | — | Light accent background |

### Seasonal Accent Colors

| Token | Hex | Usage |
|---|---|---|
| `--season-cool` | `#38BDF8` | Summer/AC mode — cool blue for seasonal badges and highlights |
| `--season-cool-bg` | `rgba(56, 189, 248, 0.08)` | Summer section backgrounds |
| `--season-warm` | `#F97316` | Winter/Heating mode — warm orange for seasonal badges |
| `--season-warm-bg` | `rgba(249, 115, 22, 0.08)` | Winter section backgrounds |

### Supporting Colors

| Token | Hex | Usage |
|---|---|---|
| `--brand-slate` | `#475569` | Body text on light backgrounds |
| `--brand-ice` | `#F0F9FF` | Alternate section background (cool-toned) |
| `--brand-comfort` | `#FFF7ED` | Alternate section background (warm-toned) |

### Why This Palette
- **Deep teal-blue** balances between cool (AC) and warm (heating) — works year-round without favoring either season
- **Warm orange** accent drives action and subconsciously conveys warmth/energy/comfort
- **Seasonal accent colors** allow the page to visually shift between summer and winter without a full redesign
- The cool blue and warm orange create natural visual associations with the services

---

## Color Application Map

| Page Element | Background | Text | Accent/Border |
|---|---|---|---|
| Sticky header | `--white` | `--gray-800` | `--brand-accent` (CTA), `--error` (emergency badge) |
| Hero section | `--brand-primary-dark` at 55% over photo | `--white` | `--brand-accent` (CTA) |
| Emergency banner | `--error` | `--white` | White border/icon |
| Services cards | `--white` | `--gray-800` / `--gray-600` | `--brand-accent` (icon bg), seasonal accent (border) |
| Seasonal offer | `--season-cool-bg` or `--season-warm-bg` | `--gray-800` | Dashed border in seasonal color |
| Why choose us | `--brand-ice` | `--gray-800` | `--brand-primary` (icons) |
| Reviews | `--white` | `--gray-800` | `--warning` (stars) |
| Booking form section | `--brand-primary` | `--white` | `--brand-accent` (submit) |
| Maintenance plan | `--brand-comfort` | `--gray-800` | `--brand-accent` (plan badges) |
| Brands strip | `--white` | Grayscale logos | None |
| Financing | `--brand-ice` | `--gray-700` | `--brand-primary` (partner badges) |
| Final CTA | `--brand-primary-dark` | `--white` | `--brand-accent` (buttons) |
| Footer | `--gray-900` | `--gray-300` / `--white` | `--brand-accent` (links) |

---

## Component Variations

### Hero Treatment
- Background: Photo of tech at work or with customer
- Overlay: Radial gradient from `--brand-primary-dark` at 65% (center-left) fading to 45% (edges)
- Softer feel than roofing — less dramatic, more welcoming
- Desktop: Text left-aligned, ~50% width, with a subtle temperature comfort graphic (optional)
- Mobile: Center-aligned, 60% overlay

### Service Cards (HVAC-Specific)
- Icons: Custom SVG on rounded square background (8px radius)
- Icon background: Seasonal color at 10% opacity (cool blue for AC, warm orange for heating)
- Hover: Bottom border appears in seasonal accent, lift effect
- **Seasonal reordering:** AC cards first in summer, Heating first in winter

### Maintenance Plan Cards
- **This is a premium design element unique to HVAC**
- Card style: Elevated with `--shadow-lg` and a subtle gradient top border (accent → accent-light)
- Plan name: Large, bold, in `--brand-primary`
- Price: `--brand-accent`, 32px, bold — the number is the visual anchor
- Feature list: Checkmarks in `--success` green
- CTA: Full-width `--brand-accent` button at bottom
- "Most Popular" badge: Absolute positioned top-right corner, `--brand-accent` background, white text, slight rotation (-3deg) for visual pop

### Seasonal Offer Card
- Dashed border: 2px in current seasonal accent color
- Background: Current seasonal background (`--season-cool-bg` or `--season-warm-bg`)
- Corner ribbon or badge: "LIMITED TIME" in seasonal accent
- Expiration date: Bold, creates urgency
- Design feels like a coupon/voucher — familiar, trustworthy

### Trust Badges
- Style: Rounded rectangle (`--radius-md`)
- Background: `--brand-primary` at 6% opacity
- Text: `--brand-primary`, 14px, 600 weight
- Seasonal badges use seasonal color instead of primary
- Examples: `✓ Licensed & Insured` `❄️ AC Experts` `🔥 Heating Pros` `★ 4.8 Rating`

### Emergency Banner
- Background: Linear gradient from `#DC2626` to `#B91C1C`
- Text: White, 500 weight
- Icon: Animated pulse (very subtle, CSS-only) on the phone icon
- CTA: White button with red text, or white text with underline

---

## Photography Direction

### Hero Image Options (Rank by preference)
1. **Tech with homeowner** — uniformed tech explaining something on a tablet/clipboard to smiling homeowner, equipment visible in background
2. **Clean install shot** — new outdoor AC unit or furnace, professionally installed, in a well-kept home setting
3. **Comfort scene** — family comfortable at home (subtle) with tech in background completing work
4. **Branded truck + tech** — tech stepping out of wrapped vehicle at a home

### Service/Product Photos
- Clean shots of equipment: new AC units, furnaces, thermostats, air purifiers
- Show the equipment in context (installed in a home), not isolated product shots
- Thermostat close-ups work well for "comfort" messaging

### Seasonal Photography
- **Summer:** Bright, warm outdoor light, green lawns, AC units
- **Winter:** Cozy interior lighting, furnace/heating equipment, warm tones
- Have at least one hero image per season

### Team Photos
- Uniformed (polo/button-up with company logo)
- Clean, professional appearance (HVAC techs have a reputation issue — counter it)
- In front of a clean, organized service van
- Smiling, approachable

### Image Specifications

| Image Type | Dimensions | Max File Size | Format |
|---|---|---|---|
| Hero (desktop) | 1920 x 1080 | 180KB | WebP (JPEG fallback) |
| Hero (mobile) | 800 x 1000 | 100KB | WebP (JPEG fallback) |
| Equipment photos | 800 x 600 | 80KB | WebP |
| Team photo | 800 x 600 | 80KB | WebP |
| Brand logos (Carrier, etc.) | 160 x 80 | 8KB | SVG preferred |
| Seasonal offer graphics | 600 x 400 | 60KB | WebP |
| Trust/certification badges | 120 x 60 | 10KB | SVG preferred |

---

## Custom Icons (HVAC-Specific SVGs)

Phosphor style (1.5px stroke, rounded caps):

| Icon | Description | Used In |
|---|---|---|
| `hvac-ac-unit` | AC condenser unit outline | AC service card |
| `hvac-furnace` | Furnace/heating unit outline | Heating service card |
| `hvac-thermostat` | Smart thermostat face | Maintenance/comfort messaging |
| `hvac-snowflake` | Geometric snowflake | Summer/AC badge |
| `hvac-flame` | Clean flame icon | Winter/heating badge |
| `hvac-air-flow` | Wavy lines representing air flow | Indoor air quality card |
| `hvac-filter` | Air filter outline | Maintenance plan feature |
| `hvac-duct` | Ductwork cross-section | Duct cleaning/IAQ |
| `hvac-maintenance` | Calendar with wrench | Maintenance plan section |

### Icon Style
- Stroke: 1.5px
- Corners: Rounded
- Viewbox: 32 x 32
- Color: `currentColor`
- Format: Inline SVG or sprite

---

## HVAC-Specific UI Patterns

### Seasonal Theme Toggle
The page should shift visual tone between summer and winter:

| Element | Summer Mode | Winter Mode |
|---|---|---|
| Hero headline | AC-focused | Heating-focused |
| Hero image | Outdoor/bright | Indoor/warm |
| Service card order | AC first | Heating first |
| Seasonal accent | `--season-cool` | `--season-warm` |
| Icon highlights | Snowflake | Flame |
| Offer section | AC tune-up | Furnace check |
| Alternate section bg | `--brand-ice` | `--brand-comfort` |

Implementation: CSS class on `<body>` — `.season-summer` or `.season-winter` — swaps custom properties. Updated quarterly by the client or automated by date.

### Maintenance Plan Spotlight
- Dedicated visual treatment — this is a revenue multiplier
- Use a "membership card" design metaphor
- Show dollar savings prominently: "Members save an average of $XXX/year"
- Social proof within the section: "XXX homeowners are already members"
- Urgent slot counter (optional): "X spots remaining this month"

### Financing Calculator (Optional Enhancement)
- Simple monthly payment estimator
- Input: System price (dropdown ranges: $8K, $10K, $12K, $15K)
- Output: "As low as $XX/month"
- Links to financing application
- Builds perceived affordability for $10K+ systems

### Brand Logo Strip
- Grayscale logos by default → color on hover
- Smooth transition (0.3s)
- "Authorized [Brand] Dealer" highlighted if applicable
- 6-8 logos in a single row (scroll on mobile)

---

## Sample Color Preview (CSS Custom Properties)

```css
:root {
  /* HVAC Brand Colors */
  --brand-primary: #0F4C75;
  --brand-primary-light: #1B6B9E;
  --brand-primary-dark: #0A3452;
  --brand-accent: #FF6B2C;
  --brand-accent-light: #FF8550;
  --brand-accent-dark: #E55A1F;
  --brand-accent-glow: rgba(255, 107, 44, 0.25);
  --brand-accent-bg: rgba(255, 107, 44, 0.06);
  --brand-slate: #475569;
  --brand-ice: #F0F9FF;
  --brand-comfort: #FFF7ED;
  
  /* Seasonal */
  --season-cool: #38BDF8;
  --season-cool-bg: rgba(56, 189, 248, 0.08);
  --season-warm: #F97316;
  --season-warm-bg: rgba(249, 115, 22, 0.08);
}
```
