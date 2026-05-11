import FirecrawlApp from '@mendable/firecrawl-js';

export interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  markdown: string;
  html: string;
}

export interface ScrapedSite {
  url: string;            // input URL
  finalUrl: string;       // resolved URL of the homepage after redirects
  title: string;          // homepage title
  description: string;    // homepage meta description
  markdown: string;       // homepage markdown (for backward-compat with single-page consumers)
  html: string;           // homepage HTML
  pages: ScrapedPage[];   // every crawled page (homepage first, alphabetical thereafter)
}

export interface ScrapeOptions {
  maxPages?: number;
}

function normalizePage(p: any, fallbackUrl: string): ScrapedPage {
  const meta = p.metadata || {};
  return {
    url: meta.sourceURL || meta.url || fallbackUrl,
    title: meta.title || '',
    description: meta.description || '',
    markdown: p.markdown || '',
    html: p.html || '',
  };
}

function sortPagesHomepageFirst(pages: ScrapedPage[], homepageUrl: string): ScrapedPage[] {
  const home = pages.find((p) => p.url === homepageUrl || p.url.replace(/\/$/, '') === homepageUrl.replace(/\/$/, ''));
  const rest = pages.filter((p) => p !== home).sort((a, b) => a.url.localeCompare(b.url));
  return home ? [home, ...rest] : pages.sort((a, b) => a.url.localeCompare(b.url));
}

export async function scrapeSite(url: string, options: ScrapeOptions = {}): Promise<ScrapedSite> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set.');

  const app = new FirecrawlApp({ apiKey });
  const limit = options.maxPages ?? 15;

  let crawlResult: any;
  try {
    crawlResult = await app.crawlUrl(url, {
      limit,
      scrapeOptions: {
        formats: ['markdown', 'html'],
        onlyMainContent: false,
      },
    });
  } catch (err: any) {
    if (err.message?.includes('timeout') || err.statusCode === 408) {
      crawlResult = await app.crawlUrl(url, {
        limit: Math.min(5, limit),
        scrapeOptions: { formats: ['markdown', 'html'], onlyMainContent: false },
      });
    } else {
      throw new Error(`Firecrawl crawl failed for ${url}: ${err.message}`);
    }
  }

  if (!crawlResult || crawlResult.success === false || !crawlResult.data || crawlResult.data.length === 0) {
    throw new Error(`Firecrawl returned no pages for ${url}. The site may be down, blocking crawlers, or empty.`);
  }

  const rawPages: ScrapedPage[] = (crawlResult.data as any[]).map((p) => normalizePage(p, url));

  // The first page in the crawl response is usually the homepage, but Firecrawl
  // doesn't guarantee it. Use the input URL as the homepage anchor.
  const pages = sortPagesHomepageFirst(rawPages, url);
  const home = pages[0];

  return {
    url,
    finalUrl: home.url,
    title: home.title,
    description: home.description,
    markdown: home.markdown,
    html: home.html,
    pages,
  };
}
