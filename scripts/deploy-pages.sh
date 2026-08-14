#!/usr/bin/env bash
# scripts/deploy-pages.sh — deploy a static directory to Cloudflare Pages (free tier).
#
#   scripts/deploy-pages.sh <dir> <project-slug> [branch]
#
#   scripts/deploy-pages.sh clients/acme/versions/a acme a       -> a.acme.pages.dev
#   scripts/deploy-pages.sh clients/acme/versions/b acme b       -> b.acme.pages.dev
#   scripts/deploy-pages.sh clients/acme/versions/compare acme   -> acme.pages.dev
#
# Idempotent: creates the Pages project on first run, deploys on every run.
# One project per client; each version is a branch deployment of that project.
#
# Auth, in order:
#   1. CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID) already in the environment
#   2. the same vars in <repo-root>/.env   (gitignored)
#   3. `wrangler login`  (interactive OAuth, cached in ~/.wrangler)
#
# Wrangler is pinned to v4 — see 414a9a1 "pin wrangler v4 so Pages Functions
# actually bundle". Do not unpin.
set -euo pipefail

DIR="${1:-}"
SLUG="${2:-}"
BRANCH="${3:-main}"
PRODUCTION_BRANCH="main"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER="npx --yes wrangler@4"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
warn() { printf 'warning: %s\n' "$*" >&2; }

[ -n "$DIR" ] && [ -n "$SLUG" ] || die "usage: scripts/deploy-pages.sh <dir> <project-slug> [branch]"
[ -d "$DIR" ] || die "no such directory: $DIR"
[ -f "$DIR/index.html" ] || die "$DIR has no index.html — refusing to deploy an empty site"

# Cloudflare Pages project names: lowercase alnum + hyphens, no leading/trailing
# hyphen, <=58 chars. slugify() in cli/src/utils/phone.ts does not strip a leading
# hyphen, so validate here rather than failing halfway through a deploy.
printf '%s' "$SLUG" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,56}[a-z0-9])?$' \
  || die "invalid project slug '$SLUG' — lowercase letters, digits and hyphens only; no leading/trailing hyphen; max 58 chars"

# --- pre-flight: never publish internal artifacts -----------------------------
# `wrangler pages deploy <dir>` uploads the entire tree. These must live OUTSIDE
# the deploy root (see clients/<slug>/ layout in .claude/skills/redesign-site).
leaks="$(find "$DIR" \( \
      -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' \
   -o -name 'source-content' -o -name 'fact-sheet.md' -o -name 'build-notes.md' \
   -o -name 'briefs' -o -name 'crawl-meta.json' \
  \) -print 2>/dev/null || true)"
if [ -n "$leaks" ]; then
  printf 'error: refusing to deploy — these are internal and would become public:\n%s\n' "$leaks" >&2
  exit 1
fi

# Not secrets, but pointless or mildly leaky if published.
softs="$(find "$DIR" \( -name 'concierge-prompt.md' -o -name 'serve.js' \) -print 2>/dev/null || true)"
[ -n "$softs" ] && warn "these will be publicly readable at the deployed URL:"$'\n'"$softs"

# --- auth ---------------------------------------------------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  set -a; . "$REPO_ROOT/.env"; set +a   # .env is gitignored
fi

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN
  # Cloudflare requires BOTH for Pages Direct Upload with a token. Unlike OAuth, a
  # scoped token cannot enumerate accounts, so wrangler cannot infer the account and
  # fails with an opaque error. Catch it here with an actionable message instead.
  if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    die "CLOUDFLARE_API_TOKEN is set but CLOUDFLARE_ACCOUNT_ID is not — Pages Direct Upload
       needs both. Add it to .env; find it via 'npx wrangler whoami' (while still logged in
       via OAuth) or in any dashboard URL. Token permission needed: Account > Cloudflare Pages > Edit."
  fi
  export CLOUDFLARE_ACCOUNT_ID
  echo "auth: CLOUDFLARE_API_TOKEN (account ${CLOUDFLARE_ACCOUNT_ID})"

  # Preflight the one permission that matters. Without this the run dies much later
  # inside wrangler with a bare "Authentication error [code: 10000]", which reads like
  # a bad token even when the token is valid and merely under-permissioned.
  if command -v curl >/dev/null 2>&1; then
    pages_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
      "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" 2>/dev/null || echo 000)"
    case "$pages_code" in
      200) : ;;
      401|403)
        die "the API token is reachable but has no Cloudflare Pages access (HTTP $pages_code).
       The token itself is likely fine — it just needs the permission added:
         Account > Cloudflare Pages > Edit
       Account-owned tokens are managed at
         https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/api-tokens
       (user tokens live at dash.cloudflare.com/profile/api-tokens instead).
       To fall back to OAuth meanwhile, comment out CLOUDFLARE_API_TOKEN in .env." ;;
      000) warn "could not reach the Cloudflare API to preflight the token; continuing anyway" ;;
      *)   warn "unexpected HTTP $pages_code preflighting Pages access; continuing anyway" ;;
    esac
  fi
