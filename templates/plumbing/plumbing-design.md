# Plumbing — Industry Design Tokens & Assets

> Extends the shared design system (`../design-system.md`) with plumbing-specific colors, imagery, and component treatments.

---

## Brand Personality

**Keywords:** Fast, honest, clean, no-nonsense
**Mood:** Urgent competence. The visitor has a problem RIGHT NOW and needs to trust you immediately. The design must communicate speed and honesty above all else. Less "lifestyle brand," more "we solve problems, fast."

---

## Color Palette

### Primary Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-primary` | `#1A365D` | 26, 54, 93 | Deep authoritative blue — headers, hero overlay, footer, trust |
| `--brand-primary-light` | `#2B4C7E` | 43, 76, 126 | Hover state |
| `--brand-primary-dark` | `#0F2440` | 15, 36, 64 | Active state, dark backgrounds |

### Accent / CTA Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `--brand-accent` | `#16A34A` | 22, 163, 74 | Primary CTA — green signals "go, call now, safe" |
| `--brand-accent-light` | `#22C55E` | 34, 197, 94 | Hover state |
| `--brand-accent-dark` | `#15803D` | 21, 128, 61 | Active state |
| `--brand-accent-glow` | `rgba(22, 163, 74, 0.25)` | — | CTA button shadow |
| `--brand-accent-bg` | `rgba(22, 163, 74, 0.06)` | — | Light accent background |

### Emergency Colors

| Token | Hex | Usage |
|---|---|---|
| `--brand-emergency` | `#DC2626` | Emergency banner, urgent CTAs |
| `--brand-emergency-dark` | `#B91C1C` | Emergency banner gradient end |
| `--brand-emergency-bg` | `#FEF2F2` | Light emergency background |

### Supporting Colors

| Token | Hex | Usage |
|---|---|---|
| `--brand-slate` | `#475569` | Body text |
| `--brand-clean` | `#F8FAFC` | Alternate section background (cool, clean feel) |
| `--brand-trust` | `#EFF6FF` | Trust/pricing section background |

### Why This Palette
- **Deep blue** conveys authority and trustworthiness — counters the "shady plumber" stereotype
- **Green accent** is deliberate and different from most plumbing sites (which use blue or red). Green means "go" — subconsciously encourages the visitor to take action. Also signals safety and honesty.
- **Red reserved exclusively for emergencies** — when everything else is blue/green, the red emergency elements POP with genuine urgency
- Clean, cool tones throughout reinforce the "clean, professional" messaging

---

## Color Application Map

| Page Element | Background | Text | Accent/Border |
|---|---|---|---|
| Sticky header | `--white` | `--gray-800` | `--brand-accent` (CTA), `--brand-emergency` (24/7 badge) |
| Hero section | `--brand-primary-dark` at 60% over photo | `--white` | `--brand-accent` (call button) |
| Emergency banner | Gradient `--brand-emergency` → `--brand-emergency-dark` | `--white` | White icon/border |
| Problem cards | `--white` | `--gray-800` / `--gray-600` | `--brand-accent` (icon), `--brand-primary` (hover border) |
| Why choose us | `--brand-clean` | `--gray-800` | `--brand-primary` (icons) |
| Reviews | `--white` | `--gray-800` | `--warning` (stars) |
| Booking form section | `--brand-primary` | `--white` | `--brand-accent` (submit) |
| Pricing transparency | `--brand-trust` | `--gray-800` | `--brand-primary` (table borders) |
| How it works | `--white` | `--gray-800` | `--brand-accent` (step numbers) |
| Final CTA | `--brand-primary-dark` | `--white` | `--brand-accent` (call button) |
| Footer | `--gray-900` | `--gray-300` | `--brand-accent` (links) |

---

## Component Variations

### Hero Treatment
- **PHONE NUMBER IS THE HERO** — unlike roofing/HVAC, the phone number should be the most visually dominant element
- Background: Photo with heavy overlay — the image is secondary to the number
- Overlay: Solid `--brand-primary-dark` at 65% — intentionally heavier to make the phone number pop
- Phone number: 40px+ desktop / 28px+ mobile, `--brand-accent` background button, `--white` text, full-width on mobile
- Layout: Centered text, not left-aligned — urgency feels centered
- Minimal supporting text — visitor needs to call, not read

### Problem Cards (Plumbing-Specific)
- **Uses problem language, not service language** (critical difference from other trades)
- Icons: Custom SVG in `--brand-emergency` for emergencies, `--brand-primary` for planned work
- Card border-left: 4px solid, color indicates urgency:
  - Red (`--brand-emergency`): Burst pipes, sewer backup, gas leaks
  - Blue (`--brand-primary`): Water heater, fixtures, repiping
