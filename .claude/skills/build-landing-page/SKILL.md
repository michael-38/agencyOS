---
name: build-landing-page
description: Create a new client landing page from an industry template (med-spa, HVAC, roofing, plumbing). Copies the template, swaps in the client's real copy and design per the design system, optionally wires the AI concierge, and serves it locally. Use when asked to "build a landing page", "spin up a site for <client>", or "make a <industry> page".
argument-hint: [industry] [client-name]
---

Build a **$0** landing page for **$1**.

## Steps
1. Read `templates/design-system.md` first — the source of truth for typography, color, spacing, and CTAs.
2. Start from `templates/$0/` (one of: `med-spa`, `hvac`, `roofing`, `plumbing`). Each has `index.html`, `<industry>-copy.md`, `<industry>-design.md`.
3. Copy the template to the client's directory and replace copy/design with the client's real content — name, services, offers, proof, contact. Match the design system; don't drift.
4. Preview locally: `node serve.js [port]` from the page directory (default port 8765; serves static files, plus concierge chat if configured). `serve.js` ships only with `templates/med-spa/` — for hvac/roofing/plumbing, copy `templates/med-spa/serve.js` (and the `concierge.*` files, if using chat) into the client dir first.
5. If the client wants an AI chat assistant, run `/configure-concierge`.
6. Deploy to Cloudflare Pages (see `.claude/agentos/connections.md`) once approved.

## Rules
- No invented claims, credentials, or reviews — use the client's real facts.
- Imagery critique: flag generic visuals as "generic stock photo / AI-generated"; never assert provenance as fact.
- `demo/utah-aesthetic-surgery/` is a strong reference build.
