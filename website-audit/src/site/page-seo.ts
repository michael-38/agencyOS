// The correctness half of a templated build: the <head>, the JSON-LD @graph, and the answer-engine
// sidecars. A model writes none of it, because a plausible-looking but wrong canonical or FAQ mirror
// is the failure that survives review and quietly costs the client their visibility.
//
// One inversion from the multi-page pipeline is worth naming. There, code emitted the FAQ markup and
// the FAQ structured data from the same plan object, and checkAeo compared them. Here the template
// owns the markup — every persona words and marks up its FAQ differently — so code reads the
// questions back out of the filled page and builds FAQPage from exactly those strings. The verbatim
// comparison then passes by construction, and it is a stronger guarantee: the structured data is
// derived from what was rendered, not from a parallel structure that can drift from it.
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { Facts } from '../checks/facts.js';
import { escapeHtml, oneLine } from './escape.js';
import type { AssetRecord, BuildProfile, Entities } from './types.js';

export interface PageSeoContext {
  profile: BuildProfile;
  /** Absolute origin for canonical/OG/@id. */
  baseUrl: string;
  /** schema.org type for the industry's archetype, from config/industries.yaml. */
  jsonldType: string;
  facts: Facts | null;
  businessName: string;
  siteSummary: string;
  title: string;
  metaDescription: string;
  entities: Entities;
  assets: AssetRecord[];
  /** ISO date for sitemap lastmod. */
  buildDate: string;
}

export interface FaqEntryDom {
  q: string;
  a: string;
}

const clean = (s: string | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
// Reading the filled page
// ---------------------------------------------------------------------------------------------

/**
 * The rendered FAQ, in document order. Paired by position rather than by nesting: personas put the
 * answer inside the <details>, as a sibling of the summary, or in a following <div>, and the
 * promotion gate already guarantees the counts match.
 */
export function readFaq($: CheerioAPI): FaqEntryDom[] {
  const qs = $('[data-faq-q]').map((_, el) => clean($(el).text())).toArray();
  const as = $('[data-faq-a]').map((_, el) => clean($(el).text())).toArray();
  const out: FaqEntryDom[] = [];
  for (let i = 0; i < Math.min(qs.length, as.length); i++) {
    if (qs[i] && as[i]) out.push({ q: qs[i], a: as[i] });
  }
  return out;
}

export interface PageSection {
  h2: string;
  blocks: string[];
}

/**
 * Walk `<main>` section by section, mirroring headings, answer-first openers, definition lists and
 * tables. Ported from templates/personas/tools/emit-seo.mjs so the markdown mirror a template
 * generates by hand and the one a build generates are the same document.
 */
export function readSections($: CheerioAPI): PageSection[] {
  const out: PageSection[] = [];
  $('main > section').each((_, el) => {
    const $s = $(el as Element);
    // A band has no h2; its aria-label names it.
    const h2 = clean($s.find('h2').first().text()) || clean($s.attr('aria-label'));
    if (!h2) return;
    const blocks: string[] = [];
    const seen = new Set<string>();
    const push = (text: string) => {
      const t = clean(text);
      if (t && !seen.has(t)) {
        seen.add(t);
        blocks.push(t);
      }
    };
    push($s.find('[data-answer-first]').first().text());
    $s.find('h3').each((__, h) => {
      const title = clean($(h as Element).text());
      if (!title) return;
      const body =
        clean($(h as Element).parent().find('p').not('[data-answer-first]').first().text()) ||
        clean($(h as Element).nextAll('p').first().text());
      push(body ? `**${title}:** ${body}` : `**${title}**`);
    });
    $s.find('dl').each((__, dl) => {
      $(dl as Element)
        .find('div')
        .each((___, row) => {
          const dt = clean($(row as Element).find('dt').text());
          const dd = clean($(row as Element).find('dd').text());
          if (dt && dd) push(`- **${dt}:** ${dd}`);
        });
    });
    $s.find('table').each((__, t) => {
      const head = $(t as Element)
        .find('thead th')
        .map((___, c) => clean($(c as Element).text()))
        .toArray();
      if (head.length) push(`| ${head.join(' | ')} |`);
      $(t as Element)
        .find('tbody tr')
        .each((___, r) => {
          const cells = $(r as Element)
            .find('th, td')
            .map((____, c) => clean($(c as Element).text()))
            .toArray();
          if (cells.length) push(`| ${cells.join(' | ')} |`);
        });
    });
    out.push({ h2, blocks });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------------------------

function postalAddress(facts: Facts | null): Record<string, unknown> | null {
  const a = facts?.address;
  if (!a) return null;
  if (typeof a === 'string') return { '@type': 'PostalAddress', streetAddress: a };
  const obj = { ...(a as Record<string, unknown>) };
  delete obj['@type'];
  return { '@type': 'PostalAddress', ...obj };
}

const heroAsset = (assets: AssetRecord[]): AssetRecord | null =>
  assets.find((a) => a.role === 'hero') ?? assets.find((a) => a.role === 'gallery') ?? null;

/**
 * The graph for the one page. Every node that makes a claim is built from report.facts or from pack
 * entities that carry source provenance; AggregateRating appears only when the source states both a
 * value and a count.
 */
export function buildPageJsonLd(ctx: PageSeoContext, faq: FaqEntryDom[]): Record<string, unknown> {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const pageUrl = `${base}/`;
  const graph: Record<string, unknown>[] = [];

  graph.push({
    '@type': 'WebSite',
    '@id': siteId,
    url: `${base}/`,
    name: ctx.businessName,
    description: ctx.siteSummary,
    publisher: { '@id': orgId },
    inLanguage: 'en',
  });

  const org: Record<string, unknown> = {
    '@type': ctx.jsonldType,
    '@id': orgId,
    name: ctx.businessName,
    url: `${base}/`,
    description: ctx.siteSummary,
  };
  const phone = ctx.facts?.phones?.[0];
  if (phone) org.telephone = phone;
  const email = ctx.facts?.emails?.[0];
  if (email) org.email = email;
  const addr = postalAddress(ctx.facts);
  if (addr) org.address = addr;
  const hours = ctx.facts?.hours;
  if (hours && (Array.isArray(hours) || typeof hours === 'object')) org.openingHoursSpecification = hours;
  const areas = ctx.entities.areas.filter((a) => a.source.kind === 'source');
  if (areas.length) org.areaServed = areas.map((a) => ({ '@type': 'Place', name: a.name }));
  const services = ctx.entities.services.filter((s) => s.source.kind === 'source');
  if (services.length) {
    org.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `Services offered by ${ctx.businessName}`,
      itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.detail } })),
    };
  }
  const rating = ctx.entities.rating;
  if (rating && rating.source.kind === 'source' && rating.value && rating.count) {
    org.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating.value, reviewCount: rating.count };
  }
  const hero = heroAsset(ctx.assets);
  if (hero && ctx.profile === 'production') org.image = `${base}/${hero.file}`;
  graph.push(org);

  graph.push({
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: ctx.title,
    description: ctx.metaDescription,
    isPartOf: { '@id': siteId },
    about: { '@id': orgId },
    inLanguage: 'en',
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '[data-answer-first]'] },
  });

  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---------------------------------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------------------------------

