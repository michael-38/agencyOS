#!/usr/bin/env node
// Derive each site's answer-engine sidecar files from its index.html, so the plain-text mirrors can
// never drift from the page: index.md, llms.txt, robots.txt, sitemap.xml.
//
// The conventions match website-audit's own site:build output (src/site/seo.ts): a markdown mirror
// linked with <link rel="alternate" type="text/markdown">, an llms.txt index of key facts and pages,
// and a robots.txt that names the AI crawlers explicitly rather than relying on a wildcard.
//
//   node tools/emit-seo.mjs [--check]
//
// --check writes nothing and exits non-zero if any file is out of date.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '../..');
const require = createRequire(path.join(REPO, 'website-audit', 'package.json'));
const cheerio = require('cheerio');

const CHECK = process.argv.includes('--check');

/** Same list site:build writes into robots.txt (website-audit/src/site/seo.ts). */
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Bytespider', 'meta-externalagent',
];

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function graphOf($) {
  const raw = $('script[type="application/ld+json"]').first().text();
  const data = JSON.parse(raw);
  return data['@graph'] || [data];
}
const nodeOfType = (graph, type) =>
  graph.find((n) => [].concat(n['@type'] || []).some((t) => t === type));
const nodesOfType = (graph, type) =>
  graph.filter((n) => [].concat(n['@type'] || []).some((t) => t === type));

/** The organisation node is whichever node the WebPage points `about` at. */
function orgOf(graph) {
  const page = nodeOfType(graph, 'WebPage');
  const id = page?.about?.['@id'];
  return graph.find((n) => n['@id'] === id) || graph.find((n) => n['hasOfferCatalog'] || n['telephone']);
}

/** Walk <main> section by section, mirroring headings, answer-first openers, lists and tables. */
export function sectionsOf($) {
  const out = [];
  $('main > section').each((_, el) => {
    const $s = $(el);
    // A band (the facts strip that used to sit inside the hero) has no h2; its aria-label names it.
    const h2 = clean($s.find('h2').first().text()) || clean($s.attr('aria-label'));
    if (!h2) return;
    const blocks = [];
    const seen = new Set();
    const push = (text) => {
      const t = clean(text);
      if (t && !seen.has(t)) { seen.add(t); blocks.push(t); }
    };
    push($s.find('[data-answer-first]').first().text());
    $s.find('h3').each((__, h) => {
      const title = clean($(h).text());
      if (!title) return;
      const body = clean($(h).parent().find('p').not('[data-answer-first]').first().text())
        || clean($(h).nextAll('p').first().text());
      push(body ? `**${title}:** ${body}` : `**${title}**`);
    });
    $s.find('dl').each((__, dl) => {
      $(dl).find('div').each((___, row) => {
        const dt = clean($(row).find('dt').text());
        const dd = clean($(row).find('dd').text());
        if (dt && dd) push(`- **${dt}:** ${dd}`);
      });
    });
    $s.find('table').each((__, t) => {
      const head = $(t).find('thead th').map((___, c) => clean($(c).text())).get();
      if (head.length) push(`| ${head.join(' | ')} |`);
      $(t).find('tbody tr').each((___, r) => {
        const cells = $(r).find('th, td').map((____, c) => clean($(c).text())).get();
        if (cells.length) push(`| ${cells.join(' | ')} |`);
      });
    });
    out.push({ h2, blocks });
  });
  return out;
}

export function markdownFor(page) {
  const { $, origin } = page;
  const graph = graphOf($);
  const faq = nodeOfType(graph, 'FAQPage');
  const lines = [
    `# ${clean($('h1').first().text())}`,
    '',
    `> ${clean($('meta[name="description"]').attr('content'))}`,
    '',
  ];
  // The hero usually carries no <h2>, so its answer-first opener would otherwise be dropped,
  // and it is the one sentence an answer engine is most likely to quote.
  const intro = clean($('main > section').first().find('[data-answer-first]').first().text());
  if (intro) lines.push(intro, '');
  for (const s of sectionsOf($)) {
    if (/frequently asked questions/i.test(s.h2)) continue;
    lines.push(`## ${s.h2}`, '');
    for (const b of s.blocks) lines.push(b, '');
  }
  if (faq) {
    lines.push('## Frequently asked questions', '');
    for (const q of faq.mainEntity) lines.push(`### ${q.name}`, '', q.acceptedAnswer.text, '');
  }
  lines.push('---', '', `Source: ${origin}/`, '');
  return lines.join('\n');
}

