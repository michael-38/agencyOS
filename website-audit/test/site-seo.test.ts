import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBreadcrumbHtml, buildHead, buildJsonLd, buildLlmsTxt, buildPageMarkdown, buildRobots, buildSitemap, type SeoContext } from '../src/site/seo.js';
import { fixturePlan, fixtureReport } from './site-helpers.js';
import type { BuildProfile } from '../src/site/types.js';

function ctx(profile: BuildProfile = 'production'): SeoContext {
  return {
    profile,
    baseUrl: 'https://example.test',
    jsonldType: 'LocalBusiness',
    facts: fixtureReport().facts,
    plan: fixturePlan(),
    assets: [],
    themeColor: '#123456',
    buildDate: '2026-09-16',
  };
}

function typesIn(graph: Record<string, unknown>): string[] {
  return ((graph['@graph'] as Record<string, unknown>[]) ?? []).flatMap((n) => {
    const t = n['@type'];
    return Array.isArray(t) ? (t as string[]) : [t as string];
  });
}

test('the home page graph carries the site, the organisation, the page, and the FAQ', () => {
  const c = ctx();
  const graph = buildJsonLd(c.plan.pages[0], c);
  const types = typesIn(graph);
  for (const want of ['WebSite', 'LocalBusiness', 'WebPage', 'FAQPage']) assert.ok(types.includes(want), `missing ${want}`);
  assert.ok(!types.includes('BreadcrumbList'), 'the home page has no breadcrumb');
});

