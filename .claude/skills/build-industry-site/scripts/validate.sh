#!/usr/bin/env bash
# Usage: scripts/validate.sh </abs/path/to/run>/site
# Runs website-audit's site:validate (structure, offline-only, JSON-LD, copy_map, gap coverage, self-test).
# Pass absolute paths: this script cd's into website-audit/ before running. Exit 0 = OK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT/website-audit"
exec npx tsx src/index.ts site:validate "$@"
