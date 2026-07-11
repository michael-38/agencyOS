# AgentOS

AgentOS is the operating framework for the agent that runs **AgencyOS**. It organizes everything the agent needs into **5 pillars**, each mapped to the Claude Code primitive that actually loads it — so this is a working configuration, not just documentation.

## The 5 pillars

| # | Pillar | What it holds | Lives in | Claude Code primitive |
|---|--------|---------------|----------|-----------------------|
| 1 | **Identity** | Who the agent is, how it works, its preferences | `/CLAUDE.md` | Root memory file (auto-loaded every session; survives `/compact`) |
| 2 | **Context** | Domain, toolkit, tech stack, active projects | `.claude/agentos/context.md` (summary in `/CLAUDE.md`) | Project memory |
| 3 | **Skills** | Reusable workflows the agent repeats | `.claude/skills/<name>/SKILL.md` | Agent Skills — invoke with `/name` |
| 4 | **Memory** | What persists across sessions | project memory store (see `memory.md`) | Claude Code memory |
| 5 | **Connections** | How the agent reaches real systems | `.claude/agentos/connections.md` + `.env` / MCP | MCP servers, env, `gh` |

**Why Identity lives in `/CLAUDE.md`, not here:** only the root memory file is auto-loaded into every session, so the agent's identity has to live there to always be active. This folder holds the pillars that are loaded on demand.

## How to extend

- **Add a skill** → create `.claude/skills/<name>/SKILL.md`. The directory name becomes `/name`; `description` frontmatter tells Claude when to use it. Keep the body concise — it stays in context once loaded. Reference: <https://code.claude.com/docs/en/skills>.
- **Add a memory** → write one fact per file into the project memory store, then add a line to its `MEMORY.md` index (see `memory.md`).
- **Add a connection** → document it in `connections.md`; put any secret in `.env` (never commit secrets).
- **Add context** → extend `context.md`; keep only the always-true summary in `/CLAUDE.md`.

## Note on git

This framework is **committed** to the repo: `/CLAUDE.md`, `.claude/agentos/`, and `.claude/skills/` are tracked and shared with the team. Everything else under `.claude/` (local settings, caches) stays gitignored — see `.gitignore`, which ignores `.claude/*` and re-includes `!.claude/agentos/` and `!.claude/skills/`.
