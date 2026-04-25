# Design System — Home Services Landing Pages

> **Design philosophy:** Clean, fast, trustworthy. Every design decision serves conversion. Modern without being trendy — these pages need to feel professional and established, not like a startup. The visitor should think "this company has their act together" within 2 seconds.

---

## Design Principles

1. **Clarity over cleverness** — No ambiguity. The visitor knows what to do instantly.
2. **Trust through restraint** — Clean layouts, consistent spacing, and professional photography signal legitimacy.
3. **Mobile-first, always** — 70%+ of home service searches happen on phones. Design for thumbs.
4. **Speed is a feature** — Every asset is optimized. No decorative bloat.
5. **Contrast drives action** — CTAs must be impossible to miss.

---

## Typography

### Font Stack

| Role | Font | Fallback | Weight | Why |
|---|---|---|---|---|
| **Headlines** | Inter | system-ui, -apple-system, sans-serif | 700 (Bold), 800 (ExtraBold) | Clean, highly legible, modern sans-serif. Free via Google Fonts. Excellent at large sizes. |
| **Body** | Inter | system-ui, -apple-system, sans-serif | 400 (Regular), 500 (Medium) | Same family for consistency. Superb readability at small sizes. |
| **Accents / Badges** | Inter | system-ui, -apple-system, sans-serif | 600 (SemiBold) | Used for trust badges, labels, and small UI elements |
| **Phone Numbers** | Inter | system-ui, -apple-system, sans-serif | 800 (ExtraBold) | Phone numbers must be the boldest text on the page |

> **Alternative option:** If the client wants more personality, swap headlines to **Plus Jakarta Sans** (geometric, friendly, modern) or **Outfit** (clean, slightly warmer). Keep body as Inter regardless.

### Type Scale

| Element | Desktop | Mobile | Line Height | Letter Spacing |
|---|---|---|---|---|
| H1 (Hero headline) | 56px / 3.5rem | 36px / 2.25rem | 1.1 | -0.02em |
| H2 (Section headlines) | 40px / 2.5rem | 28px / 1.75rem | 1.2 | -0.01em |
| H3 (Card titles) | 24px / 1.5rem | 20px / 1.25rem | 1.3 | 0 |
| H4 (Sub-labels) | 18px / 1.125rem | 16px / 1rem | 1.4 | 0.01em |
| Body (paragraphs) | 18px / 1.125rem | 16px / 1rem | 1.6 | 0 |
| Small (captions, fine print) | 14px / 0.875rem | 13px / 0.8125rem | 1.5 | 0.01em |
| Phone Number (header) | 22px / 1.375rem | 18px / 1.125rem | 1.0 | 0.02em |
| Phone Number (hero/CTA) | 32px / 2rem | 24px / 1.5rem | 1.0 | 0.02em |

### Typography Rules
- Headlines: Sentence case, never ALL CAPS (except badges/labels)
- Max line width: 680px for body text (readability)
- No italic text anywhere — use weight changes for emphasis
- Phone numbers always use tabular (monospace) numerals

---

## Spacing System

Based on an **8px grid**. Every margin, padding, and gap is a multiple of 8.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight gaps (icon-to-label) |
| `--space-2` | 8px | Inline spacing, small gaps |
| `--space-3` | 16px | Card internal padding, form field gaps |
| `--space-4` | 24px | Section sub-element spacing |
| `--space-5` | 32px | Between content groups |
| `--space-6` | 48px | Section internal padding (top/bottom) |
| `--space-7` | 64px | Between major sections (desktop) |
| `--space-8` | 80px | Large section padding (desktop) |
| `--space-9` | 120px | Hero section padding (desktop) |

### Mobile Overrides
- Section padding reduces by ~40% on mobile
- `--space-7` → 40px, `--space-8` → 56px, `--space-9` → 80px

