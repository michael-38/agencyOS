// Verifies that prompt caching is firing on the rubric modules.
// Calls one of them three times in a row on the same input and prints cache stats.
//
// Expected: call 1 writes cache, calls 2 & 3 read cache.
// If you see write-on-every-call, something in the prefix changed between calls.
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../src/utils/models.js';

const SYSTEM_PROMPT = `You are an expert med spa auditor evaluating clinics for AEO/GEO/LLM-citation readiness. Score 0-100 and return findings via the tool. `.repeat(60);

const TOOL_SCHEMA: any = {
  name: 'record_aeo_audit',
  description: 'Records audit findings.',
  input_schema: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
    },
    required: ['score', 'summary'],
  },
};

async function call(client: Anthropic) {
  const t0 = Date.now();
  const resp = await client.messages.create({
    model: MODELS.rubric_judgment,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool' as const, name: 'record_aeo_audit' },
    messages: [{ role: 'user', content: 'Audit this clinic.' }],
    cache_control: { type: 'ephemeral' },
  } as any);
  return { ms: Date.now() - t0, usage: resp.usage };
}

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log(`Model: ${MODELS.rubric_judgment}`);
  console.log(`System prompt: ${SYSTEM_PROMPT.length} chars`);
  for (let i = 1; i <= 3; i++) {
    const r = await call(client);
    const u = r.usage as any;
    console.log(`call ${i}: ${r.ms}ms  cache_write=${u.cache_creation_input_tokens || 0}  cache_read=${u.cache_read_input_tokens || 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
