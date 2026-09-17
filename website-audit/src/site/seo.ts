// The correctness half of the build: <head>, the JSON-LD @graph, sitemap.xml, robots.txt and llms.txt
// are all derived in code from the plan and the audit's facts. A model never writes them, because a
// plausible-looking but wrong canonical, breadcrumb, or FAQ mirror is the failure mode that survives
// review and quietly costs the client their search and assistant visibility.
import type { Facts } from '../checks/facts.js';
import { escapeHtml, escapeXml, oneLine } from './escape.js';
import { absoluteUrl, assetHref, depthOf, hrefBetween, markdownForPath } from './paths.js';
import type { AssetRecord, BuildProfile, PlanPage, SitePlan } from './types.js';

export interface SeoContext {
  profile: BuildProfile;
  /** Absolute origin used for canonical/OG/@id. Defaults to the audited site's own origin. */
  baseUrl: string;
  jsonldType: string;
  facts: Facts | null;
  plan: SitePlan;
  assets: AssetRecord[];
  themeColor: string;
  /** ISO date used for sitemap lastmod and the modified-time meta. */
  buildDate: string;
}

const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent'];

function postalAddress(facts: Facts | null): Record<string, unknown> | null {
  const a = facts?.address;
  if (!a) return null;
  if (typeof a === 'string') return { '@type': 'PostalAddress', streetAddress: a };
  const obj = { ...(a as Record<string, unknown>) };
  delete obj['@type'];
  return { '@type': 'PostalAddress', ...obj };
}

function openingHours(facts: Facts | null): unknown {
  const h = facts?.hours;
  if (!h) return null;
  if (Array.isArray(h)) return h;
  if (typeof h === 'object') return h;
  return null;
}

function heroAsset(assets: AssetRecord[]): AssetRecord | null {
  return assets.find((a) => a.role === 'hero') ?? assets.find((a) => a.role === 'gallery') ?? null;
}

/**
 * The structured-data graph for one page. Node @ids are stable across pages so assistants can resolve
 * the organisation once; every node that makes a claim is built from report.facts or from plan copy
 * that carries source provenance.
 */
