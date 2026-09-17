#!/usr/bin/env bash
# Thin wrapper: run site:build from the website-audit package regardless of the caller's cwd.
# Pass through every argument, e.g. scripts/build.sh --report /abs/path/report.json --profile production --base-url https://example.com
set -euo pipefail
cd "$(dirname "$0")/../../../../website-audit"
exec npx tsx src/index.ts site:build "$@"
