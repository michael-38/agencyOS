import Anthropic from '@anthropic-ai/sdk';
import {
  BusinessType,
  ClassificationResult,
  ExtractedBusinessData,
  RewrittenCopy,
  ScrapeResult,
} from './types.js';
import { buildClassifyPrompt, classifyToolSchema } from './prompts/classify.js';
import { buildExtractPrompt, extractToolSchema } from './prompts/extract.js';
import { buildRewritePrompt, rewriteToolSchema } from './prompts/rewrite.js';
import { formatPhone, formatPhoneRaw } from './utils/phone.js';
import { log } from './utils/logger.js';

const MODEL = 'claude-sonnet-4-20250514';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
  }
  return new Anthropic({ apiKey });
}

function extractToolResult(response: Anthropic.Message, requiredFields: string[]): Record<string, any> {
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const result = block.input as Record<string, any>;
      const missing = requiredFields.filter((f) => result[f] === undefined);
      if (missing.length > 0) {
        throw new Error(`Model response missing required fields: ${missing.join(', ')}`);
      }
      return result;
    }
  }
  throw new Error('No tool_use block found in Claude response');
}

export async function classifyBusiness(
  scrapeResult: ScrapeResult,
  verbose: boolean = false
): Promise<ClassificationResult> {
  const client = getClient();
  const prompt = buildClassifyPrompt(scrapeResult.combinedMarkdown);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    tools: [classifyToolSchema],
    tool_choice: { type: 'tool' as const, name: 'classify_business' },
    messages: [{ role: 'user', content: prompt }],
  });

  const result = extractToolResult(response, ['type', 'confidence', 'reasoning']) as ClassificationResult;

  if (verbose) {
    log.info(`Classification: ${result.type} (confidence: ${result.confidence})`);
    log.info(`Reasoning: ${result.reasoning}`);
  }

  return result;
}

export async function extractBusinessData(
  scrapeResult: ScrapeResult,
  businessType: BusinessType,
  phoneOverride?: string,
  verbose: boolean = false
): Promise<ExtractedBusinessData> {
  const client = getClient();
  const prompt = buildExtractPrompt(
    scrapeResult.combinedMarkdown,
    businessType,
    scrapeResult.extractedPhones,
    scrapeResult.extractedEmails,
    scrapeResult.url
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [extractToolSchema],
    tool_choice: { type: 'tool' as const, name: 'extract_business_data' },
    messages: [{ role: 'user', content: prompt }],
  });

  const data = extractToolResult(response, ['companyName', 'phone', 'services', 'primaryCity']) as ExtractedBusinessData;

  // Apply phone override if provided
  if (phoneOverride) {
    data.phone = formatPhone(phoneOverride);
    data.phoneRaw = formatPhoneRaw(phoneOverride);
  }

  // Fallback: if no phone found, use first extracted phone
  if (!data.phone && scrapeResult.extractedPhones.length > 0) {
    data.phone = formatPhone(scrapeResult.extractedPhones[0]);
    data.phoneRaw = formatPhoneRaw(scrapeResult.extractedPhones[0]);
  }

  // Fallback: if no email found, use first extracted email
  if (!data.email && scrapeResult.extractedEmails.length > 0) {
    data.email = scrapeResult.extractedEmails[0];
  }

  if (verbose) {
    log.info(`Extracted: ${data.companyName}`);
    log.info(`Phone: ${data.phone}`);
    log.info(`City: ${data.primaryCity}`);
    log.info(`Services: ${data.services.length}, Reviews: ${data.reviews.length}`);
  }

  return data;
}

export async function rewriteCopy(
  data: ExtractedBusinessData,
  verbose: boolean = false
): Promise<RewrittenCopy> {
  const client = getClient();
  const prompt = buildRewritePrompt(data);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [rewriteToolSchema],
    tool_choice: { type: 'tool' as const, name: 'generate_landing_page_copy' },
    messages: [{ role: 'user', content: prompt }],
  });

  const copy = extractToolResult(response, ['heroHeadline', 'services', 'reviews', 'bookingHeadline']) as RewrittenCopy;

  if (verbose) {
    log.info(`Hero headline: ${copy.heroHeadline}`);
    log.info(`Services: ${copy.services.length}`);
    log.info(`Reviews: ${copy.reviews.length}`);
  }

  return copy;
}
