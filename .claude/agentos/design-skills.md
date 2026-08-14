# Design skill routing (impeccable + taste-skill)

Two third-party skill packs are installed alongside the AgencyOS design context:

- **`/impeccable`** (v4.0.4, 147 files) — a full design workflow with sub-commands, a context loader, and auto-firing hooks.
- **taste-skill** (13 skills from `Leonxlnx/taste-skill`) — pure-markdown prompt packs, no scripts.

**Precedence on any AgencyOS surface: `/DESIGN.md` + the active `templates/<industry>/DESIGN.md` outrank every skill here.** These skills raise craft *inside* the house floor. They do not replace its palette, type scale, or component vocabulary. The single sanctioned exception is `templates/med-spa/DESIGN.md`, which documents its overrides in an explicit table.

---

## Why most of the taste skills fight this repo

They were written for greenfield Tailwind/React portfolio and marketing work. AgencyOS ships **vanilla HTML/CSS conversion templates for local service businesses**, where consistency across client sites is the product and the visitor is often mid-emergency on a phone. That is close to the opposite brief. The conflicts below are quoted from the skills themselves, not inferred.

| Skill | Verdict | Concrete conflict |
|---|---|---|
| `design-taste-frontend` (v2) | **Use** | Most compatible — explicitly audit-first on redesigns and honors an existing system. Best general-purpose choice here. |
| `redesign-existing-projects` | **Use** | Built to upgrade existing sites without breaking function; framework-agnostic. Good fit for `/refresh-site` work. |
| `high-end-visual-design` | **Cherry-pick only** | **Bans Inter** — the house floor's entire type system. Also bans 1px gray borders (our card spec) and top-glued sticky navbars (our 64px header). Assumes Tailwind. *Worth stealing:* `min-h-[100dvh]` over `h-screen`, transform/opacity-only animation, no scroll listeners, custom cubic-beziers. |
| `minimalist-ui` | **Med-spa only** | "No gradients, no heavy shadows, warm monochrome, muted pastels" conflicts with the house shadow vocabulary and every industry accent — but is close to `med-spa/DESIGN.md`'s editorial world. |
| `gpt-taste` | **Do not use on client pages** | Mandates **GSAP** (heavy dep vs. our perf budget and "no animation library" rule), pinned/horizontal scroll sections, and a "variance mandate" forbidding the same layout twice — which is directly hostile to a template business and to an emergency visitor who needs a `tel:` link in under a second. |
| `industrial-brutalist-ui` | **Do not use** | Declassified-blueprint/military-terminal aesthetic. Off-brand for every vertical here. |
| `stitch-design-taste` | **Do not use** | Generates a competing `DESIGN.md` for Google Stitch. Would collide with our context files. |
| `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code` | **Idea generators** | Image generation and mockup work. Nothing they output ships without reconciling against the house floor. `image-to-code` also wants to generate its own reference imagery first. |
| `design-taste-frontend-v1` | **Ignore** | Legacy, superseded by v2. Kept only for backward compat. |
| `full-output-enforcement` | **Not a design skill** | Behavioral override that bans truncation/placeholders. Note it fights our rule that unsupplied client facts get a *visible placeholder* rather than invented content — the house floor wins. |

---

## Routing

**Default to `/impeccable`** for AgencyOS design work. It is the only pack wired into our context files, and its sub-commands map onto real jobs:

| Job | Command |
|---|---|
| Plan a new surface before coding | `/impeccable shape <surface>` |
| UX review with heuristic scoring | `/impeccable critique <target>` |
| a11y / perf / responsive checks | `/impeccable audit <target>` |
| Pre-ship quality pass | `/impeccable polish <target>` |
| Record an incumbent system as DESIGN.md | `/impeccable document` |
| Fix spacing and hierarchy | `/impeccable layout <target>` |
| Copy, labels, error messages | `/impeccable clarify <target>` |

Run `node .claude/skills/impeccable/scripts/context.mjs` once per session from the directory you're working in — it resolves and prints the right PRODUCT.md/DESIGN.md pair. Do not rerun it.

Reach for a taste skill only when `/impeccable` has been tried and the work specifically needs that skill's lens, per the table above.

### The one sanctioned two-pack pattern: `/redesign-site` A/B

`/redesign-site` deliberately runs **both** packs on the same client, producing two versions
the client chooses between: **A** from `/impeccable` (on-floor, conversion-first, the
guaranteed-shippable one) and **B** from `/design-taste-frontend` (anti-slop, freer on
composition). This is not a contradiction of the precedence rule above — both build from the
same seeded industry world and the same verified `fact-sheet.md`; only the design lens differs.

Two conditions make it safe, and neither is optional:

1. **Version B runs only with a written brief** at `clients/<slug>/briefs/taste-brief.md`
   carrying eight explicit overrides. `design-taste-frontend` defaults to React/Next +
   Tailwind, discourages Inter, bans `<link>`-loaded Google Fonts, bans hand-rolled SVG
   icons, bans Fraunces, and requires real images — every one of which collides with the
   house floor or the templates. The exact table lives in
   `.claude/skills/redesign-site/SKILL.md` §5b.
2. **Three of its bans are allowed to win on B** — no 3-column equal feature cards, the
   layout-repetition ban, and the zigzag cap. That is the entire point of having a B; a B
   that obeys every house habit is not a second option.

Version A must not read Version B's output or vice versa — cross-reading anchors the second
design and collapses the comparison into two variants of one idea.

---

## Operational notes

**Auto-firing hooks.** Impeccable registered hooks in `.claude/settings.local.json` that run `node .claude/skills/impeccable/scripts/hook.mjs` after every Edit/Write/MultiEdit (5s) and on Stop (30s). That path (`hook.mjs` → `hook-lib.mjs`, 2,231 lines) was reviewed: **no network calls, no subprocesses** — local static analysis only. Disable by removing the hooks block from that file.

**Network egress** exists elsewhere in impeccable but only on explicit invocation: `concept-seed.mjs` → `impeccable.style/api/roll`, `context.mjs` → `impeccable.style/api/version` (daily update check), `generate-image.mjs` → `api.openai.com` (needs `OPENAI_API_KEY`; note this repo is otherwise Anthropic-keyed).

**Triplicate install.** Both packs installed into `.claude/`, `.agents/`, and `.github/` because all three harnesses were auto-detected — roughly 10MB across three copies of the same files. If only Claude Code is used here, `.agents/` and `.github/skills|agents|hooks/` are dead weight and can be removed.
