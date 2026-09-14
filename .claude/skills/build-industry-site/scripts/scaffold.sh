#!/usr/bin/env bash
# Usage: scripts/scaffold.sh --slug <slug> --report </abs/path/to/report.json>
# Writes <run dir>/site/index.html + copy_map.json via website-audit's site:scaffold.
# Pass absolute paths: this script cd's into website-audit/ before running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT/website-audit"
exec npx tsx src/index.ts site:scaffold "$@"
