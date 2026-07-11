# Memory — what the operator remembers across sessions

AgentOS memory is the **Claude Code project memory store** that Claude Code already auto-loads at the start of every session:

```
~/.claude/projects/-Users-michael-conductor-repos-agencyos/memory/
```

Its `MEMORY.md` index is injected into context each session; individual fact files are recalled when relevant. This is the real, persistent memory — AgentOS points at it rather than standing up a second, competing store.

## Convention — one fact per file
```markdown
---
name: <kebab-slug>
description: <one-line summary, used for recall>
metadata:
  type: user | feedback | project | reference
---
<the fact. For feedback/project, add **Why:** and **How to apply:** lines. Link related facts with [[slug]].>
```
After writing a fact file, add a one-line pointer to `MEMORY.md`: `- [Title](file.md) — hook`.

## What belongs in memory vs. context
- **Memory:** things *not* derivable from the repo — client-specific facts (a live domain, brand rules, a decision and its reason), user preferences, and feedback on how to work. Convert relative dates to absolute.
- **Context (`context.md`):** stable, repo-wide domain and tooling knowledge.
- Don't save what the code, git history, or `CLAUDE.md` already record.

## Current facts
The live index is `MEMORY.md` in the store above (auto-loaded each session) — read it there rather than duplicating it here. Today it holds two `feedback` facts (`feedback_design_audit_ai_images`, `feedback_always_search_web`).

As the agency takes on clients, add `project` / `reference` facts — one file each, indexed in `MEMORY.md` (e.g. a client's live domain, brand rules, or a pricing decision).

> The operator proactively offers to capture new facts as we work — see **"Refine me as you go"** in `/CLAUDE.md`. Nothing is saved to memory or config without your OK.
