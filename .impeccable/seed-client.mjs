#!/usr/bin/env node
/**
 * Seed a client build directory with its industry design context.
 *
 *   node .impeccable/seed-client.mjs <industry> <target-dir>
 *   node .impeccable/seed-client.mjs hvac demo/acme-heating
 *
 * WHY THIS EXISTS
 * Impeccable resolves context exactly two levels deep, per file:
 *   <activeProject>/PRODUCT.md  ||  <repoRoot>/PRODUCT.md
 * There is no intermediate chain, so a client at demo/acme-heating would
 * inherit the ROOT record (AgencyOS itself) rather than its industry — which
 * would silently poison the build with the wrong audience and positioning.
 *
 * This script materializes the industry record into the client directory so
 * the client is self-sufficient. After seeding, the client only overrides
 * brand tokens and fills the [CLIENT] markers.
 *
 * Re-running is safe: existing files are skipped unless --force is passed.
 */

import fs from 'node:fs';
import path from 'node:path';

const INDUSTRIES = ['med-spa', 'hvac', 'roofing', 'plumbing'];
const CONTEXT_FILES = ['PRODUCT.md', 'DESIGN.md'];

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const [industry, targetDir] = argv.filter((a) => !a.startsWith('--'));

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

if (!industry || !targetDir) {
  console.error('usage: node .impeccable/seed-client.mjs <industry> <target-dir> [--force]');
  console.error(`       industries: ${INDUSTRIES.join(' | ')}`);
  process.exit(1);
}

if (!INDUSTRIES.includes(industry)) {
  die(`unknown industry "${industry}". Expected one of: ${INDUSTRIES.join(', ')}`);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sourceDir = path.join(repoRoot, 'templates', industry);
const destDir = path.resolve(repoRoot, targetDir);

if (!fs.existsSync(sourceDir)) die(`template directory not found: ${sourceDir}`);

// Guard: refuse to seed a template directory onto itself.
if (path.resolve(sourceDir) === destDir) die('target is the industry template itself; pick a client directory');

fs.mkdirSync(destDir, { recursive: true });

const clientName = path.basename(destDir);
const written = [];
const skipped = [];

for (const file of CONTEXT_FILES) {
  const src = path.join(sourceDir, file);
  const dest = path.join(destDir, file);

  if (!fs.existsSync(src)) die(`missing ${file} in templates/${industry}/ — the industry record is incomplete`);

  if (fs.existsSync(dest) && !force) {
    skipped.push(path.relative(repoRoot, dest));
    continue;
  }

  const banner = [
    `<!-- SEEDED from templates/${industry}/${file} for client "${clientName}".`,
    `     Industry archetype -> client record. Replace every [CLIENT] marker with this`,
    `     business's verified facts before shipping. Do not invent reviews, licenses,`,
    `     certifications, counts, or testimonials — leave a visible placeholder instead.`,
    `     Re-seed with: node .impeccable/seed-client.mjs ${industry} ${targetDir} --force -->`,
    '',
  ].join('\n');

  const body = fs.readFileSync(src, 'utf-8');

  // Insert the banner after the first heading / frontmatter block so the file
  // still parses as an impeccable record.
  let out;
  if (body.startsWith('---\n')) {
    const end = body.indexOf('\n---\n', 4);
    const split = end === -1 ? 0 : end + 5;
    out = body.slice(0, split) + '\n' + banner + body.slice(split);
  } else {
    const firstBreak = body.indexOf('\n\n');
    const split = firstBreak === -1 ? 0 : firstBreak + 2;
    out = body.slice(0, split) + banner + body.slice(split);
  }

  fs.writeFileSync(dest, out, 'utf-8');
  written.push(path.relative(repoRoot, dest));
}

for (const f of written) console.log(`  seeded  ${f}`);
for (const f of skipped) console.log(`  exists  ${f}  (use --force to overwrite)`);

if (written.length) {
  console.log('');
  console.log(`Client "${clientName}" now resolves its own context instead of inheriting the agency record.`);
  console.log('Next: fill the [CLIENT] markers, then run');
  console.log(`  cd ${targetDir} && node ${path.relative(destDir, path.join(repoRoot, '.claude/skills/impeccable/scripts/context.mjs'))}`);
}
