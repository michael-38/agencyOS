import FirecrawlApp from '@mendable/firecrawl-js';
import { ScrapeResult, ScrapedPage } from './types.js';
import { extractPhones, extractEmails } from './utils/phone.js';
import { log } from './utils/logger.js';

export async function scrapeWebsite(url: string, verbose: boolean = false): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set. Add it to your .env file.');
  }

  const app = new FirecrawlApp({ apiKey });

  log.info(`Crawling ${url}...`);

  let crawlResult: any;
  try {
    crawlResult = await app.crawlUrl(url, {
      limit: 10,
      scrapeOptions: {
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      },
    });
  } catch (err: any) {
    // Retry with smaller limit on timeout
    if (err.message?.includes('timeout') || err.statusCode === 408) {
      log.warn('Crawl timed out, retrying with fewer pages...');
      crawlResult = await app.crawlUrl(url, {
        limit: 3,
        scrapeOptions: {
          formats: ['markdown', 'html'],
          onlyMainContent: true,
        },
      });
    } else {
      throw new Error(`Failed to crawl ${url}: ${err.message}`);
    }
  }

  if (!crawlResult || !crawlResult.data || crawlResult.data.length === 0) {
    throw new Error(
      `Could not access ${url}. The site may be down, blocking crawlers, or have no content.`
    );
  }

  const pages: ScrapedPage[] = crawlResult.data.map((page: any) => ({
    url: page.metadata?.sourceURL || page.metadata?.url || url,
    markdown: page.markdown || '',
    html: page.html || '',
    title: page.metadata?.title || '',
    description: page.metadata?.description || '',
  }));

  const combinedMarkdown = pages.map((p) => `# ${p.title}\n\n${p.markdown}`).join('\n\n---\n\n');
  const combinedHtml = pages.map((p) => p.html).join('\n');

  // Extract phones and emails from HTML (more reliable than markdown for tel: links)
  const allText = combinedMarkdown + '\n' + combinedHtml;
  const extractedPhones = extractPhones(allText);
  const extractedEmails = extractEmails(allText);

  if (verbose) {
    log.info(`Crawled ${pages.length} pages`);
    log.info(`Found ${extractedPhones.length} phone number(s), ${extractedEmails.length} email(s)`);
  }

  log.success(`Scraped ${pages.length} pages from ${url}`);

  return {
    url,
    pages,
    combinedMarkdown,
    combinedHtml,
    extractedPhones,
    extractedEmails,
  };
}