- Hover: Full left border + lift
- Emergency cards have a subtle pulsing dot (CSS-only) next to the icon

### Pricing Table
- **Unique to plumbing — major trust differentiator**
- Clean table with alternating row backgrounds (`--white` / `--brand-clean`)
- "Starting at" prices in `--brand-primary`, 20px, bold
- Column headers: `--brand-primary` background, white text
- Border: 1px `--gray-200`, rounded corners on container
- Disclaimer below in `--gray-500`, 14px
- CTA below table: "Get your exact price — call us" in `--brand-accent`

### Trust Badges
- Style: Rounded rectangle with left color bar
- Left bar: 4px solid `--brand-accent`
- Background: `--white`
- Shadow: `--shadow-sm`
- Text: `--gray-800`, 14px, 600 weight
- Icon: `--brand-primary`, 20px
- More substantial than pill badges — plumbing needs heavier trust signals
- Examples: `Licensed, Bonded & Insured` `Upfront Flat-Rate Pricing` `24/7 Emergency` `Satisfaction Guaranteed`

### Emergency Banner
- **Permanent fixture, not conditional** (unlike roofing storm banner)
- Background: Linear gradient `--brand-emergency` → `--brand-emergency-dark`
- Text: White, 600 weight
- Phone number within banner: White, 700 weight, underlined
- Response time callout: "Average response: XX minutes" in a badge
- Slight top shadow to feel elevated above the page

### Review Cards (Plumbing-Specific)
- Prioritize showing the **tech's name** if mentioned in the review
- Add a small "Verified Emergency Call" badge on reviews from emergency situations
- Badge: `--brand-emergency` at 10% opacity background, `--brand-emergency` text

---

## Photography Direction

### Hero Image Options (Rank by preference)
1. **Uniformed plumber arriving at door** — homeowner opening door, plumber with tools, friendly and professional
2. **Branded van at a home** — clean, wrapped vehicle, residential street
3. **Plumber at work** — under a sink or at a water heater, clean workspace, professional gear
4. **Team lineup** — 3-5 uniformed techs in front of fleet

### Service/Equipment Photos
- Water heaters (tank and tankless) — clean, installed
- Camera inspection equipment in action
- Clean workspace shots (drop cloths down, organized tools)
- **Avoid gross/dirty plumbing photos** — no sewage, no corroded pipes on the landing page. Save diagnostic photos for blog content.

### Trust Photography
- **Clean uniforms are the #1 visual trust signal for plumbing**
- Shoe covers being put on at a doorstep
- Drop cloth laid out before work begins
- Organized, clean service van interior
- These "process" photos address the homeowner's fear: "will this person respect my home?"

### Image Specifications

| Image Type | Dimensions | Max File Size | Format |
|---|---|---|---|
| Hero (desktop) | 1920 x 1080 | 150KB (tighter — speed is critical) | WebP (JPEG fallback) |
| Hero (mobile) | 800 x 1000 | 80KB | WebP (JPEG fallback) |
| Service photos | 800 x 600 | 70KB | WebP |
| Team photo | 800 x 600 | 70KB | WebP |
| Trust/process photos | 600 x 400 | 50KB | WebP |
| Certification badges | 120 x 60 | 10KB | SVG preferred |

> **Note:** Plumbing images have the tightest file size budgets of all three trades. Emergency visitors on spotty mobile connections cannot wait for heavy images.

---

## Custom Icons (Plumbing-Specific SVGs)

Phosphor style (1.5px stroke, rounded caps):

| Icon | Description | Used In |
|---|---|---|
| `plumb-pipe-burst` | Pipe with water spraying out | Burst pipe / leak card |
| `plumb-drain` | Drain with swirl/blockage indicator | Clogged drain card |
| `plumb-water-heater` | Tank water heater outline | Water heater card |
| `plumb-toilet` | Toilet side view | Toilet repair card |
| `plumb-faucet-drip` | Faucet with water drop | Faucet/fixture card |
| `plumb-sewer` | Underground pipe cross-section | Sewer line card |
| `plumb-gas-flame` | Gas line with small flame | Gas line services card |
| `plumb-camera` | Camera on flexible cable | Camera inspection mention |
| `plumb-wrench` | Pipe wrench | General plumbing / repair |
| `plumb-emergency` | Phone with alert/pulse rings | Emergency CTA icon |

### Icon Style
- Stroke: 1.5px
- Corners: Rounded
- Viewbox: 32 x 32
- Color: `currentColor`
- Emergency icons: Can use `--brand-emergency` as default color
- Format: Inline SVG or sprite

---

## Plumbing-Specific UI Patterns

### Phone Number as Design Element
The phone number on a plumbing page isn't just a piece of text — it's the primary UI element:

