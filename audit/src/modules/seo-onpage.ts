import * as cheerio from 'cheerio';
import { Issue, ModuleResult } from '../types.js';
import { scoreFromIssues, sortIssues } from '../utils/scoring.js';
import { ScrapedSite } from '../extractors/scrape.js';

interface OnPageEvidence {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  hasFavicon: boolean;
  robotsTxtOk: boolean;
  sitemapXmlOk: boolean;
  htmlLangPresent: boolean;
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
  const $ = cheerio.load(site.html || '');

  const title = $('title').first().text().trim() || null;
  const titleLength = title?.length ?? 0;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const metaDescriptionLength = metaDescription?.length ?? 0;
  const h1Count = $('h1').length;

  const images = $('img');
  const imagesTotal = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (!alt || !alt.trim()) imagesMissingAlt += 1;
  });

  const hasCanonical = $('link[rel="canonical"]').length > 0;
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;
  const hasFavicon = $('link[rel*="icon"]').length > 0;
  const htmlLangPresent = !!$('html').attr('lang');

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
  const hasJsonLd = jsonLdTypes.length > 0;

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

  if (!title) {
    issues.push({ severity: 'critical', title: 'Missing <title> tag', description: 'Search engines and social previews show a blank title.', quickFix: 'Add a 50–60 char title that includes the clinic name and primary city/service.' });
  } else if (titleLength < 30 || titleLength > 60) {
    issues.push({ severity: 'medium', title: `Title length ${titleLength} chars (target 50–60)`, description: title, quickFix: 'Rewrite the title to fit 50–60 chars including clinic name + city.' });
  }

  if (!metaDescription) {
    issues.push({ severity: 'high', title: 'Missing meta description', description: 'Google may auto-generate a snippet from random page text.', quickFix: 'Add a 120–160 char description that previews services + city + a CTA.' });
  } else if (metaDescriptionLength < 80 || metaDescriptionLength > 170) {
    issues.push({ severity: 'low', title: `Meta description length ${metaDescriptionLength} chars (target 120–160)`, description: metaDescription, quickFix: 'Tune length to 120–160 chars.' });
  }

  if (h1Count === 0) {
    issues.push({ severity: 'high', title: 'No <h1> on the page', description: 'Heading hierarchy is broken; SEO and accessibility suffer.', quickFix: 'Add exactly one <h1> describing the clinic offering on the homepage.' });
  } else if (h1Count > 1) {
    issues.push({ severity: 'medium', title: `${h1Count} <h1> tags on one page`, description: 'Multiple H1s confuse heading hierarchy.', quickFix: 'Demote secondary H1s to H2.' });
  }

  if (imagesTotal > 0 && imagesMissingAlt / imagesTotal > 0.2) {
    issues.push({
      severity: 'medium',
      title: `${imagesMissingAlt} of ${imagesTotal} images missing alt text`,
      description: 'Hurts accessibility and image SEO.',
      quickFix: 'Add descriptive alt text to every meaningful image.',
    });
  }

  if (!hasCanonical) issues.push({ severity: 'low', title: 'Missing canonical URL', description: 'Helps avoid duplicate-content issues.', quickFix: 'Add <link rel="canonical" href="…">.' });
  if (!hasOpenGraph) issues.push({ severity: 'medium', title: 'No Open Graph tags', description: 'Social shares (Facebook, LinkedIn, iMessage) get a blank or generic preview.', quickFix: 'Add og:title, og:description, og:image, og:url.' });
  if (!hasTwitterCard) issues.push({ severity: 'low', title: 'No Twitter card tags', description: 'X/Twitter shares look bare.', quickFix: 'Add twitter:card, twitter:title, twitter:description, twitter:image.' });
  if (!hasJsonLd) {
    issues.push({ severity: 'high', title: 'No structured data (JSON-LD)', description: 'Critical for local search & LLM understanding. Missing MedicalBusiness/LocalBusiness schema.', quickFix: 'Add JSON-LD with @type "MedicalBusiness" + address, phone, hours, services.' });
  } else {
    const wantedTypes = ['MedicalBusiness', 'LocalBusiness', 'HealthAndBeautyBusiness'];
    const hasBiz = jsonLdTypes.some((t) => wantedTypes.some((w) => t.includes(w)));
    if (!hasBiz) issues.push({ severity: 'medium', title: 'JSON-LD present but no LocalBusiness/MedicalBusiness type', description: `Found types: ${jsonLdTypes.join(', ')}`, quickFix: 'Add MedicalBusiness or LocalBusiness JSON-LD with NAP + hours.' });
    if (!jsonLdTypes.some((t) => t.includes('FAQPage'))) issues.push({ severity: 'low', title: 'No FAQPage JSON-LD', description: 'FAQ schema can earn rich results and helps LLM citation.', quickFix: 'Wrap an FAQ block with FAQPage JSON-LD.' });
  }
  if (!hasFavicon) issues.push({ severity: 'low', title: 'No favicon', description: 'Tabs, bookmarks, and search results show a generic icon.', quickFix: 'Add <link rel="icon" href="/favicon.ico">.' });
  if (!robotsTxtOk) issues.push({ severity: 'low', title: 'No /robots.txt', description: 'Crawlers fall back to default behavior.', quickFix: 'Add a robots.txt that allows search engines and links to your sitemap.' });
  if (!sitemapXmlOk) issues.push({ severity: 'medium', title: 'No /sitemap.xml', description: 'Slows discovery of new pages by search engines.', quickFix: 'Generate and host /sitemap.xml; reference it from robots.txt.' });
  if (!htmlLangPresent) issues.push({ severity: 'low', title: 'Missing <html lang> attribute', description: 'Helps screen readers and translation tools.', quickFix: 'Add lang="en" (or appropriate) to the <html> tag.' });

  const evidence: OnPageEvidence = {
    title,
    titleLength,
    metaDescription,
    metaDescriptionLength,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    hasCanonical,
    hasOpenGraph,
    hasTwitterCard,
    hasJsonLd,
    jsonLdTypes,
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
    summary: `${issues.length} on-page SEO issue(s). ${hasJsonLd ? 'Has' : 'No'} JSON-LD; sitemap ${sitemapXmlOk ? 'present' : 'missing'}.`,
    issues: sortIssues(issues),
    evidence,
    durationMs: Date.now() - start,
  };
}
