#!/usr/bin/env node
// Anti-slop lint for the persona home pages, mechanising the taste-skill Pre-Flight Check.
// Every rule here is one the pages actually failed on the first pass, so the lint is a gate
// against regression rather than a checklist someone has to remember.
//
//   node tools/taste-lint.mjs            → report
//   node tools/taste-lint.mjs --strict   → exit non-zero on any failure
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '../..');
const require = createRequire(path.join(REPO, 'website-audit', 'package.json'));
const cheerio = require('cheerio');
const STRICT = process.argv.includes('--strict');

/** Intent families: two CTAs from the same family on one page is a failure. */
const CTA_INTENT = [
  { intent: 'quote', words: ['quote', 'estimate', 'pricing request'] },
  { intent: 'book', words: ['book', 'reserve', 'schedule a tour', 'pick a tour'] },
  { intent: 'call', words: ['call'] },
  { intent: 'inquire', words: ['inquire', 'check a date', 'check our date', 'ask '] },
  { intent: 'visit', words: ['open house', 'request a tour', 'book a visit', 'request a walkthrough'] },
];

const RULES = [
  {
    id: 'em-dash',
    describe: 'zero em-dashes or en-dashes in visible text (taste-skill 9.G)',
    run({ text }) {
      // Escapes, so this source file itself stays free of the characters it bans.
      const hits = [...text.matchAll(/[\u2014\u2013]/g)];
      return hits.length ? [`${hits.length} dash character(s)`] : [];
    },
  },
  {
    id: 'eyebrow-count',
    describe: 'at most ceil(sections / 3) uppercase micro-labels (4.7)',
    run({ $, sections }) {
      const n = $('.eyebrow, .label').length;
      const max = Math.ceil(sections / 3);
      return n > max ? [`${n} eyebrows across ${sections} sections, max ${max}`] : [];
    },
  },
  {
    id: 'middot-per-line',
    describe: 'at most one middle dot per line of visible text (9.F)',
    run({ $ }) {
      const bad = [];
      $('p, li, dd, dt, figcaption, cite, span, td, th, a').each((_, el) => {
        const t = $(el).clone().children().remove().end().text();
        const n = (t.match(/·/g) || []).length;
        if (n > 1) bad.push(`"${t.replace(/\s+/g, ' ').trim().slice(0, 56)}" has ${n}`);
      });
      return bad.slice(0, 4);
    },
  },
  {
    id: 'hero-text-stack',
    describe: 'at most 4 text elements in the hero, no trust micro-strip inside it (4.7)',
    run({ $ }) {
      const hero = $('main > section').first();
      const parts = [];
      if (hero.find('.eyebrow, .label').length) parts.push('eyebrow');
      if (hero.find('h1').length) parts.push('headline');
      if (hero.find('.lede').length) parts.push('subtext');
      if (hero.find('.cta-row, .hero-cta').length) parts.push('ctas');
      const strips = hero.find('.facts, .stats, .quickfacts, .startingat, .meta, .badges').length;
      if (strips) parts.push(`${strips} micro-strip(s)`);
      return parts.length > 4 || strips ? [`hero carries ${parts.join(', ')}`] : [];
    },
  },
  {
    id: 'split-header',
    describe: 'no "big headline left, small explainer right" section header (4.7)',
    run({ $, css }) {
      // The banned shape is headline and explainer side by side. Stacked is the prescribed fix,
      // so only flag containers the stylesheet actually lays out as a row.
      const bad = [];
      $('.group-h, .section-head-split').each((_, el) => {
        const cls = ($(el).attr('class') || '').split(/\s+/)[0];
        const rule = new RegExp(`\\.${cls}\\s*\\{[^}]*display:\\s*(flex|grid)`);
        if (rule.test(css) && $(el).find('p').length && $(el).find('h2, h3').length) {
          bad.push($(el).find('h2, h3').first().text().trim());
        }
      });
      return bad;
    },
  },
  {
    id: 'equal-card-grid',
    describe: 'no grid of N visually identical feature cards without rhythm (9.C)',
    run({ $ }) {
      const bad = [];
      for (const sel of ['.cards', '.svcs', '.diffs', '.concerns', '.tiers', '.levels', '.grief', '.safety']) {
        $(sel).each((_, el) => {
          const kids = $(el).children().toArray();
          if (kids.length < 3) return;
          const classes = new Set(kids.map((k) => ($(k).attr('class') || '').trim()));
          if (classes.size === 1) bad.push(`${sel} has ${kids.length} identical cells`);
        });
      }
      return bad.slice(0, 4);
    },
  },
  {
    id: 'cta-intent',
    describe: 'one label per CTA intent (4.5)',
    run({ $ }) {
      const byIntent = new Map();
      $('a.btn, button.btn, .callbar a').each((_, el) => {
        const label = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
        if (!label) return;
        const hit = CTA_INTENT.find((c) => c.words.some((w) => label.includes(w)));
        if (!hit) return;
        if (!byIntent.has(hit.intent)) byIntent.set(hit.intent, new Set());
        byIntent.get(hit.intent).add(label);
      });
      return [...byIntent].filter(([, s]) => s.size > 1).map(([i, s]) => `${i}: ${[...s].join(' / ')}`);
    },
  },
  {
    id: 'cta-length',
    describe: 'primary CTA labels stay short enough not to wrap (4.5)',
    run({ $ }) {
      const bad = [];
      $('a.btn-primary, button.btn-primary, .callbar a').each((_, el) => {
        const label = $(el).text().replace(/\s+/g, ' ').trim();
        if (label.split(/\s+/).length > 4) bad.push(`"${label}"`);
      });
      return [...new Set(bad)];
    },
  },
  {
    id: 'hairline-rows',
    describe: 'no long definition list with a hairline under every row (9.F)',
    run({ $, css }) {
      const bad = [];
      for (const sel of ['.specs', '.ratios', '.plainlist']) {
        const rule = new RegExp(`\\${sel} li\\s*\\{[^}]*border-bottom`);
        $(sel).each((_, el) => {
          const n = $(el).children().length;
          if (n > 5 && rule.test(css)) bad.push(`${sel} has ${n} hairline rows`);
        });
      }
      return bad;
    },
  },
  {
    id: 'scroll-cue',
    describe: 'no scroll cues or section-number eyebrows or version labels (9.F)',
    run({ text }) {
      const bad = [];
      if (/\bscroll (to|down|for)\b/i.test(text)) bad.push('scroll cue');
      if (/^\s*\d{2,3}\s*[·/]\s*\w/m.test(text)) bad.push('section-number label');
      if (/\b(v\d+\.\d+|BETA|EARLY ACCESS|INVITE-ONLY)\b/.test(text)) bad.push('version label');
      return bad;
    },
  },
  {
    id: 'icon-stroke',
    describe: 'one icon stroke weight across the page (3.C)',
    run({ $ }) {
      // Icons only: the decorative illustrations legitimately use many stroke weights.
      const widths = new Set();
      $('svg[aria-hidden="true"][stroke], svg[aria-hidden="true"] [stroke]').each((_, el) => {
        const w = $(el).attr('stroke-width') || $(el).closest('svg').attr('stroke-width');
        if (w) widths.add(w);
      });
      return widths.size > 1 ? [`${widths.size} icon stroke weights: ${[...widths].sort().join(', ')}`] : [];
    },
  },
  {
    id: 'dark-mode',
    describe: 'page supports prefers-color-scheme: dark (6.C, 8)',
    run({ css, $ }) {
      const declared = ($('meta[name="color-scheme"]').attr('content') || '').includes('dark');
      const styled = /prefers-color-scheme:\s*dark/.test(css);
      return declared && styled ? [] : [`${declared ? '' : 'meta color-scheme missing dark; '}${styled ? '' : 'no dark block in CSS'}`];
    },
  },
  {
    id: 'reduced-motion',
    describe: 'any motion is gated on prefers-reduced-motion (6.B)',
    run({ css }) {
      const animates = /animation-timeline|@keyframes/.test(css);
      const gated = /prefers-reduced-motion/.test(css);
      return animates && !gated ? ['animation present with no reduced-motion gate'] : [];
    },
  },
];

const slugs = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).sort();
let failures = 0;

for (const slug of slugs) {
  const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
  const $ = cheerio.load(html);
  const css = $('style').text();
  $('style, script').remove();
  const ctx = {
    $, html, css,
    text: $('body').text(),
    sections: $('main > section').length,
  };
  const results = RULES.map((r) => ({ rule: r, hits: r.run(ctx) }));
  const bad = results.filter((r) => r.hits.length);
  failures += bad.length;
  process.stdout.write(`${slug.padEnd(16)} ${bad.length ? `${bad.length} failing` : 'clean'}\n`);
  for (const { rule, hits } of bad) {
    process.stdout.write(`  ${rule.id.padEnd(18)} ${hits.join('; ')}\n`);
  }
}

process.stdout.write(`\n${failures} rule failure(s) across ${slugs.length} pages\n`);
if (STRICT && failures) process.exit(1);
