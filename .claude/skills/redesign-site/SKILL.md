---
name: redesign-site
description: Give it one URL and it returns two live links. Crawls the site, profiles the industry, then builds TWO independent redesigns as self-contained landing pages from the same verified facts, one via /impeccable and one via /design-taste-frontend, and deploys both to shareable Cloudflare Pages URLs. Use when asked to "redesign this site", "rebuild their page and deploy it", "give me two versions of this site", or to produce a live before/after for a prospect.
argument-hint: [url] [optional-slug]
---

Target: **$0**  ·  slug: **$1** (default: derived from the URL)

**Run this end to end without asking the user anything.** The deliverable is two links. Every
decision below is already made; do not re-open them. Only stop for something genuinely unsafe:
a factual claim you cannot source, or imagery the source site gates that this page would not.

You are an **orchestrator**. The expensive work happens in scripts (output to disk) or subagents
(output isolated). Do not read page markdown, image bytes, or a whole design rulebook into this
thread — that is what made earlier runs die before producing a link.

## 1. Prepare (script)

```
node scripts/prepare-client.mjs $0 $1
```

Preflight, map, scrape, clean, NAP, imagery, seeding — one command. Read only
`clients/<slug>/.impeccable/prep-report.json` afterwards. It carries `archetype`,
`audienceRewriteRequired`, and the **`divergence`** block that keeps A and B apart.

Add `--dry-run` first only if the URL looks unusual. On `error:` output, fix what it names and
re-run; it is idempotent.

## 2. Fact sheet (subagent)

Spawn one general-purpose subagent. Packet: the client dir, `source-content/`, `nap.json`,
`prep-report.json`, and `cli/src/types.ts` for the `ExtractedBusinessData` field set.

It writes `fact-sheet.md` (the single source of truth both builds consume) and, when
`audienceRewriteRequired` is true, **rewrites the seeded `PRODUCT.md` against the real
end-customer** — the `med-spa` archetype seeds AgencyOS's own B2B record aimed at spa *owners*.
Tell it to verify by re-reading: if the Users section still says "owners and founders", it is not
fixed.

Rule it must carry: anything not in `source-content/` is marked `[CONFIRM]` and **omitted from
both pages**. No ratings, prices, hours, certifying boards or staff names that were not published.

## 3. Build A and B (two subagents, in parallel)

Spawn both in **one message** so they run concurrently. They are mutually blind by construction:
`prep-report.json.divergence` already assigns disjoint grounds, face classes and colour
strategies, so neither needs to see the other's output and neither can converge on it.

Each packet contains: the client dir, `fact-sheet.md`, `assets/`, the seeded `DESIGN.md`, its own
half of `divergence`, and `divergence.sharedNegativeFloor`.

- **A — `/impeccable`.** Mode Persuade. It must run `concept-seed.mjs --scope direction --mode
  persuade` (`new-work.md:46`: no substitute, no skip condition) and record the seed key in a
  direction contract as the first child of `<body>`. **Skip the decision page**: take the roll's
  assignment as final and state that assumption in its first reply. Load `craft-floor.md`
  immediately before writing UI, and write a surface brief with the medium-gate ingredient
  inventory.
- **B — `/design-taste-frontend`.** Read its SKILL.md properly. §0 Design Read line, §1 dials with
  the arithmetic shown, §2 family, §11 Redesign-Overhaul against the crawl, then **run all 62 §14
  boxes** with evidence per box. Its brief must override the skill's React/Tailwind default to
  vanilla single-file, and must not let it substitute a banned face.

Both: one self-contained `index.html`, inline `<style>`, no build step, no external origins,
self-hosted woff2 only, real client photographs only (no generation exists here), `tel:` CTA,
WCAG AA, `prefers-reduced-motion`.

## 4. Review A (subagent)

Spawn `impeccable-finish-reviewer` (registered in `.claude/agents/`). Packet per its Input
Contract, plus one explicit line: **no image generation exists here, so there is no approved comp
and its absence is not a finding.** Apply its material fixes in one batch, then send the
recaptures back for the Verdict Pass. Report its `disposition:` word verbatim; never soften it.

B is self-gated by its own 62-box pre-flight and does not go to this reviewer.

## 5. Ship (script)

```
node scripts/finish-client.mjs <slug>
```

Gates both files, generates the achromatic compare page, deploys `a` / `b` / `main` in one
command, prints the links. It **refuses to deploy on any gate failure** — banned faces, eyebrows,
em dashes, missing local assets, external origins, broken JSON-LD, or A and B converging on the
same font or ground.

One `guard-destructive.sh` prompt per run, by design: deploying is outward-facing. That is the
only interruption in the whole workflow.

## Report

Two links, nothing else unless something failed:

```
Version A   https://a.<slug>.pages.dev
Version B   https://b.<slug>.pages.dev
```

Plus, only if true: the reviewer's disposition if not `ship`, any `[CONFIRM]` fact the client must
supply before this goes out, and anything the crawl could not reach.

## Rules

- **No invented facts, ever.** `fact-sheet.md` or it does not ship.
- Never edit `templates/`. Seed out of it.
- Deploy only a `versions/<x>/` directory; `source-content/`, `fact-sheet.md` and `briefs/` stay
  outside every deploy root.
- Critique generic imagery as "generic stock photo / AI-generated"; never assert provenance.
- The concierge `/api/chat` in `serve.js` is Node-only and 404s on Pages. Local preview only.

## Chains

`/prospect-leads` → `/audit-prospect` → **`/redesign-site`** → `/configure-concierge`.
Use `/refresh-site` instead for a plain roofing/hvac/plumbing site where the scripted CLI will do.
