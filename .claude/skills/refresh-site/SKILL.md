---
name: refresh-site
description: Rebuild an outdated local-service business website. Scrapes the existing site, extracts the business data, rewrites the copy with Claude, and generates a modern landing page you can preview and deploy. Wraps the SiteRefresh CLI. Use when asked to "refresh this site", "rebuild their website", "modernize this page", or to produce a before/after for a prospect.
argument-hint: [url]
---

Refresh target: **$ARGUMENTS**

## Steps
1. `cd cli`, then `npm install`. `.env` needs `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY`.
2. Run the pipeline (scrape → analyze → populate → output):
   - Single: `npx tsx src/index.ts $0`
   - Batch: `npx tsx src/index.ts --batch <file.csv>` — CSV columns: `url` (required), optional `type`/`industry`, `phone`. See `cli/src/index.ts` for the full flag list.
3. Industry populators live in `cli/src/populators/` (hvac, plumbing, roofing, shared); rewrite prompts in `cli/src/prompts/`. Pick or extend the populator matching the business type.
4. Preview the generated page and compare it against the original as a before/after.
5. Deploy via the path in `.claude/agentos/connections.md` (Cloudflare Pages) once approved.

## Rules
- Keep the client's real facts (services, hours, phone, license #) — improve the copy, don't invent claims.
- Follow `templates/design-system.md` for anything visual.
- Confirm before deploying to a live domain.