else
  echo "auth: no CLOUDFLARE_API_TOKEN found — falling back to wrangler OAuth"
  $WRANGLER whoami >/dev/null 2>&1 || $WRANGLER login
fi

# --- create the project if absent (idempotent) --------------------------------
# NOTE: `pages project list --json` (wrangler 4.120) emits human column names —
# {"Project Name": "...", "Project Domains": "..."} — NOT {"name": ...}. Check both
# so this keeps working if wrangler switches to machine keys.
projects_json="$($WRANGLER pages project list --json 2>/dev/null || true)"
exists=""
if [ -n "$projects_json" ] && command -v jq >/dev/null 2>&1; then
  exists="$(printf '%s' "$projects_json" \
    | jq -r --arg n "$SLUG" 'try (map(select((.["Project Name"] // .name) == $n)) | length) catch 0' 2>/dev/null || echo 0)"
  [ "$exists" = "0" ] && exists=""
else
  # jq absent or --json unsupported. Match the slug as a whole quoted value, which
  # will not match it as a prefix of "<slug>.pages.dev" in the domains column.
  printf '%s' "$projects_json" | grep -Fq "\"$SLUG\"" && exists="1"
fi

if [ -n "$exists" ]; then
  echo "project '$SLUG' already exists"
else
  echo "creating Pages project '$SLUG' (production branch: $PRODUCTION_BRANCH)"
  create_out="$($WRANGLER pages project create "$SLUG" --production-branch="$PRODUCTION_BRANCH" 2>&1 || true)"
  printf '%s\n' "$create_out"
  # 8000002 = a project with this name already exists in THIS account (benign).
  # Global-namespace collisions with another account surface as a different code.
  if printf '%s' "$create_out" | grep -Eqi 'already exists|8000002'; then
    echo "project already existed — continuing"
  elif printf '%s' "$create_out" | grep -Eqi 'unique|already taken|8000007'; then
    die "'$SLUG.pages.dev' is unavailable — *.pages.dev is a global namespace. Retry with a suffixed slug, e.g. '$SLUG-co'."
  elif printf '%s' "$create_out" | grep -Eqi '8000000'; then
    # Observed in practice: a name that failed to create can stay unusable, and every
    # retry returns HTTP 500 / code 8000000 ("unknown error") rather than a clean
    # "name taken". It is name-specific, not an outage — a different slug works
    # immediately, on the same account and the same credentials. Don't let the caller
    # burn time debugging auth for what is really a poisoned name.
    die "Cloudflare returned code 8000000 creating '$SLUG'. This is almost always a
       poisoned/taken project name rather than an auth problem — the same credentials
       will create a differently-named project fine. Retry with a different slug
       (e.g. '$SLUG-2'). Only suspect an outage if several fresh names also fail."
  fi
fi

# --- deploy -------------------------------------------------------------------
echo "deploying $DIR -> project '$SLUG', branch '$BRANCH'"
set +e
out="$($WRANGLER pages deploy "$DIR" \
        --project-name="$SLUG" \
        --branch="$BRANCH" \
        --commit-dirty=true 2>&1)"
rc=$?
set -e
printf '%s\n' "$out"
[ $rc -eq 0 ] || die "wrangler pages deploy failed (exit $rc)"

# wrangler prints the deployment URL; that is authoritative. Also compute the
# stable alias: production branch serves <slug>.pages.dev, any other branch gets
# <branch-alias>.<slug>.pages.dev with non-alphanumerics collapsed to hyphens.
reported="$(printf '%s' "$out" | grep -Eo 'https://[a-z0-9.-]+\.pages\.dev' | tail -1 || true)"

echo
if [ "$BRANCH" = "$PRODUCTION_BRANCH" ]; then
  target_host="$SLUG.pages.dev"
  echo "production:  https://$target_host"
else
  alias_branch="$(printf '%s' "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')"
  target_host="$alias_branch.$SLUG.pages.dev"
  echo "branch URL:  https://$target_host"
fi
[ -n "$reported" ] && echo "this deploy: $reported"
echo "dashboard:   https://dash.cloudflare.com/?to=/:account/pages/view/$SLUG"

# A branch alias is TWO labels deep (a.<slug>.pages.dev). The *.pages.dev wildcard
# certificate does not cover that depth, so the TLS handshake fails outright until
# Cloudflare provisions a cert for it — measured at ~20s on a fresh project. Poll,
# so a caller doesn't mistake normal provisioning lag for a broken deploy.
printf 'verifying    '
verified=""
# 30 x 5s = 150s. A first-time branch alias was measured at ~75s to provision, so an
# earlier 90s ceiling left very little headroom.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 10 "https://$target_host" 2>/dev/null; then verified=1; break; fi
  printf '.'
  sleep 5
done
if [ -n "$verified" ]; then
  echo " live (HTTP 200)"
else
  echo " NOT SERVING YET"
  warn "https://$target_host did not respond within ~90s. The upload succeeded — this is
         usually TLS provisioning on a first-time branch alias. Re-check before sending it
         to anyone; if it is still failing after a few minutes, check the dashboard."
fi