/** Clamp to the audit's own window, on a word boundary. */
function clamp(s: string, min: number, max: number): string {
  const t = oneLine(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  const out = (at > min ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, '');
  return out;
}

export interface PatchHeadResult {
  title: string;
  metaDescription: string;
  faq: FaqEntryDom[];
}

/**
 * Rewrite the template's head for this client, in place.
 *
 * The template's own `<title>`, description, canonical and JSON-LD all describe its mock business,
 * so every one of them is replaced rather than edited — that is what stops the mock leaking, and the
 * residue gate checks it afterwards. Everything the persona chose and the client has no opinion on
 * (`theme-color`, `color-scheme`, the favicon, the stylesheet) is left exactly as authored.
 *
 * In the mockup profile the canonical and OG URLs are removed outright. A canonical pointing at an
 * origin that does not serve this page is a lie, and a preview is not published.
 */
export function patchHead($: CheerioAPI, ctx: PageSeoContext): PatchHeadResult {
  const head = $('head');
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const title = clamp(ctx.title, 10, 70);
  const description = clamp(ctx.metaDescription, 50, 170);

  if ($('title').length) $('title').text(title);
  else head.prepend(`<title>${escapeHtml(title)}</title>`);

  const setMeta = (selector: string, attrs: Record<string, string>) => {
    const el = $(selector).first();
    if (el.length) {
      for (const [k, v] of Object.entries(attrs)) el.attr(k, v);
      return;
    }
    head.append(`<meta ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(' ')}>`);
  };
  setMeta('meta[name="description"]', { name: 'description', content: description });

  // Anything naming a URL or the business is the template's, and is rebuilt or dropped.
  $('link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], link[rel="alternate"][type="text/markdown"], meta[name="robots"]').remove();

  if (ctx.profile === 'production') {
    const lcp = heroAsset(ctx.assets);
    head.append(`\n  <link rel="canonical" href="${escapeHtml(`${base}/`)}">`);
    head.append(`\n  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`);
    head.append(`\n  <meta property="og:type" content="website">`);
    head.append(`\n  <meta property="og:site_name" content="${escapeHtml(ctx.businessName)}">`);
    head.append(`\n  <meta property="og:title" content="${escapeHtml(title)}">`);
    head.append(`\n  <meta property="og:description" content="${escapeHtml(description)}">`);
    head.append(`\n  <meta property="og:url" content="${escapeHtml(`${base}/`)}">`);
    head.append(`\n  <meta property="og:locale" content="en_US">`);
    head.append(`\n  <meta name="twitter:card" content="${lcp ? 'summary_large_image' : 'summary'}">`);
    head.append(`\n  <meta name="twitter:title" content="${escapeHtml(title)}">`);
    head.append(`\n  <meta name="twitter:description" content="${escapeHtml(description)}">`);
    if (lcp) {
      const img = `${base}/${lcp.file}`;
      head.append(`\n  <meta property="og:image" content="${escapeHtml(img)}">`);
      head.append(`\n  <meta property="og:image:alt" content="${escapeHtml(oneLine(lcp.alt_from_source || title))}">`);
      head.append(`\n  <meta name="twitter:image" content="${escapeHtml(img)}">`);
    }
    head.append(`\n  <link rel="alternate" type="text/markdown" href="/index.md">`);
  }

  // The JSON-LD is replaced wholesale, keeping whatever data-checklist the template put on it: the
  // ids it claims (structured-data, jsonld-localbusiness, meta-title-description) are satisfied by
  // the block existing and being right, which is exactly what this function is responsible for.
  const faq = readFaq($);
  const script = $('script[type="application/ld+json"]').first();
  const json = JSON.stringify(buildPageJsonLd(ctx, faq), null, 2);
  if (script.length) script.text(json);
  else head.append(`\n  <script type="application/ld+json">${json}</script>`);

  return { title, metaDescription: description, faq };
}

// ---------------------------------------------------------------------------------------------
// Sidecars, derived from the filled page
// ---------------------------------------------------------------------------------------------

/** The markdown mirror, derived from the rendered page so it cannot drift from it. */
export function pageMarkdown($: CheerioAPI, ctx: PageSeoContext, faq: FaqEntryDom[]): string {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const lines: string[] = [`# ${clean($('h1').first().text())}`, '', `> ${clean($('meta[name="description"]').attr('content'))}`, ''];
  // The hero usually carries no <h2>, so its answer-first opener would otherwise be dropped, and it
  // is the one sentence an answer engine is most likely to quote.
  const intro = clean($('main > section').first().find('[data-answer-first]').first().text());
  if (intro) lines.push(intro, '');
  for (const s of readSections($)) {
    if (/frequently asked questions/i.test(s.h2)) continue;
    lines.push(`## ${s.h2}`, '');
    for (const b of s.blocks) lines.push(b, '');
  }
  if (faq.length) {
    lines.push('## Frequently asked questions', '');
    for (const f of faq) lines.push(`### ${f.q}`, '', f.a, '');
  }
  lines.push('---', '', `Source: ${base}/`, '');
  return lines.join('\n');
}

/** llms.txt: the facts and the questions, so an assistant can answer without fetching the page. */
export function pageLlmsTxt($: CheerioAPI, ctx: PageSeoContext, faq: FaqEntryDom[]): string {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const out: string[] = [`# ${ctx.businessName}`, '', `> ${clean(ctx.siteSummary)}`, '', '## Key facts', ''];
  const phone = ctx.facts?.phones?.[0];
  if (phone) out.push(`- Phone: ${phone}`);
  const email = ctx.facts?.emails?.[0];
  if (email) out.push(`- Email: ${email}`);
  const a = ctx.facts?.address;
  if (a) {
    out.push(
      `- Address: ${
        typeof a === 'string'
          ? a
          : [a['streetAddress'], a['addressLocality'], a['addressRegion'], a['postalCode']].filter(Boolean).join(', ')
      }`,
    );
  }
  const hours = ctx.facts?.hours;
  if (typeof hours === 'string') out.push(`- Hours: ${hours}`);
  else if (Array.isArray(hours)) out.push(`- Hours: ${hours.join('; ')}`);
  const areas = ctx.entities.areas.filter((x) => x.source.kind === 'source').map((x) => x.name);
  if (areas.length) out.push(`- Areas served: ${areas.join(', ')}`);
  const services = ctx.entities.services.filter((x) => x.source.kind === 'source').map((x) => x.name);
  if (services.length) out.push(`- Services: ${services.join(', ')}`);
  const rating = ctx.entities.rating;
  if (rating && rating.source.kind === 'source') out.push(`- Rating: ${rating.value} from ${rating.count} reviews`);
  out.push('', '## Pages', '', `- [${clean($('title').text())}](${base}/index.md): ${clean($('meta[name="description"]').attr('content'))}`, '');
  if (faq.length) {
    out.push('## Questions this site answers', '');
    for (const f of faq) out.push(`- ${f.q}`);
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Site-level files
// ---------------------------------------------------------------------------------------------

/**
 * The AI crawlers robots.txt names explicitly. A wildcard Allow is not enough for several of them,
 * and an assistant cannot cite a page it is not permitted to fetch. It is still the client's call,
 * so the handoff has to mention it.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
];

export function buildSitemap(baseUrl: string, buildDate: string): string {
  const loc = `${baseUrl.replace(/\/+$/, '')}/`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${buildDate}</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`
  );
}

export function buildRobots(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const blocks = ['User-agent: *\nAllow: /', ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`)];
  return `${blocks.join('\n\n')}\n\nSitemap: ${base}/sitemap.xml\n`;
}

export function buildHeadersFile(): string {
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/*.html
  Cache-Control: public, max-age=300

/assets/img/*
  Cache-Control: public, max-age=31536000, immutable

/sitemap.xml
  Cache-Control: public, max-age=3600

/robots.txt
  Cache-Control: public, max-age=3600

/llms.txt
  Cache-Control: public, max-age=3600
`;
}
