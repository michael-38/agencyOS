# Connections — how the operator reaches real systems

No secrets here. Secret **values** live in `.env` files (gitignored); this documents what exists and the variable name. Each tool's `.env.example` is the authoritative list.

## AI
| System | Used by | Env var |
|--------|---------|---------|
| Anthropic Claude API | audit, cli, concierge (`serve.js`), voice-agent | `ANTHROPIC_API_KEY` |

## Data / scraping
| System | Purpose | Env var | Required |
|--------|---------|---------|----------|
| Firecrawl | scrape pages/content (audit, cli) | `FIRECRAWL_API_KEY` | yes |
| Firecrawl MCP | crawl/map/scrape from the agent session (`/redesign-site`) | same key, sourced from `.env` by `.mcp.json` | yes |
| SerpAPI | Google SERP rank (audit `seo-ranking`) | `SERPAPI_API_KEY` | optional |
| DataForSEO | traffic/authority (audit `traffic-metrics`) | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | optional |
| Perplexity | LLM discoverability (audit) | `PERPLEXITY_API_KEY` | optional |
| OpenAI | secondary LLM check (audit) | `OPENAI_API_KEY` | optional |

Optional integrations degrade gracefully — the module is skipped if its key is absent. Authoritative names: `audit/.env.example`.

## Voice-agent stack (`demo/voice-agent`)
| System | Purpose |
|--------|---------|
| Supabase | database + auth (NextAuth adapter) |
| Vapi | AI phone calls, assistants, tool webhooks |
| Twilio | phone numbers + SMS confirmations |
| Stripe | billing |
| Google Calendar (OAuth, per client) | availability + appointment events |

Exact variable names: `demo/voice-agent/app/.env` and the app docs (`VAPI-INTEGRATION.md`, `DATABASE.md`).

## Deploy
| Surface | How |
|---------|-----|
| `hyperworkflow/` | GitHub Actions → `.github/workflows/deploy-hyperworkflow.yml`. Wrangler is pinned to v4 and runs from `hyperworkflow/`; both were bug fixes (`414a9a1`, `5bbde6d`) — don't change either casually. |
| Client landing pages | `scripts/deploy-pages.sh <dir> <project-slug> [branch]` |

`scripts/deploy-pages.sh` is idempotent: it creates the Pages project if absent
(`--production-branch=main`), then deploys. **One project per client**; each version is a
branch deployment — `main` serves `<slug>.pages.dev`, any other branch serves
`<branch>.<slug>.pages.dev`. It refuses to publish `source-content/`, `fact-sheet.md`,
`build-notes.md`, `briefs/`, `.env`, or key files, because `wrangler pages deploy` uploads
the entire tree.

Auth order: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from the environment → the same
vars in root `.env` → `npx wrangler login` (interactive OAuth, cached in `~/.wrangler`).

**Token setup — both variables are required.** Direct Upload needs the account ID because a
scoped token, unlike OAuth, cannot enumerate accounts, so wrangler cannot infer it. The
script fails fast with guidance if only one is present.

| Where | Value |
|---|---|
| dash.cloudflare.com/profile/api-tokens → Create Token → **Custom token** | Permissions: `Account` · `Cloudflare Pages` · **Edit** — the only permission needed; it covers project list, create, and deploy |
| `CLOUDFLARE_ACCOUNT_ID` | from `npx wrangler whoami`, or any dashboard URL |

Prefer the token over `wrangler login`: the OAuth flow grants ~25 scopes (Workers, D1, KV,
R2, email, `connectivity:admin`), where the token grants Pages only.

`.claude/hooks/guard-destructive.sh` asks before any deploy — including via the script, and
including `wrangler pages project delete`, which drops a live client site with no undo.

## Version control
Git + GitHub `gh` CLI. Base branch: `main`. Open PRs with `gh pr create --base main`.

## Live session connections (MCP — available to this Claude Code session)
| Connection | Capabilities |
|------------|--------------|
| Gmail | search / read / draft / label email |
| Google Calendar | list / create / update events, suggest times |
| Google Drive | search / read / create files |

MCP servers are declared in `.mcp.json` at the project root (`command` / SSE / HTTP transports; env vars support `${VAR:-default}` fallbacks). Committed:

| Server | Transport | Key tools | Secret |
|--------|-----------|-----------|--------|
| `firecrawl` | stdio — `npx -y firecrawl-mcp` | `firecrawl_map`, `firecrawl_scrape`, `firecrawl_crawl` + `firecrawl_check_crawl_status` (**async** — returns a job id, poll it), `firecrawl_search` | `FIRECRAWL_API_KEY` |

**Never inline a key into `.mcp.json` — it is a tracked file.** `${FIRECRAWL_API_KEY}` would
expand to empty here because the key lives in `.env`, not the shell, so the launch wrapper
sources `.env` inside the server's own process instead. Keyless `firecrawl_scrape` still
works but is rate-limited; `map` and `crawl` require the key. Adding or changing a server
needs a session restart, and first use prompts for one-time approval.