export function buildJsonLd(page: PlanPage, ctx: SeoContext): Record<string, unknown> {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const pageUrl = absoluteUrl(base, page.path);
  const graph: Record<string, unknown>[] = [];

  graph.push({
    '@type': 'WebSite',
    '@id': siteId,
    url: `${base}/`,
    name: ctx.plan.business_name,
    description: ctx.plan.site_summary,
    publisher: { '@id': orgId },
    inLanguage: 'en',
  });

  const org: Record<string, unknown> = {
    '@type': ctx.jsonldType,
    '@id': orgId,
    name: ctx.plan.business_name,
    url: `${base}/`,
    description: ctx.plan.site_summary,
  };
  const phone = ctx.facts?.phones?.[0];
  if (phone) org.telephone = phone;
  const addr = postalAddress(ctx.facts);
  if (addr) org.address = addr;
  const hours = openingHours(ctx.facts);
  if (hours) org.openingHoursSpecification = hours;
  const areas = ctx.plan.entities.areas.filter((a) => a.source.kind === 'source');
  if (areas.length) org.areaServed = areas.map((a) => ({ '@type': 'Place', name: a.name }));
  const services = ctx.plan.entities.services.filter((s) => s.source.kind === 'source');
  if (services.length) {
    org.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `Services offered by ${ctx.plan.business_name}`,
      itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.detail } })),
    };
  }
  // AggregateRating is emitted only when the source site states both the value and the count.
  const rating = ctx.plan.entities.rating;
  if (rating && rating.source.kind === 'source' && rating.value && rating.count) {
    org.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating.value, reviewCount: rating.count };
  }
  const hero = heroAsset(ctx.assets);
  if (hero && ctx.profile === 'production') org.image = `${base}/${hero.file}`;
  graph.push(org);

  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.title,
    description: page.meta_description,
    isPartOf: { '@id': siteId },
    about: { '@id': orgId },
    inLanguage: 'en',
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '[data-answer-first]'] },
  };
  if (page.breadcrumb.length) {
    webPage.breadcrumb = { '@id': `${pageUrl}#breadcrumb` };
    const crumbs: { name: string; item: string | null }[] = [{ name: 'Home', item: `${base}/` }];
    const list = crumbTargets(page, ctx);
    list.forEach((c, i) => {
      const last = i === list.length - 1;
      crumbs.push({ name: c.label, item: last || c.exists ? absoluteUrl(base, c.path) : null });
    });
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(c.item ? { item: c.item } : {}) })),
    });
  }
  graph.push(webPage);

  if (page.kind === 'service' && page.entity_name) {
    graph.push({
      '@type': 'Service',
      '@id': `${pageUrl}#service`,
      name: page.entity_name,
      description: page.meta_description,
      provider: { '@id': orgId },
      ...(areas.length ? { areaServed: areas.map((a) => ({ '@type': 'Place', name: a.name })) } : {}),
      mainEntityOfPage: { '@id': `${pageUrl}#webpage` },
    });
  }
  if (page.kind === 'area' && page.entity_name) {
    graph.push({ '@type': 'Place', '@id': `${pageUrl}#place`, name: page.entity_name, mainEntityOfPage: { '@id': `${pageUrl}#webpage` } });
  }
  if (page.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export interface HeadOptions {
  page: PlanPage;
  ctx: SeoContext;
  /** The image the page should preload, if any. */
  lcpImage: AssetRecord | null;
  /** Audit ids whose satisfying element is in the head, tagged on the JSON-LD block. */
  checklistIds: string[];
}

export function buildHead(o: HeadOptions): string {
  const { page, ctx } = o;
  const url = absoluteUrl(ctx.baseUrl, page.path);
  const css = assetHref(page.path, 'assets/site.css', ctx.profile);
  const lines: string[] = [];
  lines.push('<meta charset="utf-8">');
  lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  lines.push(`<title>${escapeHtml(oneLine(page.title))}</title>`);
  lines.push(`<meta name="description" content="${escapeHtml(oneLine(page.meta_description))}">`);
  lines.push(`<meta name="theme-color" content="${escapeHtml(ctx.themeColor)}">`);
  lines.push('<meta name="color-scheme" content="light">');
  if (ctx.profile === 'production') {
    lines.push(`<link rel="canonical" href="${escapeHtml(url)}">`);
    lines.push('<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">');
    lines.push('<meta property="og:type" content="website">');
    lines.push(`<meta property="og:site_name" content="${escapeHtml(ctx.plan.business_name)}">`);
    lines.push(`<meta property="og:title" content="${escapeHtml(oneLine(page.title))}">`);
    lines.push(`<meta property="og:description" content="${escapeHtml(oneLine(page.meta_description))}">`);
    lines.push(`<meta property="og:url" content="${escapeHtml(url)}">`);
    lines.push('<meta property="og:locale" content="en_US">');
    lines.push(`<meta name="twitter:card" content="${o.lcpImage ? 'summary_large_image' : 'summary'}">`);
    lines.push(`<meta name="twitter:title" content="${escapeHtml(oneLine(page.title))}">`);
    lines.push(`<meta name="twitter:description" content="${escapeHtml(oneLine(page.meta_description))}">`);
    if (o.lcpImage) {
      const img = `${ctx.baseUrl.replace(/\/+$/, '')}/${o.lcpImage.file}`;
      lines.push(`<meta property="og:image" content="${escapeHtml(img)}">`);
      lines.push(`<meta property="og:image:alt" content="${escapeHtml(oneLine(o.lcpImage.alt_from_source || page.h1))}">`);
      lines.push(`<meta name="twitter:image" content="${escapeHtml(img)}">`);
    }
    lines.push(`<link rel="alternate" type="text/markdown" href="/${markdownForPath(page.path)}">`);
  }
  if (o.lcpImage) {
    lines.push(`<link rel="preload" as="image" href="${escapeHtml(assetHref(page.path, o.lcpImage.file, ctx.profile))}" fetchpriority="high">`);
  }
  lines.push(`<link rel="stylesheet" href="${escapeHtml(css)}">`);
  const tag = o.checklistIds.length ? ` data-checklist="${escapeHtml(o.checklistIds.join(' '))}"` : '';
  lines.push(`<script type="application/ld+json"${tag}>${JSON.stringify(buildJsonLd(page, ctx), null, 2)}</script>`);
  return lines.map((l) => `  ${l}`).join('\n');
}

/**
 * The crumbs between the home page and a leaf are path segments, not pages: nothing generates a
 * `/services/` hub, so linking it would produce a 404 in production and a dead link over file://.
 * Those levels render as plain text and are omitted from the BreadcrumbList's `item` URLs.
 */
function crumbTargets(page: PlanPage, ctx: SeoContext): { label: string; path: string; exists: boolean }[] {
  const segments = page.path.split('/').filter(Boolean);
  const real = new Set(ctx.plan.pages.map((p) => p.path));
  return page.breadcrumb.map((label, i) => {
    const path = `/${segments.slice(0, i + 1).join('/')}/`;
    return { label, path, exists: real.has(path) };
  });
}

/** The visible breadcrumb trail. Built in code so it can never disagree with the BreadcrumbList. */
export function buildBreadcrumbHtml(page: PlanPage, ctx: SeoContext): string {
  if (!page.breadcrumb.length) return '';
  const items: string[] = [`<li><a href="${escapeHtml(hrefBetween(page.path, '/', ctx.profile))}">Home</a></li>`];
  const crumbs = crumbTargets(page, ctx);
  crumbs.forEach((c, i) => {
    const last = i === crumbs.length - 1;
    if (last) items.push(`<li><span aria-current="page">${escapeHtml(c.label)}</span></li>`);
    else if (c.exists) items.push(`<li><a href="${escapeHtml(hrefBetween(page.path, c.path, ctx.profile))}">${escapeHtml(c.label)}</a></li>`);
    else items.push(`<li><span>${escapeHtml(c.label)}</span></li>`);
  });
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}

/**
 * The FAQ is rendered here rather than by the markup stage for the same reason the JSON-LD is: the
 * two have to be the same FAQ, and the only way to guarantee that is to build both from one source.
 * Doing it by prompt cost two repair passes and still drifted.
 */
export function buildFaqHtml(page: PlanPage, copyIds: string[], checklistIds: string[]): string {
  if (!page.faq.length) return '';
  const tag = checklistIds.length ? ` data-checklist="${escapeHtml(checklistIds.join(' '))}"` : '';
  const items = page.faq
    .map((f, i) => {
      const id = `faq-${i + 1}`;
      const copyId = copyIds[i];
      const placeholder = f.source.kind !== 'source' ? ' data-copy="placeholder"' : '';
      return `        <div class="faq-item">
          <h3 class="faq-q" id="${id}">${escapeHtml(f.q)}</h3>
          <p class="faq-a" id="${id}-a" data-copy-id="${copyId}"${placeholder} data-answer-first>${escapeHtml(f.a)}</p>
        </div>`;
    })
    .join('\n');
  return `<section class="section faq" id="faq" aria-labelledby="faq-h">
      <div class="wrap">
        <h2 id="faq-h">Frequently asked questions</h2>
        <div class="faq-list"${tag}>
${items}
        </div>
      </div>
    </section>`;
}

/** Internal links are navigation, not copy, so the build emits them and the copy map ignores them. */
export function buildRelatedHtml(links: { href: string; label: string }[], businessName: string): string {
  if (!links.length) return '';
  return `<nav class="related" aria-label="More from this site">
      <div class="wrap">
        <h2 class="related-h">More from ${escapeHtml(businessName)}</h2>
        <ul class="related-list">
${links.map((l) => `          <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`).join('\n')}
        </ul>
      </div>
    </nav>`;
}

export function buildSitemap(ctx: SeoContext): string {
  const urls = ctx.plan.pages
    .map((p) => {
      const loc = escapeXml(absoluteUrl(ctx.baseUrl, p.path));
      const priority = p.path === '/' ? '1.0' : depthOf(p.path) === 1 ? '0.8' : '0.6';
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${ctx.buildDate}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Answer engines can only cite a page they are allowed to fetch, so the AI crawlers are named and
 * allowed explicitly rather than left to a wildcard a future robots.txt edit might narrow.
 */
export function buildRobots(ctx: SeoContext): string {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const blocks = ['User-agent: *\nAllow: /', ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`)];
  return `${blocks.join('\n\n')}\n\nSitemap: ${base}/sitemap.xml\n`;
}

/** The plain-text mirror of one page, linked from llms.txt and served as .md alongside the HTML. */
export function buildPageMarkdown(page: PlanPage, ctx: SeoContext): string {
  const out: string[] = [`# ${page.h1}`, '', `> ${oneLine(page.meta_description)}`, ''];
  for (const s of page.sections) {
    out.push(`## ${s.h2}`, '', s.answer_first_opener.text, '');
    for (const b of s.blocks) out.push(b.kind === 'bullet' ? `- ${b.text}` : b.text, '');
  }
  if (page.faq.length) {
    out.push('## Frequently asked questions', '');
    for (const f of page.faq) out.push(`### ${f.q}`, '', f.a, '');
  }
  out.push('---', '', `Source: ${absoluteUrl(ctx.baseUrl, page.path)}`, '');
  return out.join('\n');
}

export function buildLlmsTxt(ctx: SeoContext): string {
  const base = ctx.baseUrl.replace(/\/+$/, '');
  const out: string[] = [`# ${ctx.plan.business_name}`, '', `> ${oneLine(ctx.plan.site_summary)}`, ''];
  const facts: string[] = [];
  if (ctx.facts?.phones?.[0]) facts.push(`- Phone: ${ctx.facts.phones[0]}`);
  const addr = postalAddress(ctx.facts);
  if (addr) {
    const a = addr as Record<string, unknown>;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ');
    if (parts) facts.push(`- Address: ${parts}`);
  }
  const areas = ctx.plan.entities.areas.filter((a) => a.source.kind === 'source').map((a) => a.name);
  if (areas.length) facts.push(`- Areas served: ${areas.join(', ')}`);
  const services = ctx.plan.entities.services.filter((s) => s.source.kind === 'source').map((s) => s.name);
  if (services.length) facts.push(`- Services: ${services.join(', ')}`);
  if (facts.length) out.push('## Key facts', '', ...facts, '');
  out.push('## Pages', '');
  for (const p of ctx.plan.pages) out.push(`- [${p.title}](${base}/${markdownForPath(p.path)}): ${oneLine(p.meta_description)}`);
  out.push('', '## Full text', '', `- [All pages as one document](${base}/llms-full.txt)`, '');
  return out.join('\n');
}

export function buildLlmsFullTxt(ctx: SeoContext): string {
  return ctx.plan.pages.map((p) => buildPageMarkdown(p, ctx)).join('\n\n');
}

/** Cloudflare Pages headers: short cache on HTML so edits roll out, immutable on fingerprinted assets. */
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

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/site.css
  Cache-Control: public, max-age=3600

/sitemap.xml
  Cache-Control: public, max-age=3600

/robots.txt
  Cache-Control: public, max-age=3600

/llms.txt
  Cache-Control: public, max-age=3600
`;
}
