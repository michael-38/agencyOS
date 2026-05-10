import FirecrawlApp from '@mendable/firecrawl-js';

export interface ScrapedSite {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  markdown: string;
  html: string;
  pages: { url: string; title: string; markdown: string; html: string }[];
}

export async function scrapeSite(url: string): Promise<ScrapedSite> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set.');

  const app = new FirecrawlApp({ apiKey });

  let result: any;
  try {
    result = await app.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: false,
    });
  } catch (err: any) {
    throw new Error(`Firecrawl scrape failed for ${url}: ${err.message}`);
  }

  if (!result || result.success === false) {
    throw new Error(`Firecrawl returned no data for ${url}`);
  }

  const markdown: string = result.markdown || '';
  const html: string = result.html || '';
  const meta = result.metadata || {};
  const finalUrl: string = meta.sourceURL || meta.url || url;

  return {
    url,
    finalUrl,
    title: meta.title || '',
    description: meta.description || '',
    markdown,
    html,
    pages: [
      {
        url: finalUrl,
        title: meta.title || '',
        markdown,
        html,
      },
    ],
  };
}
