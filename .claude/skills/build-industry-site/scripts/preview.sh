#!/usr/bin/env bash
# Usage: scripts/preview.sh </abs/path/to/run>/site
# Opens <site dir>/index.html in the default browser over file:// via website-audit's site:preview.
# Pass absolute paths: this script cd's into website-audit/ before running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT/website-audit"
exec npx tsx src/index.ts site:preview "$@"
