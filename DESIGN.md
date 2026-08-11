---
name: AgencyOS House Floor
description: The shared craft floor for every AgencyOS local-service landing page — binding unless an industry world overrides it explicitly.
colors:
  white: "#FFFFFF"
  gray-50: "#F9FAFB"
  gray-100: "#F3F4F6"
  gray-200: "#E5E7EB"
  gray-300: "#D1D5DB"
  gray-400: "#9CA3AF"
  gray-500: "#6B7280"
  gray-600: "#4B5563"
  gray-700: "#374151"
  gray-800: "#1F2937"
  gray-900: "#111827"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
  info: "#3B82F6"
  emergency-bg: "#FEF2F2"
  emergency-border: "#EF4444"
  emergency-text: "#991B1B"
---

# Design System: AgencyOS House Floor

<!-- Migrated from templates/design-system.md, which is now retired to a pointer stub. -->
<!-- This is the repo-root fallback: any project without its own DESIGN.md inherits it. -->
<!-- Industry worlds at templates/<industry>/DESIGN.md override this file WHOLE-FILE. -->
<!-- They each carry an "extends" directive back here; honor it. -->

## Overview

**Creative North Star: "The company that has its act together"**

This is not a brand. It is a floor — the set of decisions that must hold on every landing page AgencyOS ships, regardless of vertical, so that the four industry worlds layered on top can differ loudly without any of them shipping something slow, unreachable, or untrustworthy. Every rule here exists because it serves conversion for a local service business whose visitor arrived from a phone, in a hurry, with a problem.

The aesthetic baseline is clean, fast, and established — modern without being trendy. These pages must not read as startups. A visitor should conclude "this company is legitimate and I can reach them right now" inside two seconds, and the design's job is to remove every obstacle between that conclusion and a tap on a phone number.

Density is moderate and generous rather than packed: an 8px grid, real whitespace between sections, and a single unmistakable action per viewport. Where an industry world wants to be editorial, luxurious, or aggressive, it earns that on top of this floor, never by discarding it.

**Key Characteristics:**
- Mobile-first without exception — 70%+ of local service searches are on phones
- One dominant action per screen, always reachable, always a `tel:` link
- Trust conveyed through restraint and real photography, never through decoration
- Performance treated as a design constraint, not an optimization pass
- WCAG AA is the floor, not the goal

## Colors

A neutral gray ramp plus semantic signals. This file deliberately defines **no brand or accent color** — that is the industry world's job, and every rule below that says "accent" resolves against the industry palette.

