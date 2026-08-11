---
name: build-landing-page
description: Create a new client landing page from an industry template (med-spa, HVAC, roofing, plumbing). Copies the template, swaps in the client's real copy and design per the design system, optionally wires the AI concierge, and serves it locally. Use when asked to "build a landing page", "spin up a site for <client>", or "make a <industry> page".
argument-hint: [industry] [client-name]
---

Build a **$0** landing page for **$1**.

## Steps
1. Read `/DESIGN.md` first — the house floor, binding on every page. Then read `templates/$0/DESIGN.md` (the industry world) and `templates/$0/PRODUCT.md` (that vertical's customer and claim limits). The industry file overrides the root **whole-file**, so honor its `EXTENDS /DESIGN.md` directive rather than assuming inheritance.
2. Start from `templates/$0/` (one of: `med-spa`, `hvac`, `roofing`, `plumbing`). Each has `index.html`, `<industry>-copy.md`, `<industry>-design.md` (full token tables). Note `med-spa/` is a B2B pitch page aimed at owners, not a patient-facing page.
3. Seed the client's design context so it stops inheriting the *agency* record:
   `node .impeccable/seed-client.mjs $0 demo/<client-name>`
4. Copy the template to the client's directory and replace copy/design with the client's real content — name, services, offers, proof, contact. Replace every `[CLIENT]` marker in the seeded `PRODUCT.md`. Match the design system; don't drift.
5. Preview locally: `node serve.js [port]` from the page directory (default port 8765; serves static files, plus concierge chat if configured).
6. If the client wants an AI chat assistant, run `/configure-concierge`.
7. Deploy to Cloudflare Pages (see `.claude/agentos/connections.md`) once approved.

## Rules
- No invented claims, credentials, or reviews — use the client's real facts.
- Imagery critique: flag generic visuals as "generic stock photo / AI-generated"; never assert provenance as fact.
- `demo/utah-aesthetic-surgery/` is a strong reference build.
