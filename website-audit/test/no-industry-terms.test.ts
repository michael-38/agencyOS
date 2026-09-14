// Guardrail: industry knowledge lives in config/ and personas/, never in src/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from './helpers.js';

const DENYLIST = ['med spa', 'medspa', 'botox', 'clinic', 'hvac', 'roofing', 'plumb', 'landscap', 'dentist', 'lawyer', 'attorney', 'salon', 'contractor', 'chiropract', 'realtor'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('website-audit/src mentions no vertical by name', () => {
  const hits: string[] = [];
  for (const file of walk(path.join(PKG_ROOT, 'src'))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const lower = line.toLowerCase();
      for (const term of DENYLIST) if (lower.includes(term)) hits.push(`${path.relative(PKG_ROOT, file)}:${i + 1} "${term}": ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], `industry terms found in src:\n${hits.join('\n')}`);
});

test('the ui server and page mention no vertical by name either', () => {
  const hits: string[] = [];
  for (const file of ['ui/server.ts', 'ui/index.html']) {
    const p = path.join(PKG_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const lower = fs.readFileSync(p, 'utf8').toLowerCase();
    for (const term of DENYLIST) if (lower.includes(term)) hits.push(`${file}: "${term}"`);
  }
  assert.deepEqual(hits, []);
});