### Neutral
- **White** (#FFFFFF): Page and card surfaces.
- **Gray 50** (#F9FAFB): Alternate section backgrounds, form container fill.
- **Gray 100** (#F3F4F6): Subtle borders and dividers; review card borders.
- **Gray 200** (#E5E7EB): Default card and input borders.
- **Gray 300** (#D1D5DB): Input border at hover.
- **Gray 400** (#9CA3AF): Placeholder text, disabled elements, Google-badge chrome.
- **Gray 500** (#6B7280): Secondary text, captions, attribution, fine print.
- **Gray 600** (#4B5563): Secondary body copy, card descriptions.
- **Gray 700** (#374151): Primary body text and form labels.
- **Gray 800** (#1F2937): Section headlines.
- **Gray 900** (#111827): Hero text and the heaviest headlines.

### Semantic
- **Success** (#10B981): Confirmations, submitted states.
- **Warning** (#F59E0B): Warnings and star ratings — this is the star gold.
- **Error** (#EF4444): Validation failures, error borders and messages.
- **Info** (#3B82F6): Informational badges only.

### Emergency
- **Emergency BG** (#FEF2F2): Storm/after-hours banner background.
- **Emergency Border** (#EF4444): Banner accent rule.
- **Emergency Text** (#991B1B): Banner copy.

### Named Rules

**The Accent Scarcity Rule.** The industry accent is the conversion color. It belongs to CTAs, the phone number, active states, and focus rings — and essentially nothing else. When accent starts appearing on decorative dividers and section labels, the CTA stops being findable and the page stops converting.

**The No Invented Palette Rule.** Never introduce a color that is not in this file or the active industry world. A page needing a color it does not have is a page that needs a decision recorded in the industry DESIGN.md first.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, sans-serif)
**Body Font:** Inter (with system-ui, -apple-system, sans-serif)
**Label/Mono Font:** Inter, with tabular numerals mandatory on phone numbers

**Character:** One family doing all the work, differentiated purely by weight. The restraint is intentional — a single superbly legible neutral sans reads as competent and costs one font load. Industry worlds may swap the *display* face for personality (Plus Jakarta Sans for warmth, Outfit for softness, an editorial serif for luxury verticals); body stays Inter unless the industry world argues otherwise in writing.

### Hierarchy
- **H1 / Hero** (700–800, 56px desktop / 36px mobile, 1.1, -0.02em): One per page. The promise.
- **H2 / Section** (700, 40px / 28px, 1.2, -0.01em): Section entry points.
- **H3 / Card title** (700, 24px / 20px, 1.3, 0): Service and review card headings.
- **H4 / Sub-label** (600, 18px / 16px, 1.4, 0.01em): Supporting labels.
- **Body** (400, 18px / 16px, 1.6, 0): Paragraphs. Max measure 680px.
- **Small** (400, 14px / 13px, 1.5, 0.01em): Captions, fine print, attribution.
- **Phone (header)** (800, 22px / 18px, 1.0, 0.02em): Tabular numerals.
- **Phone (hero/CTA)** (800, 32px / 24px, 1.0, 0.02em): Tabular numerals.

### Named Rules

**The Boldest Thing Is The Phone Number Rule.** On any page where calling is the primary conversion, the phone number carries the heaviest weight on screen (800). If a headline out-weighs the number, the hierarchy is wrong.

**The No Italics Rule.** No italic text anywhere in the house floor — emphasis is carried by weight. Industry worlds with an editorial thesis may overturn this explicitly for accents; none may use italics for body copy.

**The Sentence Case Rule.** Headlines are sentence case. ALL CAPS is reserved for badges and small labels.

## Layout

An 8px grid governs every margin, padding, and gap. Content maxes at **1200px** and centers; side padding is 24px mobile, 48px tablet.

Spacing tokens: `--space-1` 4px (icon-to-label), `--space-2` 8px (inline), `--space-3` 16px (card padding, field gaps), `--space-4` 24px (sub-element), `--space-5` 32px (content groups), `--space-6` 48px (section internal), `--space-7` 64px (between sections), `--space-8` 80px (large section), `--space-9` 120px (hero).

On mobile, section padding drops ~40%: `--space-7` → 40px, `--space-8` → 56px, `--space-9` → 80px.

Breakpoints: Mobile 0–639px (single column, stacked, floating bottom CTA bar); Tablet 640–1023px (2-column grids); Desktop 1024–1279px (3–4 column grids); Large 1280px+ (centered at 1200px).

Mobile structural constants: sticky header 64px, floating bottom CTA bar 56px — reserve bottom padding for it so the bar never occludes the footer or a form's submit button.

## Elevation & Depth

A hybrid system: surfaces are white on gray-50 tonal alternation, with a small shadow vocabulary carrying interaction and importance. Shadows are soft and low-opacity — they suggest a lifted card, never a dropped one.

### Shadow Vocabulary
- **Subtle** (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`): Badges, review cards, small chrome.
- **Card** (`box-shadow: 0 4px 12px rgba(0,0,0,0.10)`): Service cards, form containers at rest.
- **Elevated** (`box-shadow: 0 8px 30px rgba(0,0,0,0.12)`): Hover state, modals, sticky header once scrolled.
- **Floating** (`box-shadow: 0 16px 48px rgba(0,0,0,0.14)`): Mobile CTA bar, popups.
- **CTA glow** (`box-shadow: 0 4px 16px <accent at 30% opacity>`): Primary buttons only.

### Named Rules

**The Colored Shadow Belongs To The CTA Rule.** Only the primary CTA gets a tinted shadow. Every other shadow is neutral black at low alpha. This is what makes the button read as the live object on the page.

## Shapes

Rounded-rectangle form language throughout, no sharp corners and no circles except avatars. `--radius-sm` 6px (badges, tags), `--radius-md` 12px (cards, inputs, buttons), `--radius-lg` 16px (large cards, image containers), `--radius-xl` 24px (featured sections, form containers, hero overlays), `--radius-full` 9999px (pills, avatars).

Borders are hairline and structural: 1px gray-200 on cards, 1.5px gray-300 on inputs, 2px on secondary buttons and promotional cards. Images crop to `--radius-lg`.

## Components

### Buttons
- **Shape:** `--radius-md` (12px). Full-width on mobile.
- **Primary:** Accent background, white text, 600 weight, 18px, padding 16px 32px, CTA-glow shadow. Minimum 48px height.
- **Hover / Focus:** Hover darkens the background 10% and lifts the shadow (0.15s ease). Active darkens 15% and reduces shadow. Focus shows a 3px accent outline with offset.
- **Secondary:** Transparent with a 2px accent border, accent text at 600, padding 14px 28px; hover fills accent at 8%.
- **Phone button:** Accent background, white 800-weight text, phone icon at left, padding 16px 36px. Pulses once on load — scale 1 → 1.05 → 1 with a box-shadow expansion — then never again.
- **Ghost:** Transparent, dark gray or white by context, underline on hover. Tertiary actions only.
- **Disabled:** 50% opacity, pointer events off. **Loading:** text swaps to a CSS spinner at fixed button width.

### Cards / Containers
- **Corner Style:** `--radius-lg` (16px); form containers `--radius-xl` (24px).
- **Background:** White on gray-50 sections; white on white gets a border instead of a shadow.
- **Shadow Strategy:** Card at rest, Elevated on hover.
- **Border:** 1px gray-200 (service), 1px gray-100 (review).
- **Internal Padding:** 32px service, 28px review, 40px form desktop / 24px mobile.
- **Service card:** 48px accent icon, H3 title, gray-600 description, accent CTA link with arrow and no underline. Hover translates Y -4px and transitions the border to accent.
- **Review card:** Star rating in Warning gold at 20px, quote in regular weight with real quotation marks (never italic), attribution in Small gray-500 as "— Name, City", optional Google "G" badge in gray-400.
- **Offer card:** Accent at 5% background, 2px dashed accent border, H3 accent headline, Small gray-500 fine print.

### Inputs / Fields
- **Style:** White fill, 1.5px gray-300 border, `--radius-md`, padding 14px 16px, **16px font minimum** — smaller triggers iOS auto-zoom and breaks the form on the majority device.
- **Focus:** Border shifts to accent with a soft accent box-shadow at 20%.
- **Error:** Border and message in Error red beneath the field.
- **Label:** Above the field, 14px, 600 weight, gray-700, programmatically linked.
- **Dropdown:** Input styling with a custom chevron; native select on mobile.
- **Toggle/Radio:** Custom, 48px touch target minimum, accent when selected, 0.15s transition.
- **Submit:** Full-width, primary styling, 56px minimum height, 18px 700-weight text.

### Navigation
Sticky 64px header carrying the logo and the phone number, with the number as the only accent object. Once scrolled, the header takes the Elevated shadow. On mobile the header collapses to logo plus a call button, and the floating bottom bar carries the full action set (call, message, book).

**Do not apply a `backdrop-filter` to the sticky header if any fixed-position overlay must escape it** — a filtered ancestor becomes the containing block for fixed descendants and the overlay will be trapped and mis-sized.

### Icons
Phosphor Icons, Regular weight, 1.5px stroke. 24px inline, 32px in cards, 48px featured. Color matches contextual text, or accent for emphasis. Never mix filled and outline styles on one page. Custom industry SVGs must match Phosphor's line weight and corner radius, and ship optimized through SVGO.

## Motion

Scroll reveals fade in and rise 16px, 0.4s ease-out, triggered at 20% visibility, staggered 100ms between siblings — implemented with CSS keyframes plus Intersection Observer, no animation library. Hover: cards rise 4px with a shadow lift (0.2s), buttons darken (0.15s), links shift color with an underline slide (0.15s), icons scale 1.05 on parent hover. Images blur up from a low-res placeholder.

`prefers-reduced-motion: reduce` disables all of it, including the phone pulse. This is not optional.

## Performance & Accessibility

Hero images: 1920x1080 minimum, WebP with JPEG fallback, under 200KB, eager-loaded. Every other image under 100KB and `loading="lazy"`.

WCAG AA binds: 4.5:1 contrast for body text and 3:1 for large text and interactive elements; visible focus rings everywhere; descriptive alt text on every image; correct H1→H2→H3 order with landmark regions; full keyboard reachability and Enter/Space activation; labels linked to inputs and errors announced.

## Do's and Don'ts

### Do:
- **Do** make every phone number a `tel:` link, on every breakpoint, without exception.
- **Do** keep body copy to a 680px measure and set form inputs at 16px minimum.
- **Do** use real photography of the client's actual team, crew, trucks, and finished work.
- **Do** reserve 56px of bottom padding on mobile for the floating CTA bar.
- **Do** give the primary CTA the only tinted shadow on the page.
- **Do** honor `prefers-reduced-motion` for every animation including the phone pulse.

### Don't:
- **Don't** ship stock photography of models, generic "happy technician" imagery, or AI-generated people as if they were the client's team. If real assets do not exist, say so and leave a marked placeholder — never fabricate proof.
- **Don't** invent testimonials, review counts, star ratings, license numbers, years in business, or service areas. These are factual claims about a real business.
- **Don't** put more than one primary action in a viewport.
- **Don't** use italics for body copy, or ALL CAPS outside badges and small labels.
- **Don't** introduce a color, radius, or spacing value that is not a token here or in the active industry world.
- **Don't** depend on hover for any interaction that matters — the majority device has no hover.
- **Don't** let a headline out-weigh the phone number on a call-driven page.