### Container
- Max content width: **1200px**
- Side padding: 24px (mobile), 48px (tablet), auto-centered (desktop)

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Badges, tags, small elements |
| `--radius-md` | 12px | Cards, form inputs, buttons |
| `--radius-lg` | 16px | Large cards, image containers |
| `--radius-xl` | 24px | Featured sections, hero overlays |
| `--radius-full` | 9999px | Pill buttons, avatar circles |

---

## Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Subtle lift (badges, small cards) |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.10)` | Cards, form containers |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.12)` | Elevated cards, modals, sticky header |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.14)` | Floating CTA bar, popups |
| `--shadow-cta` | `0 4px 16px [brand-color-at-30%-opacity]` | CTA buttons (colored glow) |

---

## Buttons

### Primary CTA
- Background: Industry accent color (see industry tokens)
- Text: White, 600 weight, 18px
- Padding: 16px 32px
- Border radius: `--radius-md` (12px)
- Shadow: `--shadow-cta`
- Hover: Darken background 10%, lift shadow slightly
- Active: Darken 15%, reduce shadow
- Min touch target: 48px height (mobile accessibility)
- Full-width on mobile

### Secondary CTA
- Background: Transparent
- Border: 2px solid industry accent color
- Text: Industry accent color, 600 weight
- Padding: 14px 28px
- Hover: Fill with accent color at 8% opacity
- Same radius and touch targets as primary

### Phone Number Button (Special)
- Background: Industry accent color
- Text: White, 800 weight
- Icon: Phone icon left of number
- Padding: 16px 36px
- Full-width on mobile
- Pulse animation on load (subtle, once) to draw attention

### Ghost Button
- Background: Transparent
- Text: Dark gray or white (depending on section background)
- Underline on hover
- Used for: "Learn more", "See all reviews", tertiary actions

### Button States
- Default → Hover (0.2s ease) → Active → Disabled (50% opacity, no pointer events)
- Loading state: Replace text with spinner, maintain button width
- Focus: 3px outline offset in brand color (accessibility)

---

## Cards

### Service Card
- Background: White
- Border: 1px solid `--gray-200`
- Border radius: `--radius-lg`
- Padding: 32px
- Shadow: `--shadow-md`
- Hover: Translate Y -4px, shadow increases to `--shadow-lg`, border color transitions to accent
- Icon: 48px, accent color
- Title: H3, dark
- Description: Body, gray-600
- CTA link: Accent color, arrow icon, no underline

### Review Card
- Background: White
- Border: 1px solid `--gray-100`
- Border radius: `--radius-lg`
- Padding: 28px
- Shadow: `--shadow-sm`
- Star rating: Gold/amber (`#F59E0B`), 20px icons
- Quote: Body text, dark, italic style NOT used — use regular weight with quotation marks
- Attribution: Small text, gray-500, "— Name, City"
- Google badge: Small Google "G" icon + "Google Review" text, gray-400

### Offer/Promotion Card
- Background: Accent color at 5% opacity
- Border: 2px dashed accent color
- Border radius: `--radius-lg`
- Padding: 32px
- Headline: H3, accent color
- Fine print: Small, gray-500

---

## Form Design

### Input Fields
- Background: White
- Border: 1.5px solid `--gray-300`
- Border radius: `--radius-md`
- Padding: 14px 16px
- Font: 16px (MINIMUM on mobile — prevents iOS zoom)
- Focus: Border color → accent, subtle box shadow in accent at 20% opacity
- Error: Border color → red (`#EF4444`), error message in red below field
- Label: Above field, 14px, 600 weight, gray-700

### Dropdown
- Same styling as input
- Custom chevron icon (replace native)
- Native select on mobile (better UX)

### Toggle/Radio
- Custom styled, 48px touch target minimum
- Accent color when selected
- Smooth transition (0.15s)

### Form Container
- Background: White or light gray (`--gray-50`)
- Border radius: `--radius-xl`
- Padding: 40px (desktop), 24px (mobile)
- Shadow: `--shadow-lg`

