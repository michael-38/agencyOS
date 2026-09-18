// The brand override is the one thing about a template that moves per client, so the rule that
// matters is the one that never bends: an override that fails WCAG AA is not shipped. Every test
// here is either about picking a colour or about refusing one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { contrast, decideBrand, isUsableSwatch, readTemplateColours, towardContrast, type BrandInput } from '../src/site/brand.js';
import { loadIndustries } from '../src/personas/load.js';
import { REPO_ROOT } from './helpers.js';

const TEMPLATE_ACCENT = { light: '#bf4318', dark: '#e2652f', fg: '#ffffff' };
const SURFACES = { light: '#f7f4ec', dark: '#12160f' };

const input = (over: Partial<BrandInput> = {}): BrandInput => ({
  mode: 'auto',
  extracted: null,
  templateAccent: TEMPLATE_ACCENT,
  surfaces: SURFACES,
  ...over,
});

test('contrast maths agree with the WCAG reference pairs', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
  // #767676 on white is the canonical AA boundary, and one step lighter is genuinely below it.
  assert.ok(contrast('#767676', '#ffffff') >= 4.5, 'the darkest passing grey must pass');
  assert.ok(contrast('#777777', '#ffffff') < 4.5, 'one step lighter must fail');
  // Malformed input scores zero rather than throwing, so a bad token cannot crash a build.
  assert.equal(contrast('not-a-colour', '#ffffff'), 0);
});

test('a swatch with no chroma, or near-white, or near-black, says nothing about a brand', () => {
  assert.equal(isUsableSwatch('#ffffff'), false);
  assert.equal(isUsableSwatch('#fdfdfd'), false);
  assert.equal(isUsableSwatch('#000000'), false);
  assert.equal(isUsableSwatch('#808080'), false, 'a mid grey is still a grey');
  assert.equal(isUsableSwatch('#7a7d80'), false, 'so is a slightly blue grey');
  assert.equal(isUsableSwatch('#1f6f43'), true);
  assert.equal(isUsableSwatch('#bf4318'), true);
});

test('towardContrast walks a colour until it clears the target, in either direction', () => {
  const onLight = towardContrast('#c8e6c9', '#ffffff', 4.5);
  assert.ok(contrast(onLight, '#ffffff') >= 4.5, `got ${contrast(onLight, '#ffffff')}`);
  const onDark = towardContrast('#1a3a1a', '#111111', 4.5);
  assert.ok(contrast(onDark, '#111111') >= 4.5, `got ${contrast(onDark, '#111111')}`);
});

test('--brand off changes nothing', () => {
  const d = decideBrand(input({ mode: 'off', extracted: { hex: '#1f6f43', file: 'logo.webp' } }));
  assert.equal(d.css, null);
  assert.equal(d.origin, 'template-default');
  assert.match(d.notes.join(' '), /disabled/);
});

test('with no usable logo colour the template accent stands', () => {
  const d = decideBrand(input());
  assert.equal(d.css, null);
  assert.equal(d.origin, 'template-default');
  assert.match(d.notes.join(' '), /no usable logo colour/);
});

test('a logo colour becomes the accent, proved in both colour schemes', () => {
  const d = decideBrand(input({ extracted: { hex: '#1f6f43', file: 'assets/img/logo-00.webp' } }));
  assert.equal(d.origin, 'logo');
  assert.ok(d.css, 'an override was produced');
  assert.match(d.css as string, /:root\{--brand-accent:#/);
  assert.match(d.css as string, /prefers-color-scheme: dark/);
  assert.match(d.notes.join(' '), /assets\/img\/logo-00\.webp/);
  // Every measured ratio clears what it was held to — that is the whole guarantee.
  for (const r of d.ratios) assert.ok(r.ratio >= r.required, `${r.scheme} ${r.ratio} < ${r.required}`);
  // Both schemes were actually checked, not just the one Lighthouse happens to exercise.
  assert.deepEqual([...new Set(d.ratios.map((r) => r.scheme))].sort(), ['dark', 'light']);
});

test('--brand <hex> bypasses extraction; a malformed value is refused, not guessed at', () => {
  const given = decideBrand(input({ mode: '#0057b8', extracted: { hex: '#1f6f43', file: 'logo.webp' } }));
  assert.equal(given.origin, 'flag');
  assert.ok(given.css);

  const bad = decideBrand(input({ mode: 'cornflower' }));
  assert.equal(bad.css, null);
  assert.match(bad.notes.join(' '), /not a hex colour/);
});

test('a candidate that cannot reach AA in both schemes is dropped for the template accent', () => {
  // Surfaces with no headroom: any accent walked toward contrast on one ends up failing the other.
  const d = decideBrand(input({ extracted: { hex: '#1f6f43', file: 'logo.webp' }, surfaces: { light: '#7f7f7f', dark: '#808080' } }));
  if (d.css) {
    for (const r of d.ratios) assert.ok(r.ratio >= r.required, 'if an override ships at all, it passes');
  } else {
    assert.equal(d.origin, 'template-default');
    assert.match(d.notes.join(' '), /could not be brought to WCAG AA/);
  }
});

test('button text is whichever of white or near-black clears the accent it sits on', () => {
  const dark = decideBrand(input({ mode: '#12305a' }));
  assert.equal(dark.accentFg, '#ffffff');
  const light = decideBrand(input({ mode: '#ffd400' }));
  assert.equal(light.accentFg, '#111111');
  for (const d of [dark, light]) {
    if (d.accent && d.accentFg) assert.ok(contrast(d.accentFg, d.accent) >= 4.5);
  }
});

test('the real landscaping template exposes the colours the override needs', () => {
  const industries = loadIndustries(REPO_ROOT);
  const industry = industries.industries.find((i) => i.slug === 'landscaping')!;
  const html = fs.readFileSync(path.join(REPO_ROOT, industry.template_file), 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const read = readTemplateColours(css);
  assert.ok(read, 'the template declares --brand-accent and --brand-accent-fg');
  assert.match(read.templateAccent.light, /^#[0-9a-f]{6}$/i);
  assert.notEqual(read.templateAccent.dark, read.templateAccent.light, 'light and dark accents differ');
  assert.match(read.surfaces.light, /^#[0-9a-f]{3,6}$/i);
  assert.match(read.surfaces.dark, /^#[0-9a-f]{3,6}$/i);

  // And a real override against those surfaces holds AA.
  const d = decideBrand({ mode: '#0057b8', extracted: null, templateAccent: read.templateAccent, surfaces: read.surfaces });
  assert.ok(d.css, d.notes.join('; '));
  for (const r of d.ratios) assert.ok(r.ratio >= r.required, `${r.scheme} ${r.ratio.toFixed(2)} < ${r.required}`);
});
