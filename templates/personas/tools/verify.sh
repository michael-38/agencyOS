#!/usr/bin/env bash
# Prove every persona home page: deterministic persona checks, judgment-item tagging, and the
# answer-engine sidecar files. Exit 0 = all pages pass everything except the declared exception
# in README.md. Lighthouse is a separate, slower run: tools/lighthouse.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
AUDIT="$REPO/website-audit"

# live-chat needs a third-party chat vendor script in the HTML. These pages load no third-party
# JavaScript at all, so it fails by design on the two personas that list it; see README.md.
EXPECTED_FAILS="live-chat"

fail=0
printf '%-16s %-6s %-8s %-6s %s\n' page pass partial fail note
printf -- '------------------------------------------------------------\n'

for slug in $(cd "$ROOT" && ls -d */ | tr -d / | grep -v '^tools$'); do
  out="${TMPDIR:-/tmp}/persona-selftest-$slug.json"
  (cd "$AUDIT" && npx tsx src/index.ts check-html "$ROOT/$slug/index.html" --slug "$slug" --out "$out" >/dev/null 2>&1)
  read -r p q f unexpected < <(node -e '
    const r = require(process.argv[1]);
    const expected = new Set(process.argv[2].split(","));
    const bad = r.items.filter(i => i.verdict === "fail" && !expected.has(i.id)).map(i => i.id);
    const declared = r.items.filter(i => i.verdict === "fail" && expected.has(i.id)).map(i => i.id);
    process.stdout.write([r.summary.pass, r.summary.partial, r.summary.fail,
      bad.length ? "UNEXPECTED: " + bad.join(" ") : (declared.length ? "declared: " + declared.join(" ") : "-")].join(" "));
  ' "$out" "$EXPECTED_FAILS")
  note="$unexpected"
  [ -n "${note:-}" ] || note='-'
  printf '%-16s %-6s %-8s %-6s %s\n' "$slug" "$p" "$q" "$f" "$note"
  case "$note" in UNEXPECTED*) fail=1 ;; esac
  case "$q" in 0) ;; *) echo "  partial verdicts on $slug, see $out" ; fail=1 ;; esac
done

printf -- '------------------------------------------------------------\n'
echo
echo "anti-slop lint:"
(cd "$ROOT" && node tools/taste-lint.mjs --strict) | tail -1 || fail=1
echo
echo "accessibility, both colour schemes:"
(cd "$ROOT" && node tools/axe.mjs) 2>/dev/null | tail -1 || fail=1
echo
echo "persona criterion coverage:"
(cd "$ROOT" && node tools/coverage.mjs --strict) || fail=1
echo
echo "sidecar files:"
(cd "$ROOT" && node tools/emit-seo.mjs --check) || fail=1

exit $fail
