# Connections — how the operator reaches real systems

No secrets here. Secret **values** live in `.env` files (gitignored); this documents what exists and the variable name. Each tool's `.env.example` is the authoritative list.

## AI
| System | Used by | Env var |
|--------|---------|---------|
| Anthropic Claude API | website-audit, cli, concierge (`serve.js`), voice-agent | `ANTHROPIC_API_KEY` |

## Data / scraping
| System | Purpose | Env var | Required |
|--------|---------|---------|----------|
| Firecrawl (v2 SDK `firecrawl`; `/map` + `/scrape` only) | website-audit, cli | `FIRECRAWL_API_KEY` | yes |

Authoritative names: `website-audit/.env.example`. (SerpAPI, DataForSEO, Perplexity, and OpenAI were used only by the retired `audit/` package; stale keys in `.env` are harmless.)

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
| System | Purpose |
|--------|---------|
| Cloudflare Pages | hosts `hyperworkflow/` and client landing pages |
| GitHub Actions | CI/CD — `.github/workflows/deploy-hyperworkflow.yml` |

## Version control
Git + GitHub `gh` CLI. Base branch: `main`. Open PRs with `gh pr create --base main`.

## Live session connections (MCP — available to this Claude Code session)
| Connection | Capabilities |
|------------|--------------|
| Gmail | search / read / draft / label email |
| Google Calendar | list / create / update events, suggest times |
| Google Drive | search / read / create files |

MCP servers are declared in `.mcp.json` at the project root (`command` / SSE / HTTP transports; env vars support `${VAR:-default}` fallbacks). None are committed in this repo yet.
