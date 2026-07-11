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
