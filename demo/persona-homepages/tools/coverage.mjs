#!/usr/bin/env node
// Persona-criterion coverage. For each page, read every checklist id in personas/<slug>.md and
// personas/_common.md and report whether the page carries an element tagged with it
// (data-checklist="<id>"), which is how website-audit's judge is pointed at the element that
// satisfies a judgment criterion.
//
//   node tools/coverage.mjs            → table
//   node tools/coverage.mjs --strict   → also exit non-zero on any untagged id
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '../..');
const STRICT = process.argv.includes('--strict');

/**
 * Criteria these pages deliberately do not satisfy, with the reason. Keeping them here rather than
 * quietly dropping them is the point: an untagged id that is not in this map is a gap, not a
 * decision. See README.md.
 */
const DECLARED = {
  'live-chat': 'needs a third-party chat vendor script; these pages load no third-party JavaScript',
  'MS-provider-video': 'needs a provider-to-camera video the demo has no footage for',
  'SK-video': 'needs a day-in-the-life video the demo has no footage for',
};

/** Parse the `| id | criterion | scope | check | weight |` table out of a persona file. */
function checklist(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\|\s*([A-Za-z][\w-]*)\s*\|(.+)\|\s*$/.exec(line.trim());
    if (!m || m[1] === 'id') continue;
    const cells = m[2].split('|').map((c) => c.trim());
    if (cells.length < 4) continue;
    rows.push({ id: m[1], criterion: cells[0], scope: cells[1], check: cells[2], weight: cells[3] });
  }
  return rows;
}

const common = checklist(path.join(REPO, 'personas/_common.md'));
const slugs = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).sort();

let missing = 0;
const declared = new Set();
const pad = (s, n) => String(s).padEnd(n);
process.stdout.write(`${pad('page', 16)}${pad('criteria', 10)}${pad('tagged', 8)}untagged\n`);
process.stdout.write('-'.repeat(78) + '\n');

for (const slug of slugs) {
  const items = [...checklist(path.join(REPO, `personas/${slug}.md`)), ...common];
  const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
  const tagged = new Set();
  for (const m of html.matchAll(/data-checklist="([^"]+)"/g)) {
    for (const id of m[1].split(/[\s,]+/)) if (id) tagged.add(id);
  }
  const untagged = items.filter((i) => !tagged.has(i.id)).map((i) => i.id);
  const gaps = untagged.filter((id) => !(id in DECLARED));
  missing += gaps.length;
  for (const id of untagged.filter((id) => id in DECLARED)) declared.add(id);
  const note = gaps.length ? `GAP: ${gaps.join(' ')}` : (untagged.length ? `declared: ${untagged.join(' ')}` : '-');
  process.stdout.write(`${pad(slug, 16)}${pad(items.length, 10)}${pad(items.length - untagged.length, 8)}${note}\n`);
}

process.stdout.write('-'.repeat(78) + '\n');
for (const id of [...declared].sort()) process.stdout.write(`declared not satisfied, ${id}: ${DECLARED[id]}\n`);
process.stdout.write(missing ? `${missing} undeclared criterion gap(s)\n` : 'every persona criterion is tagged, or declared above\n');
if (STRICT && missing) process.exit(1);
