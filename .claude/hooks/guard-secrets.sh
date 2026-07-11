#!/usr/bin/env bash
# AgentOS guardrail — PreToolUse (Write|Edit).
# Denies writing a hardcoded credential into a tracked file.
# Secrets belong in .env (gitignored); reference the variable name instead.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
content=$(printf '%s' "$input" | jq -r '.tool_input.content // ""')

# Skip files where key-shaped strings are legitimate, and the guard scripts
# themselves (which contain the detection patterns below).
case "$file" in
  */.claude/hooks/*|*.env|*.env.*|.env|*.example) exit 0 ;;
esac

secret_re='sk-ant-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

if printf '%s' "$content" | grep -Eq "$secret_re"; then
  jq -n --arg f "$file" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Blocked: \($f) appears to contain a hardcoded secret. Put it in .env (gitignored) and reference the variable name — see .claude/agentos/connections.md.")
    }
  }'
fi
exit 0
