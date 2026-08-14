#!/usr/bin/env bash
# AgentOS guardrail — PreToolUse (Bash).
# Asks for confirmation before destructive or production-outbound commands.
# A plain `git push` of a branch is NOT matched (allowed).
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# EXPLICIT, REVIEWED EXEMPTION — scripts/finish-client.mjs.
# It is the sanctioned deploy path for /redesign-site: it gates both versions and
# refuses to deploy on any failure, and it only ever writes per-client *.pages.dev
# preview URLs, never a client's live domain. The operator opted into a zero-prompt
# workflow, so this is intentional.
# Stated here on purpose: a wrapper is invisible to this hook (it only sees the outer
# command), so this path would pass silently with or without these two lines. Better a
# reviewable exemption than an accidental hole. Calling deploy-pages.sh or wrangler
# directly still prompts.
case "$cmd" in *finish-client.mjs*) exit 0 ;; esac

# deploy-pages.sh wraps wrangler, so match it by name too — otherwise the wrapper
# hides the deploy from this hook (it only ever sees the outer command).
# `delete` covers `wrangler pages project delete`, which drops a live client site
# (and its *.pages.dev name) with no undo, plus kv/d1/r2 deletions.
# `wrangler[^[:space:]]*` not `wrangler[[:space:]]`: every call in this repo is
# version-pinned (`npx wrangler@4 pages deploy`), and `@4` means no space follows
# "wrangler" — the old pattern silently never matched those.
danger_re='(^|[^[:alnum:]_])rm[[:space:]]+-[a-z]*[rf]|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-[a-z]*f|git[[:space:]]+push[[:space:]].*(--force|-f([[:space:]]|$))|wrangler[^[:space:]]*[[:space:]].*(deploy|publish|delete)|deploy-pages\.sh|drop[[:space:]]+(table|database)|truncate[[:space:]]+table|kubectl[[:space:]]+delete'

if printf '%s' "$cmd" | grep -Eiq "$danger_re"; then
  jq -n --arg c "$cmd" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ("Guardrail: this looks destructive or a production deploy. Confirm before running:\n\($c)")
    }
  }'
fi
exit 0
