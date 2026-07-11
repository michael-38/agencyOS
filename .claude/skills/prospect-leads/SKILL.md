---
name: prospect-leads
description: Find and qualify target local-service businesses to pitch. Uses the lead-gen playbook (target verticals, lead sources, qualification signals, ROI) to build a prospect list, then queues each business for an audit. Use when asked to "find leads", "build a prospect list", "who should we pitch", or "prospect <industry> in <city>".
argument-hint: [industry] [city]
---

Prospect **$0** businesses in **$1**.

## Steps
1. Read `lead-gen-target-industries.md` — the playbook for target verticals, lead sources, qualification signals, and ROI math. Follow it; don't freelance the targeting.
2. Build a candidate list for the industry + city using the sources in the playbook.
3. Qualify each on the signals that predict a sale: outdated/slow site, no online booking or live chat, weak SEO/Google Business presence, poor mobile UX. Prioritize businesses where a rebuild clearly moves revenue.
4. Write the list to a CSV with a `url` column (plus `name`, `city`, `keywords`) so it feeds the audit batch directly.
5. Hand off: run `/audit-prospect` on the CSV (`--batch <file>.csv --index`) to produce evidence, then shape outreach from the findings.
6. Record genuinely useful, non-obvious facts about qualified leads in the project memory (see `.claude/agentos/memory.md`).

## Rules
- Qualify honestly — a weak fit wastes an audit and an outreach slot.
- Respect anti-spam norms. Outreach is an outward-facing action — confirm the batch before anything is sent.
