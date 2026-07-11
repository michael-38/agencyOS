#!/usr/bin/env bash
# AgentOS guardrail — PreToolUse (Bash).
# Asks for confirmation before destructive or production-outbound commands.
# A plain `git push` of a branch is NOT matched (allowed).
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

danger_re='(^|[^[:alnum:]_])rm[[:space:]]+-[a-z]*[rf]|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-[a-z]*f|git[[:space:]]+push[[:space:]].*(--force|-f([[:space:]]|$))|wrangler[[:space:]].*(deploy|publish)|drop[[:space:]]+(table|database)|truncate[[:space:]]+table|kubectl[[:space:]]+delete'

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
