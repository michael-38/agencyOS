import Anthropic from '@anthropic-ai/sdk';
import { ClinicInfo } from '../types.js';
import { domainOf } from '../utils/url.js';
import { MODELS } from '../utils/models.js';
import { log } from '../utils/logger.js';
import { CostTracker } from '../utils/cost.js';
import { headTail } from '../utils/excerpt.js';
import { ScrapedSite } from './scrape.js';

const MODEL = MODELS.cheap_extraction;

const TOOL_SCHEMA = {
  name: 'record_clinic_info',
  description: 'Records the structured clinic information extracted from the website.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Clinic / business name as displayed on the site.' },
      city: { type: 'string', description: 'Primary city the clinic operates in. Empty string if unknown.' },
      state: { type: 'string', description: 'US state or region (e.g., "CA", "NY"). Empty string if unknown.' },
      phone: { type: 'string', description: 'Primary phone in any format. Empty string if not present.' },
      services: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of treatments/services offered (e.g., "Botox", "Lip filler", "Microneedling"). Up to 12.',
      },
    },
    required: ['name', 'city', 'state', 'phone', 'services'],
  },
};

export async function extractClinicInfo(
  site: ScrapedSite,
  overrides: { name?: string; city?: string } = {},
  costTracker?: CostTracker
): Promise<ClinicInfo> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const client = new Anthropic({ apiKey, maxRetries: 8 });

  const prompt = `You are extracting structured business info for a med spa clinic website audit.

URL: ${site.finalUrl}
TITLE: ${site.title}
META DESCRIPTION: ${site.description}

PAGE CONTENT (markdown, truncated):
${headTail(site.markdown, 10_000, 4_000)}

Identify the clinic name, city, state, primary phone, and a list of services/treatments offered. Use the record_clinic_info tool. Use empty string for fields you cannot confidently determine.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool' as const, name: 'record_clinic_info' },
    messages: [{ role: 'user', content: prompt }],
  });

  log.usage('clinic-info', response.usage as any);
  costTracker?.add('clinic-info', MODEL, response.usage as any);
  let extracted: { name: string; city: string; state: string; phone: string; services: string[] } | null = null;
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      extracted = block.input as any;
      break;
    }
  }
  if (!extracted) throw new Error('Claude did not return clinic info tool_use block');

  const domain = domainOf(site.finalUrl);
  return {
    name: overrides.name || extracted.name || domain,
    city: overrides.city || extracted.city || null,
    state: extracted.state || null,
    phone: extracted.phone || null,
    services: (extracted.services || []).slice(0, 12),
    domain,
    url: site.finalUrl,
  };
}
