#!/usr/bin/env node
/**
 * scripts/finish-client.mjs — the deterministic back half of /redesign-site.
 *
 *   node scripts/finish-client.mjs <slug> [--skip-compare]
 *
 * Gates both versions, generates the compare page, deploys a / b / main in ONE
 * command, and prints the two links.
 *
 * Deliberately one command: guard-destructive.sh matches deploy-pages.sh, so a
 * single invocation means one confirmation per run instead of three. The guard
 * stays in place because deploying is outward-facing.
 *
 * The compare page chrome is achromatic on purpose. It frames two designs and
 * must not tilt the choice toward whichever version runs warmer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const slug = argv.find((a) => !a.startsWith('--'));
const die = (m) => { console.error(`error: ${m}`); process.exit(1); };
const say = (m) => console.log(m);

if (!slug) die('usage: node scripts/finish-client.mjs <slug> [--skip-compare]');
const dir = path.join(REPO, 'clients', slug);
if (!fs.existsSync(dir)) die(`no such client: clients/${slug}`);

const A = path.join(dir, 'versions/a/index.html');
const B = path.join(dir, 'versions/b/index.html');
for (const [n, f] of [['a', A], ['b', B]]) if (!fs.existsSync(f)) die(`version ${n} not built: ${path.relative(REPO, f)}`);

// ---------- gate ---------------------------------------------------------
const BANNED = /fraunces|playfair|cormorant|crimson|newsreader|syne|space grotesk|space mono|ibm plex|dm sans|dm serif|jakarta|instrument s|['"]Inter['"]|['"]Outfit['"]/i;
let failed = 0;
const check = (label, ok, detail = '') => {
  say(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
};

say(`\ngating clients/${slug}`);
const html = { a: fs.readFileSync(A, 'utf8'), b: fs.readFileSync(B, 'utf8') };
for (const v of ['a', 'b']) {
  const h = html[v];
  check(`${v}: no eyebrow/kicker`, !/class="(eyebrow|kicker)"/i.test(h));
  check(`${v}: no em dash in visible text`, !/—/.test(h));
  check(`${v}: no banned face`, !BANNED.test((h.match(/font-family:[^;}]*/g) ?? []).join(' ')));
  check(`${v}: no external css/js/font origin`, !/https?:\/\/(fonts\.(googleapis|gstatic)|cdn\.|unpkg|jsdelivr)/i.test(h));
  check(`${v}: exactly one h1`, (h.match(/<h1/g) ?? []).length === 1);
  check(`${v}: has a tel: link`, /href="tel:/.test(h));
  check(`${v}: reduced-motion honoured`, /prefers-reduced-motion/.test(h));
  // Tolerate attribute order/whitespace, and say WHICH failure it is: "missing" and
  // "malformed" need different fixes, and a message that says only "parses" hid an
  // absent block once.
  const ld = h.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
  let ldState = 'missing';
  if (ld) { try { JSON.parse(ld[1]); ldState = 'ok'; } catch { ldState = 'malformed'; } }
  check(`${v}: JSON-LD present and parses`, ldState === 'ok', ldState === 'ok' ? '' : `(${ldState})`);
  // every referenced local asset must exist — a .jpg/.jpeg slip shipped a broken image once
  // Match ANY relative path, not a hand-listed set of directories. Build agents write to
  // assets/ as often as images/, and an allow-list of two folders made this check pass
  // vacuously on pages that referenced neither.
  const refs = [...h.matchAll(/(?:src|href)="(?!https?:|data:|mailto:|tel:|sms:|#)([^"]+)"/g)].map((m) => m[1]);
  const missing = refs.filter((p) => !fs.existsSync(path.join(dir, 'versions', v, p)));
  check(`${v}: all ${refs.length} local assets resolve`, missing.length === 0, missing.join(' '));
}

// convergence: the two versions must not have landed in the same world
const fam = (h) => [...new Set([...h.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase()))];
const shared = fam(html.a).filter((f) => fam(html.b).includes(f));
check('a/b share no font family', shared.length === 0, shared.join(' '));
const ground = (h) => (h.match(/--[a-z-]*(?:bg|ground|counter|paper|drape|canvas)[a-z-]*:\s*(#[0-9a-f]{6})/i) ?? [])[1];
check('a/b have different grounds', !ground(html.a) || ground(html.a) !== ground(html.b),
  `${ground(html.a) ?? '?'} vs ${ground(html.b) ?? '?'}`);

if (failed) die(`${failed} gate failure(s); nothing deployed`);

// ---------- compare page -------------------------------------------------
if (!flags.has('--skip-compare')) {
  const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, '.impeccable/prep-report.json'), 'utf8')); } catch { return {}; } })();
  const src = report.sourceUrl ?? '';
  const cmp = path.join(dir, 'versions/compare');
  fs.mkdirSync(cmp, { recursive: true });
  fs.writeFileSync(path.join(cmp, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Two directions</title><meta name="robots" content="noindex">
<style>
:root{--ink:#171717;--line:#d6d6d6;--paper:#f2f2f2;--quiet:#5e5e5e}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,-apple-system,sans-serif}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:1rem;font-weight:600;letter-spacing:.02em}
a{color:var(--ink)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);height:calc(100vh - 61px)}
section{background:var(--paper);display:flex;flex-direction:column;min-width:0}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line)}
.bar b{font-size:.82rem;letter-spacing:.14em;text-transform:uppercase}
.bar a{font-size:.82rem}
iframe{flex:1;width:100%;border:0;background:#fff}
@media(max-width:900px){.grid{grid-template-columns:1fr;height:auto}iframe{height:78vh}}
</style></head><body>
<header>
  <h1>Two directions, same facts</h1>
  <span style="font-size:.85rem;color:var(--quiet)">${src ? `original: <a href="${src}">${src.replace(/^https?:\/\//, '')}</a>` : ''}</span>
</header>
<div class="grid">
  <section><div class="bar"><b>Version A</b><a href="https://a.${slug}.pages.dev" target="_blank" rel="noopener">open full &rarr;</a></div>
    <iframe src="https://a.${slug}.pages.dev" title="Version A" loading="lazy"></iframe></section>
  <section><div class="bar"><b>Version B</b><a href="https://b.${slug}.pages.dev" target="_blank" rel="noopener">open full &rarr;</a></div>
    <iframe src="https://b.${slug}.pages.dev" title="Version B" loading="lazy"></iframe></section>
</div></body></html>
`);
  say('  compare page generated');
}

// ---------- deploy -------------------------------------------------------
const sh = path.join(REPO, 'scripts/deploy-pages.sh');
const deploy = (rel, branch) => {
  say(`\ndeploying ${rel} -> ${branch}`);
  execFileSync('bash', [sh, path.join('clients', slug, rel), slug, branch], { cwd: REPO, stdio: 'inherit' });
};
deploy('versions/a', 'a');
deploy('versions/b', 'b');
if (!flags.has('--skip-compare')) deploy('versions/compare', 'main');

say(`\n${'='.repeat(58)}`);
say(`  Version A   https://a.${slug}.pages.dev`);
say(`  Version B   https://b.${slug}.pages.dev`);
if (!flags.has('--skip-compare')) say(`  Compare     https://${slug}.pages.dev`);
say(`${'='.repeat(58)}\n`);
