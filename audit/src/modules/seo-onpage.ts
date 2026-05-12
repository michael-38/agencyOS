import * as cheerio from 'cheerio';
import { Issue, ModuleResult } from '../types.js';
import { scoreFromIssues, sortIssues } from '../utils/scoring.js';
import { ScrapedSite } from '../extractors/scrape.js';

interface PerPageStats {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
}

interface OnPageEvidence {
  homepage: PerPageStats;
  pages: PerPageStats[];
  aggregate: {
    pagesAnalyzed: number;
    pagesMissingTitle: number;
    pagesMissingMetaDescription: number;
    pagesMissingH1: number;
    pagesWithMultipleH1: number;
    totalImages: number;
    totalImagesMissingAlt: number;
    pagesWithJsonLd: number;
    pagesWithLocalBusinessSchema: number;
    pagesWithFaqSchema: number;
    allJsonLdTypes: string[];
  };
  hasFavicon: boolean;
  robotsTxtOk: boolean;
  sitemapXmlOk: boolean;
  htmlLangPresent: boolean;
}

const LOCAL_BUSINESS_TYPES = ['MedicalBusiness', 'LocalBusiness', 'HealthAndBeautyBusiness', 'Dentist', 'Physician', 'BeautySalon'];

function analyzePage(url: string, html: string): PerPageStats {
  const $ = cheerio.load(html || '');
  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const h1Count = $('h1').length;
  const images = $('img');
  const imagesTotal = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (!alt || !alt.trim()) imagesMissingAlt += 1;
  });

  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text();
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (item && item['@type']) {
          const t = Array.isArray(item['@type']) ? item['@type'].join(',') : String(item['@type']);
          jsonLdTypes.push(t);
        }
      }
    } catch {
      /* noop */
    }
  });

  return {
    url,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    hasCanonical: $('link[rel="canonical"]').length > 0,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasJsonLd: jsonLdTypes.length > 0,
    jsonLdTypes,
  };
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function runSeoOnPageModule(site: ScrapedSite): Promise<ModuleResult<OnPageEvidence>> {
  const start = Date.now();
  const issues: Issue[] = [];

  const perPage = site.pages.map((p) => analyzePage(p.url, p.html));
  const homepage = perPage[0];

  // Site-wide footer/HTML-level checks pulled from homepage HTML
  const $home = cheerio.load(site.html || '');
  const hasFavicon = $home('link[rel*="icon"]').length > 0;
  const htmlLangPresent = !!$home('html').attr('lang');
  const hasTwitterCard = $home('meta[name^="twitter:"]').length > 0;

  let robotsTxtOk = false;
  let sitemapXmlOk = false;
  try {
    const u = new URL(site.finalUrl);
    [robotsTxtOk, sitemapXmlOk] = await Promise.all([
      checkUrl(`${u.origin}/robots.txt`),
      checkUrl(`${u.origin}/sitemap.xml`),
    ]);
  } catch {
    /* noop */
  }

  // Aggregate
  const allJsonLdTypes = Array.from(new Set(perPage.flatMap((p) => p.jsonLdTypes)));
  const aggregate = {
    pagesAnalyzed: perPage.length,
    pagesMissingTitle: perPage.filter((p) => !p.title).length,
    pagesMissingMetaDescription: perPage.filter((p) => !p.metaDescription).length,
    pagesMissingH1: perPage.filter((p) => p.h1Count === 0).length,
    pagesWithMultipleH1: perPage.filter((p) => p.h1Count > 1).length,
    totalImages: perPage.reduce((s, p) => s + p.imagesTotal, 0),
    totalImagesMissingAlt: perPage.reduce((s, p) => s + p.imagesMissingAlt, 0),
    pagesWithJsonLd: perPage.filter((p) => p.hasJsonLd).length,
    pagesWithLocalBusinessSchema: perPage.filter((p) =>
      p.jsonLdTypes.some((t) => LOCAL_BUSINESS_TYPES.some((w) => t.includes(w)))
    ).length,
    pagesWithFaqSchema: perPage.filter((p) =>
      p.jsonLdTypes.some((t) => t.includes('FAQPage'))
    ).length,
    allJsonLdTypes,
  };

  // ----- Homepage-specific issues
  if (!homepage.title) {
    issues.push({ severity: 'critical', title: 'Homepage missing <title> tag', description: 'Search engines and social previews show a blank title.', quickFix: 'Add a 50–60 char title including clinic name + primary city/service.' });
  } else if (homepage.titleLength < 30 || homepage.titleLength > 60) {
    issues.push({ severity: 'medium', title: `Homepage title is ${homepage.titleLength} chars (target 50–60)`, description: homepage.title, quickFix: 'Rewrite the homepage title to fit 50–60 chars.' });
  }
  if (!homepage.metaDescription) {
    issues.push({ severity: 'high', title: 'Homepage missing meta description', description: 'Google may auto-generate a snippet from random page text.', quickFix: 'Add a 120–160 char meta description on the homepage.' });
  } else if (homepage.metaDescriptionLength < 80 || homepage.metaDescriptionLength > 170) {
    issues.push({ severity: 'low', title: `Homepage meta description is ${homepage.metaDescriptionLength} chars`, description: homepage.metaDescription, quickFix: 'Tune to 120–160 chars.' });
  }
  if (homepage.h1Count === 0) {
    issues.push({ severity: 'high', title: 'Homepage has no <h1>', description: 'Heading hierarchy is broken; SEO and accessibility suffer.', quickFix: 'Add exactly one <h1> on the homepage.' });
  }

  // ----- Site-wide issues
  if (aggregate.pagesMissingTitle > 1) {
    issues.push({
      severity: 'high',
      title: `${aggregate.pagesMissingTitle} of ${aggregate.pagesAnalyzed} pages missing <title>`,
      description: 'Inner pages without titles cannot rank for their topic.',
      quickFix: 'Set a unique 50–60 char <title> on every page.',
    });
  }
  if (aggregate.pagesMissingMetaDescription > Math.max(1, aggregate.pagesAnalyzed / 2)) {
    issues.push({
      severity: 'medium',
      title: `${aggregate.pagesMissingMetaDescription} of ${aggregate.pagesAnalyzed} pages missing meta description`,
      description: 'Inner pages get truncated/auto-generated snippets in search.',
      quickFix: 'Author a unique 120–160 char meta description per page.',
    });
  }
  if (aggregate.pagesMissingH1 > 1) {
    issues.push({
      severity: 'medium',
      title: `${aggregate.pagesMissingH1} pages have no <h1>`,
      description: 'Pages without an H1 lose topical clarity.',
      quickFix: 'Add exactly one <h1> per page describing what that page is about.',
    });
  }
  if (aggregate.pagesWithMultipleH1 > 0) {
    issues.push({
      severity: 'low',
      title: `${aggregate.pagesWithMultipleH1} pages have multiple <h1> tags`,
      description: 'Multiple H1s confuse heading hierarchy.',
      quickFix: 'Demote secondary H1s to H2.',
    });
  }
  if (aggregate.totalImages > 0 && aggregate.totalImagesMissingAlt / aggregate.totalImages > 0.2) {
    issues.push({
      severity: 'medium',
      title: `${aggregate.totalImagesMissingAlt} of ${aggregate.totalImages} images across the site are missing alt text`,
      description: 'Hurts accessibility and image SEO; affects every page.',
      quickFix: 'Add descriptive alt text to every meaningful image; an empty alt="" is fine for decorative images only.',
    });
  }

  // Canonical / OG / Twitter card on the homepage
  if (!homepage.hasCanonical) issues.push({ severity: 'low', title: 'Homepage missing canonical URL', description: 'Helps avoid duplicate-content issues.', quickFix: 'Add <link rel="canonical" href="…">.' });
  if (!homepage.hasOpenGraph) issues.push({ severity: 'medium', title: 'Homepage has no Open Graph tags', description: 'Social shares get a blank/generic preview.', quickFix: 'Add og:title, og:description, og:image, og:url.' });
  if (!hasTwitterCard) issues.push({ severity: 'low', title: 'No Twitter card tags', description: 'X/Twitter shares look bare.', quickFix: 'Add twitter:card, twitter:title, twitter:description, twitter:image.' });

  // JSON-LD (site-wide)
  if (aggregate.pagesWithJsonLd === 0) {
    issues.push({ severity: 'high', title: 'No structured data (JSON-LD) on any page', description: 'Critical for local search & LLM understanding. Missing MedicalBusiness/LocalBusiness schema.', quickFix: 'Add JSON-LD with @type "MedicalBusiness" + address, phone, hours, services on the homepage.' });
  } else {
    if (aggregate.pagesWithLocalBusinessSchema === 0) {
      issues.push({
        severity: 'medium',
        title: 'JSON-LD present but no LocalBusiness/MedicalBusiness type',
        description: `Found types: ${allJsonLdTypes.join(', ')}`,
        quickFix: 'Add MedicalBusiness or LocalBusiness JSON-LD with NAP + hours.',
      });
    }
    if (aggregate.pagesWithFaqSchema === 0) {
      issues.push({ severity: 'low', title: 'No FAQPage JSON-LD on any page', description: 'FAQ schema earns rich results and helps LLM citation.', quickFix: 'Wrap an FAQ block with FAQPage JSON-LD.' });
    }
  }

  if (!hasFavicon) issues.push({ severity: 'low', title: 'No favicon', description: 'Tabs, bookmarks, and search results show a generic icon.', quickFix: 'Add <link rel="icon" href="/favicon.ico">.' });
  if (!robotsTxtOk) issues.push({ severity: 'low', title: 'No /robots.txt', description: 'Crawlers fall back to default behavior.', quickFix: 'Add a robots.txt that allows search engines and links to your sitemap.' });
  if (!sitemapXmlOk) issues.push({ severity: 'medium', title: 'No /sitemap.xml', description: 'Slows discovery of new pages by search engines.', quickFix: 'Generate and host /sitemap.xml; reference it from robots.txt.' });
  if (!htmlLangPresent) issues.push({ severity: 'low', title: 'Homepage missing <html lang> attribute', description: 'Helps screen readers and translation tools.', quickFix: 'Add lang="en" (or appropriate) to the <html> tag.' });

  const evidence: OnPageEvidence = {
    homepage,
    pages: perPage,
    aggregate,
    hasFavicon,
    robotsTxtOk,
    sitemapXmlOk,
    htmlLangPresent,
  };

  return {
    id: 'seo-onpage',
    label: 'SEO (on-page)',
    status: 'ok',
    score: scoreFromIssues(issues),
    summary: `${issues.length} issue(s) across ${aggregate.pagesAnalyzed} pages. JSON-LD on ${aggregate.pagesWithJsonLd}/${aggregate.pagesAnalyzed} pages; sitemap ${sitemapXmlOk ? 'present' : 'missing'}.`,
    issues: sortIssues(issues),
    evidence,
    durationMs: Date.now() - start,
  };
}