test('a sub-page carries a BreadcrumbList whose items match its path, and never links a level that was not generated', () => {
  const c = ctx();
  const graph = buildJsonLd(c.plan.pages[1], c);
  const crumb = (graph['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'BreadcrumbList')!;
  const items = crumb.itemListElement as { position: number; name: string; item?: string }[];
  assert.deepEqual(items.map((i) => i.name), ['Home', 'Services', 'Mowing']);
  assert.deepEqual(items.map((i) => i.position), [1, 2, 3]);
  assert.equal(items[0].item, 'https://example.test/');
  assert.equal(items[1].item, undefined, 'nothing generates a /services/ hub, so it carries no URL');
  assert.equal(items[2].item, 'https://example.test/services/mowing/');
  assert.ok(typesIn(graph).includes('Service'), 'a service page describes its Service');
});

test('an intermediate level that does exist is linked', () => {
  const c = ctx();
  c.plan.pages.push({ ...c.plan.pages[1], path: '/services/', kind: 'service', breadcrumb: ['Services'], title: 'Services from Example Yard Co', h1: 'Services' });
  const crumb = (buildJsonLd(c.plan.pages[1], c)['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'BreadcrumbList')!;
  const items = crumb.itemListElement as { name: string; item?: string }[];
  assert.equal(items[1].item, 'https://example.test/services/');
});

test('FAQPage mirrors the planned questions exactly, and is absent when there is no FAQ', () => {
  const c = ctx();
  const home = (buildJsonLd(c.plan.pages[0], c)['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'FAQPage')!;
  const entities = home.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  assert.equal(entities.length, 1);
  assert.equal(entities[0].name, 'When can I reach you?');
  assert.equal(entities[0].acceptedAnswer.text, 'We answer the phone seven days a week.');
  assert.ok(!typesIn(buildJsonLd(c.plan.pages[1], c)).includes('FAQPage'));
});

test('an aggregate rating is emitted only when the source stated both the value and the count', () => {
  const c = ctx();
  const org = (buildJsonLd(c.plan.pages[0], c)['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'LocalBusiness')!;
  assert.equal((org.aggregateRating as { ratingValue: string }).ratingValue, '4.9');

  const unsourced = ctx();
  unsourced.plan = fixturePlan();
  unsourced.plan.entities.rating = { value: '5.0', count: '900', source: { kind: 'placeholder', page_url: null, quote: null } };
  const org2 = (buildJsonLd(unsourced.plan.pages[0], unsourced)['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'LocalBusiness')!;
  assert.equal(org2.aggregateRating, undefined, 'a rating with no source never reaches the structured data');
});

test('the WebPage node names a speakable selector so assistants know what to read aloud', () => {
  const c = ctx();
  const page = (buildJsonLd(c.plan.pages[0], c)['@graph'] as Record<string, unknown>[]).find((n) => n['@type'] === 'WebPage')!;
  assert.deepEqual((page.speakable as { cssSelector: string[] }).cssSelector, ['h1', '[data-answer-first]']);
});

test('the mockup head omits canonical and Open Graph; production emits them', () => {
  const mock = buildHead({ page: fixturePlan().pages[0], ctx: ctx('mockup'), lcpImage: null, checklistIds: [] });
  assert.ok(!mock.includes('rel="canonical"'));
  assert.ok(!mock.includes('og:title'));
  assert.ok(mock.includes('<title>'));
  assert.ok(mock.includes('application/ld+json'));

  const prod = buildHead({ page: fixturePlan().pages[0], ctx: ctx('production'), lcpImage: null, checklistIds: ['structured-data'] });
  assert.ok(prod.includes('<link rel="canonical" href="https://example.test/">'));
  assert.ok(prod.includes('og:title'));
  assert.ok(prod.includes('max-image-preview:large'));
  assert.ok(prod.includes('<script type="application/ld+json" data-checklist="structured-data">'), 'head-level audit ids are tagged on the structured data, not on a paragraph');
});

test('the visible breadcrumb and the structured one describe the same trail', () => {
  const html = buildBreadcrumbHtml(fixturePlan().pages[1], ctx());
  assert.ok(html.includes('>Home<'));
  assert.ok(!html.includes('href="/services/"'), 'the ungenerated level is text, not a dead link');
  assert.ok(html.includes('<li><span>Services</span></li>'));
  assert.ok(html.includes('aria-current="page">Mowing<'));
  assert.equal(buildBreadcrumbHtml(fixturePlan().pages[0], ctx()), '', 'the home page has no trail');
});

test('the sitemap lists every page once, with the right namespace', () => {
  const xml = buildSitemap(ctx());
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  assert.equal([...xml.matchAll(/<loc>/g)].length, 2);
  assert.ok(xml.includes('<loc>https://example.test/</loc>'));
  assert.ok(xml.includes('<loc>https://example.test/services/mowing/</loc>'));
  assert.ok(xml.includes('<lastmod>2026-09-16</lastmod>'));
});

test('robots.txt names the AI crawlers explicitly, because an assistant cannot cite what it cannot fetch', () => {
  const txt = buildRobots(ctx());
  for (const ua of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    assert.ok(txt.includes(`User-agent: ${ua}`), `missing ${ua}`);
  }
  assert.ok(txt.includes('Sitemap: https://example.test/sitemap.xml'));
  assert.ok(!/Disallow: \//.test(txt));
});

test('llms.txt leads with the summary, the sourced facts, and a markdown mirror per page', () => {
  const txt = buildLlmsTxt(ctx());
  assert.ok(txt.startsWith('# Example Yard Co'));
  assert.ok(txt.includes('> Example Yard Co keeps gardens tidy'));
  assert.ok(txt.includes('- Phone: 801-555-0100'));
  assert.ok(txt.includes('- Areas served: Riverton'));
  assert.ok(txt.includes('](https://example.test/index.md)'));
  assert.ok(txt.includes('](https://example.test/services/mowing/index.md)'));
});

test('the page markdown mirror keeps the answer-first shape', () => {
  const md = buildPageMarkdown(fixturePlan().pages[0], ctx());
  assert.ok(md.startsWith('# Garden care in Riverton'));
  const heading = md.indexOf('## What we do');
  assert.ok(heading > 0);
  assert.ok(md.slice(heading).startsWith('## What we do\n\nExample Yard Co has kept gardens tidy in Riverton since 2009.'), 'the opener follows its own heading with nothing in between');
  assert.ok(md.includes('### When can I reach you?'));
});
