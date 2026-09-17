import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadHtml } from '../src/checks/html.js';
import { readLinkedCss, runSelfTest } from '../src/site/check-html.js';
import { REPO_ROOT, tmpDir } from './helpers.js';

const CSS = '.actionbar{position:fixed;left:0;right:0;bottom:0}';

function site(dir: string, pageRel: string, cssHref: string): string {
  const file = path.join(dir, pageRel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'site.css'), CSS);
  fs.writeFileSync(
    file,
    `<!doctype html><html lang="en"><head><title>T</title><meta name="description" content="d"><link rel="stylesheet" href="${cssHref}"></head>
     <body><header><a href="tel:15550100">Call</a></header>
     <main><section id="hero"><h1>H</h1><img src="a.webp" alt="A" width="10" height="10"></section></main>
     <footer></footer><div class="actionbar"><a href="tel:15550100">Call</a></div></body></html>`,
  );
  return file;
}

test('a relative stylesheet is read, so layout rules are not blind to external CSS', () => {
  const dir = tmpDir('selftest-rel-');
  const file = site(dir, 'index.html', 'assets/site.css');
  assert.ok(readLinkedCss(loadHtml(fs.readFileSync(file, 'utf8')), file).includes('position:fixed'));
});

test('a root-absolute stylesheet is found by walking up from a nested page', () => {
  const dir = tmpDir('selftest-abs-');
  const file = site(dir, 'services/mowing/index.html', '/assets/site.css');
  assert.ok(readLinkedCss(loadHtml(fs.readFileSync(file, 'utf8')), file).includes('position:fixed'));
});

test('remote and missing stylesheets are ignored rather than throwing', () => {
  const dir = tmpDir('selftest-missing-');
  const file = site(dir, 'index.html', 'https://cdn.example.com/x.css');
  assert.equal(readLinkedCss(loadHtml(fs.readFileSync(file, 'utf8')), file), '');
  const gone = site(dir, 'other.html', 'nope.css');
  assert.equal(readLinkedCss(loadHtml(fs.readFileSync(gone, 'utf8')), gone), '');
});

test('the sticky bar and the above-fold image are both seen when the CSS lives in a separate file', () => {
  const dir = tmpDir('selftest-rules-');
  const file = site(dir, 'index.html', 'assets/site.css');
  const res = runSelfTest({ file, slug: 'landscaping', repo: REPO_ROOT, out: null });
  const verdict = (id: string) => res.items.find((i) => i.id === id)?.verdict;
  assert.equal(verdict('sticky-mobile-cta'), 'partial', 'an external stylesheet declaring a fixed bottom bar is now visible');
  assert.equal(verdict('above-fold-images'), 'pass', 'the hero image is in the first section, not the header');
});
