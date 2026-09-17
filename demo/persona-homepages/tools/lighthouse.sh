#!/usr/bin/env bash
# Run Lighthouse against every persona home page, mobile and desktop, and print a score table.
#
# Lighthouse is not a repo dependency, it is installed once into the gitignored scratch
# directory so this demo adds nothing to package.json:
#
#   mkdir -p .context/lh && cd .context/lh && npm init -y && npm install lighthouse
#
# Usage: tools/lighthouse.sh [port]   (starts and stops its own preview server)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
LH="$REPO/.context/lh/node_modules/.bin/lighthouse"
PORT="${1:-8099}"
OUT="${TMPDIR:-/tmp}/persona-lh"

if [ ! -x "$LH" ]; then
  echo "Lighthouse not found at $LH, see the install line in this script's header." >&2
  exit 1
fi

export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p "$OUT"

node "$HERE/serve.mjs" "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
until curl -fs -o /dev/null "http://127.0.0.1:$PORT/generic/"; do sleep 0.2; done

for slug in $(cd "$ROOT" && ls -d */ | tr -d / | grep -v '^tools$'); do
  for form in mobile desktop; do
    preset=""
    [ "$form" = desktop ] && preset="--preset=desktop"
    "$LH" "http://127.0.0.1:$PORT/$slug/" \
      --quiet --chrome-flags="--headless=new --no-sandbox" \
      --output=json --output-path="$OUT/$slug-$form.json" $preset >/dev/null 2>&1
  done
done

node -e '
const fs = require("fs"), path = require("path");
const out = process.argv[1];
const rows = [];
for (const f of fs.readdirSync(out).filter(f => f.endsWith(".json")).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
  const [slug, form] = f.replace(/\.json$/, "").split(/-(mobile|desktop)$/);
  const s = k => Math.round((r.categories[k]?.score ?? 0) * 100);
  rows.push({
    page: slug, form,
    perf: s("performance"), a11y: s("accessibility"),
    bp: s("best-practices"), seo: s("seo"),
    lcp: r.audits["largest-contentful-paint"].displayValue,
    cls: r.audits["cumulative-layout-shift"].displayValue,
    tbt: r.audits["total-blocking-time"].displayValue,
  });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("page",16)}${pad("form",9)}${pad("perf",6)}${pad("a11y",6)}${pad("best",6)}${pad("seo",6)}${pad("LCP",8)}${pad("CLS",6)}TBT`);
console.log("-".repeat(72));
for (const r of rows) console.log(`${pad(r.page,16)}${pad(r.form,9)}${pad(r.perf,6)}${pad(r.a11y,6)}${pad(r.bp,6)}${pad(r.seo,6)}${pad(r.lcp,8)}${pad(r.cls,6)}${r.tbt}`);
const min = Math.min(...rows.flatMap(r => [r.perf, r.a11y, r.bp, r.seo]));
console.log("-".repeat(72));
console.log(`${rows.length} runs, lowest category score: ${min}`);
process.exit(min === 100 ? 0 : 1);
' "$OUT"