export function llmsFor(page) {
  const { $, origin } = page;
  const graph = graphOf($);
  const org = orgOf(graph);
  const title = clean($('title').text());
  const out = [`# ${org.name}`, '', `> ${clean(org.description)}`, '', '## Key facts', ''];
  if (org.telephone) out.push(`- Phone: ${org.telephone}`);
  const a = org.address;
  if (a) out.push(`- Address: ${[a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ')}`);
  const hours = (org.openingHoursSpecification || [])
    .map((h) => `${[].concat(h.dayOfWeek).map((d) => d.slice(0, 3)).join('/')} ${h.opens} to ${h.closes}`)
    .join('; ');
  if (hours) out.push(`- Hours: ${hours}`);
  const areas = (org.areaServed || []).map((p) => p.name);
  if (areas.length) out.push(`- Areas served: ${areas.join(', ')}`);
  const offers = org.hasOfferCatalog?.itemListElement || [];
  if (offers.length) out.push(`- Services: ${offers.map((o) => o.itemOffered.name).join(', ')}`);
  if (org.aggregateRating) out.push(`- Rating: ${org.aggregateRating.ratingValue} from ${org.aggregateRating.reviewCount} reviews`);
  const events = nodesOfType(graph, 'Event');
  for (const e of events) out.push(`- Event: ${e.name}, ${e.startDate}`);
  out.push('', '## Pages', '', `- [${title}](${origin}/index.md): ${clean($('meta[name="description"]').attr('content'))}`, '');
  const faq = nodeOfType(graph, 'FAQPage');
  if (faq) {
    out.push('## Questions this site answers', '');
    for (const q of faq.mainEntity) out.push(`- ${q.name}`);
    out.push('');
  }
  return out.join('\n');
}

const robotsFor = (origin) =>
  `${['User-agent: *\nAllow: /', ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`)].join('\n\n')}\n\nSitemap: ${origin}/sitemap.xml\n`;

const sitemapFor = (origin, date) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${date}</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;

// Guarded so website-audit's own tests can import sectionsOf/markdownFor/llmsFor and assert that its
// TypeScript emitter walks a page the same way this does. Importing a module that rewrites files on
// load would be a trap.
const MAIN = process.argv[1] && process.argv[1].endsWith('emit-seo.mjs');

const BUILD_DATE = new Date().toISOString().slice(0, 10);
let stale = 0;
const slugs = MAIN ? fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html'))).sort() : [];

for (const slug of slugs) {
  const dir = path.join(ROOT, slug);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const $ = cheerio.load(html);
  const origin = ($('link[rel="canonical"]').attr('href') || '').replace(/\/+$/, '');
  const page = { $, origin };
  const files = {
    'index.md': markdownFor(page),
    'llms.txt': llmsFor(page),
    'robots.txt': robotsFor(origin),
    'sitemap.xml': sitemapFor(origin, BUILD_DATE),
  };
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(dir, name);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    // sitemap lastmod changes daily; compare everything but the date.
    const same = name === 'sitemap.xml'
      ? current?.replace(/<lastmod>.*<\/lastmod>/, '') === body.replace(/<lastmod>.*<\/lastmod>/, '')
      : current === body;
    if (same) continue;
    if (CHECK) { stale++; process.stdout.write(`stale  ${slug}/${name}\n`); continue; }
    fs.writeFileSync(file, body);
    process.stdout.write(`wrote  ${slug}/${name}\n`);
  }
}

if (MAIN && CHECK) {
  process.stdout.write(stale ? `\n${stale} file(s) out of date, run: node tools/emit-seo.mjs\n` : '\nall sidecar files up to date\n');
  process.exit(stale ? 1 : 0);
}