### Submit Button
- Full-width within form
- Primary CTA styling
- Min height: 56px
- Text: 18px, 700 weight

---

## Icons

### Icon Set: Phosphor Icons (Regular weight)

> **Why Phosphor:** Open source, consistent design language, available as SVG/React/Vue components, modern outline style that pairs well with Inter. 700+ icons covering all home service needs.

### Usage Rules
- Size: 24px (inline), 32px (cards), 48px (featured)
- Color: Match the text color of the context, or accent color for emphasis
- Stroke width: 1.5px (default regular weight)
- Never mix filled and outline styles on the same page

### Required Icons by Section

| Section | Icons Needed |
|---|---|
| Header | Phone, Calendar, Menu (hamburger), Clock |
| Services | Wrench, Flame, Snowflake, Drop, Lightning, Shield, HouseLine |
| Trust badges | Star, ShieldCheck, Certificate, CurrencyDollar, Clock, Broom |
| How it works | PhoneCall, MagnifyingGlass, CheckCircle, Handshake |
| Form | User, Phone, EnvelopeSimple, MapPin, CaretDown |
| Footer | MapPin, Phone, EnvelopeSimple, FacebookLogo, GoogleLogo |
| Mobile bar | Phone, ChatText, CalendarBlank |

### Custom Icons (SVG, create per industry)
- Industry-specific service icons (roof, AC unit, pipe, etc.)
- Style: Match Phosphor's line weight and corner radius
- Format: SVG, optimized with SVGO

---

## Photography Guidelines

### Hero Images
- Real photos of the client's team, never stock
- Shot on location (at a job site or in front of branded truck)
- Natural lighting preferred, professional quality
- Show people: uniformed crew, handshake with homeowner, team photo
- Minimum resolution: 1920x1080 for desktop hero
- Serve as WebP with JPEG fallback
- Compressed to <200KB for hero, <100KB for other images

### Project/Gallery Photos
- Before/after pairs shot from the same angle
- Consistent lighting between before and after
- Include context (the whole house/room, not just a close-up of the work)
- Drone shots for roofing (dramatic, unique)
- Minimum 6 project photos per client at launch

### Team/Trust Photos
- Uniformed technicians (clean, professional appearance)
- Branded vehicles
- Team group photo (builds "real company" trust)
- Behind-the-scenes work shots (authenticity)

### Photo Treatment
- Hero: Dark overlay at 50% opacity for text readability
- Gallery: No filters, true color
- Cards: Slight border radius crop (`--radius-lg`)
- All images: `loading="lazy"` except hero (hero must be eager-loaded)

---

## Animations & Micro-Interactions

### Scroll Animations
- Elements fade in + slide up 16px as they enter viewport
- Stagger: 100ms delay between sibling elements (cards in a row)
- Duration: 0.4s, ease-out
- Trigger: When element is 20% visible
- Implementation: CSS `@keyframes` + Intersection Observer (no heavy libraries)
- `prefers-reduced-motion: reduce` — disable all animations

### Hover States
- Cards: translateY(-4px) + shadow lift, 0.2s ease
- Buttons: Background darken + subtle shadow shift, 0.15s ease
- Links: Color shift + underline slide-in, 0.15s ease
- Icons: Slight scale (1.05) on parent hover

### Loading States
- Form submit: Button text replaced with spinner (CSS-only), button disabled
- Calendar widget: Skeleton loader while embed loads
- Images: Subtle blur-up (low-res placeholder → full image)

### Phone Number Pulse (Mobile)
- On initial page load, the floating call button pulses once
- CSS animation: scale 1 → 1.05 → 1, with subtle box-shadow expansion
- Plays once, does not repeat (not annoying)
- Purpose: Draw eye to the primary conversion action

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Notes |
|---|---|---|
| Mobile | 0–639px | Single column, stacked layout, floating bottom CTA bar |
| Tablet | 640–1023px | 2-column grids, side padding increases |
| Desktop | 1024–1279px | Full layout, 3-4 column grids |
| Large Desktop | 1280px+ | Content centered at max-width 1200px |