**Header phone:**
- `--brand-accent` background, white text, pill shape
- Phone icon animated with subtle ring on load (CSS only, plays once)
- Min size: 18px mobile, 22px desktop

**Hero phone:**
- Full CTA button treatment
- `--brand-accent` background, white text, `--shadow-cta`
- 28px+ font on mobile
- Phone icon left, right arrow on right
- Full-width on mobile with generous padding (56px height)

**Final CTA phone:**
- Same as hero treatment
- Repeated for the scroller who didn't call from the top

**Floating mobile bar:**
- "Call" button gets 50% width, "Text" and "Book" split remaining 50%
- Call button in `--brand-accent`, others in `--brand-primary`
- This weighting reflects the reality: plumbing converts via phone calls

### Emergency Urgency Indicator
For problem cards that are emergencies (burst pipe, sewer backup, gas leak):
- Small pulsing dot (red, CSS animation) in the card corner
- Subtle but noticeable — signals "this is urgent, we treat it urgently"
- CSS: `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }` — 2s cycle

### Pricing Transparency Section
- This section IS a conversion tool — showing prices builds enough trust to generate the call
- Design it as a clean, scannable table — not cards
- "Starting at" language prevents price anchoring too low
- Include a "Why we show our prices" single-line explainer: "Because you deserve to know before you call"
- This section alone differentiates from 90% of competitors who hide pricing

### Speed/Response Guarantee Badge
- Unique to plumbing among the three trades
- Prominent badge in hero area or "Why Choose Us"
- Design: Clock icon + "On-site in XX minutes or less"
- Treatment: `--brand-primary` background, white text, `--radius-md`, `--shadow-sm`
- If the client can't guarantee a specific time, use "Average response: XX minutes"

### vCard Download CTA (Post-Conversion)
- After form submission or call, offer: "Save our number for emergencies"
- Downloads a .vcf contact card to their phone
- This is a long-term retention play — when the next emergency happens, the plumber is already in their contacts

---

## Page Speed Priority

Plumbing has the strictest performance requirements:

| Optimization | Implementation |
|---|---|
| Critical CSS inlined | Above-the-fold styles in `<head>`, rest async |
| Hero image preloaded | `<link rel="preload">` for hero WebP |
| Fonts subset | Only load Inter weights 400, 600, 800 (skip 500, 700) |
| Icons inline | SVG sprites or inline, no icon font |
| No JS above fold | Form and calendar load below fold |
| Image lazy loading | All images except hero use `loading="lazy"` |
| Minimal DOM | Fewer sections than roofing/HVAC — strip anything non-essential |

Target: **95+ PageSpeed, <2.0s LCP, <1MB total page weight**

---

## Sample Color Preview (CSS Custom Properties)

```css
:root {
  /* Plumbing Brand Colors */
  --brand-primary: #1A365D;
  --brand-primary-light: #2B4C7E;
  --brand-primary-dark: #0F2440;
  --brand-accent: #16A34A;
  --brand-accent-light: #22C55E;
  --brand-accent-dark: #15803D;
  --brand-accent-glow: rgba(22, 163, 74, 0.25);
  --brand-accent-bg: rgba(22, 163, 74, 0.06);
  --brand-slate: #475569;
  --brand-clean: #F8FAFC;
  --brand-trust: #EFF6FF;
  
  /* Emergency */
  --brand-emergency: #DC2626;
  --brand-emergency-dark: #B91C1C;
  --brand-emergency-bg: #FEF2F2;
}
```

---

## Key Design Differences From Roofing & HVAC

| Design Element | Plumbing | Roofing | HVAC |
|---|---|---|---|
| **Phone number treatment** | THE primary design element | Prominent but secondary to form CTA | Equal to form CTA |
| **CTA color** | Green (go/call/safe) | Burnt orange (energy/action) | Warm orange (comfort/energy) |
| **Emergency design** | Permanent, prominent | Conditional (storm events) | Permanent but less dominant |
| **Card framing** | Problem-based with urgency indicators | Service-category based | Service-category + seasonal |
| **Pricing section** | Yes — major trust differentiator | No | No |
| **Image weight budget** | Tightest (150KB hero max) | Standard (180KB) | Standard (180KB) |
| **Visual tone** | Clean, urgent, honest | Strong, protective | Warm, comfortable |
| **Hero layout** | Centered, phone-dominant | Left-aligned, headline-dominant | Left-aligned, seasonal |
| **Gallery/portfolio** | None | Critical (before/after) | None |
| **Seasonal design** | None | Storm mode toggle | Summer/winter theme toggle |
| **Recurring revenue UI** | Not prominent | Not prominent | Maintenance plan spotlight |
| **Unique UI pattern** | Pricing table, emergency pulse dots | Storm mode, before/after slider | Seasonal toggle, plan cards, financing calc |
