import { AvailableKeys } from '../types.js';

export function detectKeys(): AvailableKeys {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    serpapi: !!process.env.SERPAPI_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    dataforseo: !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
  };
}