### Mobile-Specific Rules
- All phone numbers are click-to-call links (`tel:`)
- Floating bottom CTA bar (56px height) — account for this in bottom padding
- No hover-dependent interactions (everything works on tap)
- Form inputs minimum 16px font (prevents iOS auto-zoom)
- Sticky header height: 64px
- Touch targets: minimum 48x48px

---

## Accessibility Requirements

| Requirement | Standard |
|---|---|
| Color contrast (text) | WCAG AA — 4.5:1 minimum for body, 3:1 for large text |
| Color contrast (UI) | 3:1 for interactive elements against background |
| Focus indicators | Visible focus ring on all interactive elements |
| Alt text | All images have descriptive alt text |
| Semantic HTML | Proper heading hierarchy (H1 → H2 → H3), landmark regions |
| Keyboard navigation | All interactive elements reachable via Tab, activatable via Enter/Space |
| Screen reader | Form labels linked to inputs, error messages announced, ARIA where needed |
| Motion | `prefers-reduced-motion` respected — disable animations |

---

## Shared Color Tokens (Non-Industry-Specific)

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| `--white` | `#FFFFFF` | Backgrounds, card surfaces |
| `--gray-50` | `#F9FAFB` | Alternate section backgrounds |
| `--gray-100` | `#F3F4F6` | Borders (subtle), dividers |
| `--gray-200` | `#E5E7EB` | Card borders, input borders (default) |
| `--gray-300` | `#D1D5DB` | Input borders (hover) |
| `--gray-400` | `#9CA3AF` | Placeholder text, disabled elements |
| `--gray-500` | `#6B7280` | Secondary text, captions |
| `--gray-600` | `#4B5563` | Body text (secondary) |
| `--gray-700` | `#374151` | Body text (primary), form labels |
| `--gray-800` | `#1F2937` | Headlines |
| `--gray-900` | `#111827` | Hero text, bold headlines |

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#10B981` | Success states, confirmations |
| `--warning` | `#F59E0B` | Warnings, star ratings |
| `--error` | `#EF4444` | Error states, form validation |
| `--info` | `#3B82F6` | Informational badges |

### Emergency/Alert

| Token | Hex | Usage |
|---|---|---|
| `--emergency-bg` | `#FEF2F2` | Emergency banner background (light) |
| `--emergency-border` | `#EF4444` | Emergency banner accent |
| `--emergency-text` | `#991B1B` | Emergency banner text |

---

## File Naming & Asset Organization

```
templates/
├── design-system.md          ← This file (shared foundation)
├── roofing/
│   ├── roofing-copy.md       ← Page copy/structure
│   └── roofing-design.md     ← Industry-specific design tokens
├── hvac/
│   ├── hvac-copy.md          ← Page copy/structure
│   └── hvac-design.md        ← Industry-specific design tokens
└── plumbing/
    ├── plumbing-copy.md      ← Page copy/structure
    └── plumbing-design.md    ← Industry-specific design tokens
```

### Asset Folders (Per Client Project)
```
client-name/
├── assets/
│   ├── images/
│   │   ├── hero/             ← Hero photos (WebP + JPEG fallback)
│   │   ├── gallery/          ← Before/after project photos
│   │   ├── team/             ← Team/truck photos
│   │   └── misc/             ← Badges, partner logos
│   ├── icons/                ← Custom SVG icons
│   └── fonts/                ← Self-hosted Inter (if not using Google Fonts CDN)
├── styles/
│   ├── tokens.css            ← CSS custom properties (from design system)
│   ├── base.css              ← Reset + typography + global styles
│   └── components.css        ← Cards, buttons, forms, sections
└── index.html                ← Landing page
```
