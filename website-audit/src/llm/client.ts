// Anthropic client wrapper: structured outputs via messages.parse, image handling, per-call logging,
// cache-keyed replay, retry on invalid output, refusal fallback for the judge, and cost accounting.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z, type ZodType } from 'zod';
import { LIMITS, PRICING } from '../config.js';
import type { RunCache } from '../cache.js';
import { sha256 } from '../cache.js';
import type { Progress } from '../progress.js';

export type ContentPart = { type: 'text'; text: string } | { type: 'image'; path: string; label: string };

export interface ParseRequest<T> {
  step: string;
  label: string;
  model: string;
  system: string;
  content: ContentPart[];
  schema: ZodType<T>;
  maxTokens: number;
  /** Adaptive thinking + effort (Opus/Sonnet only; never for Haiku 4.5). */
  thinking?: { effort: 'low' | 'medium' | 'high' };
  /** Enable the server-side refusal fallback beta (judge on Opus 5). */
  fallbacks?: boolean;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface ParseResult<T> {
  parsed: T;
  usage: Usage | null;
  stopReason: string | null;
  model: string;
  cacheHit: boolean;
  attempts: number;
  logFile: string | null;
  usd: number;
}

export interface CallRecord {
  step: string;
  label: string;
  model: string;
  usage: Usage | null;
  usd: number;
  cacheHit: boolean;
}

export class JudgeOutputError extends Error {
  constructor(
    message: string,
    readonly details: { step: string; label: string; stopReason: string | null; attempts: number; logFile: string | null },
  ) {
    super(message);
    this.name = 'JudgeOutputError';
  }
}

export function usdFor(model: string, usage: Usage | null): number {
  if (!usage) return 0;
  const p = PRICING[model] ?? PRICING[Object.keys(PRICING).find((k) => model.startsWith(k)) ?? ''] ?? { input: 5, output: 25 };
  return (
    (usage.input_tokens * p.input +
      usage.cache_creation_input_tokens * p.input * 1.25 +
      usage.cache_read_input_tokens * p.input * 0.1 +
      usage.output_tokens * p.output) /
    1_000_000
  );
}

function mediaType(p: string): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

export class LlmClient {
  private readonly client: Anthropic;
  private seq = 0;
  readonly calls: CallRecord[] = [];
  usd = 0;

  constructor(
    apiKey: string,
    private readonly cache: RunCache,
    private readonly runDir: string,
    private readonly progress: Progress,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: LIMITS.anthropicMaxRetries });
    fs.mkdirSync(path.join(runDir, 'llm'), { recursive: true });
  }

  private buildContent(parts: ContentPart[]): { blocks: Anthropic.ContentBlockParam[]; loggable: unknown[] } {
    const blocks: Anthropic.ContentBlockParam[] = [];
    const loggable: unknown[] = [];
    let imageIndex = 0;
    for (const part of parts) {
      if (part.type === 'text') {
        blocks.push({ type: 'text', text: part.text });
        loggable.push({ type: 'text', text: part.text });
      } else {
        imageIndex++;
        const abs = path.isAbsolute(part.path) ? part.path : path.join(this.runDir, part.path);
        const buf = fs.readFileSync(abs);
        const label = `Image ${imageIndex}: ${part.label}`;
        blocks.push({ type: 'text', text: label });
        blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType(abs), data: buf.toString('base64') } });
        loggable.push({ type: 'text', text: label });
        loggable.push({ type: 'image', path: path.relative(this.runDir, abs), sha256: sha256(buf), bytes: buf.length });
      }
    }
    return { blocks, loggable };
  }

  async parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>> {
    const { blocks, loggable } = this.buildContent(req.content);
    const jsonSchema = z.toJSONSchema(req.schema as z.ZodType);
    const cacheRequest = {
      step: req.step,
      model: req.model,
      system: req.system,
      content: loggable,
      schema: jsonSchema,
      maxTokens: req.maxTokens,
      thinking: req.thinking ?? null,
      fallbacks: !!req.fallbacks,
    };
    this.seq++;
    const seqStr = String(this.seq).padStart(2, '0');
    const logFile = path.join('llm', `${seqStr}-${req.step}-${req.label.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)}.json`);

    const res = await this.cache.cached<{
      parsed: T;
      usage: Usage | null;
      stop_reason: string | null;
      stop_details: unknown;
      model: string;
      attempts: number;
      content: unknown;
      timing_ms: number;
    }>('llm', cacheRequest, async () => {
      let attempts = 0;
      let last: { stop_reason: string | null; parsed: T | null; usage: Usage | null; content: unknown; stop_details: unknown; model: string } | null = null;
      const started = Date.now();
      while (attempts < 2) {
        attempts++;
        this.progress.log(`anthropic.parse ${req.step}/${req.label} model=${req.model} attempt=${attempts}`);
        const base = {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user' as const, content: blocks }],
          output_config: {
            format: zodOutputFormat(req.schema as z.ZodType),
            ...(req.thinking ? { effort: req.thinking.effort } : {}),
          },
          ...(req.thinking ? { thinking: { type: 'adaptive' as const } } : {}),
        };
        let msg: {
          parsed_output: T | null;
          stop_reason: string | null;
          usage: Anthropic.Usage;
          content: unknown;
          stop_details?: unknown;
          model: string;
        };
        if (req.fallbacks) {
          const m = await this.client.beta.messages.parse({
            ...base,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          } as Parameters<typeof this.client.beta.messages.parse>[0]);
          msg = m as unknown as typeof msg;
        } else {
          const m = await this.client.messages.parse(base as Parameters<typeof this.client.messages.parse>[0]);
          msg = m as unknown as typeof msg;
        }
        const usage: Usage = {
          input_tokens: msg.usage?.input_tokens ?? 0,
          output_tokens: msg.usage?.output_tokens ?? 0,
          cache_creation_input_tokens: msg.usage?.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: msg.usage?.cache_read_input_tokens ?? 0,
        };
        this.recordUsage(req, msg.model ?? req.model, usage, false);
        last = { stop_reason: msg.stop_reason, parsed: msg.parsed_output, usage, content: msg.content, stop_details: msg.stop_details, model: msg.model ?? req.model };
        const bad = msg.parsed_output == null || msg.stop_reason === 'max_tokens' || msg.stop_reason === 'refusal';
        if (!bad) break;
        this.progress.info(`${req.step}/${req.label}: invalid output (stop_reason=${msg.stop_reason}, parsed=${msg.parsed_output != null}); ${attempts < 2 ? 'retrying' : 'giving up'}`);
      }
      const timing_ms = Date.now() - started;
      const value = {
        parsed: last!.parsed as T,
        usage: last!.usage,
        stop_reason: last!.stop_reason,
        stop_details: last!.stop_details ?? null,
        model: last!.model,
        attempts,
        content: last!.content,
        timing_ms,
      };
      this.writeLog(logFile, { request: cacheRequest, response: value, cache_hit: false });
      if (last!.parsed == null || last!.stop_reason === 'max_tokens' || last!.stop_reason === 'refusal') {
        // Persist the log before raising so spent tokens stay inspectable.
        throw new JudgeOutputError(`${req.step}/${req.label}: no valid structured output after ${attempts} attempt(s) (stop_reason=${last!.stop_reason})`, {
          step: req.step,
          label: req.label,
          stopReason: last!.stop_reason,
          attempts,
          logFile,
        });
      }
      return { value };
    });

    if (res.hit) {
      this.recordUsage(req, res.value.model, res.value.usage, true);
      this.writeLog(logFile, { request: cacheRequest, response: res.value, cache_hit: true, cache_source: res.source });
    }
    return {
      parsed: res.value.parsed,
      usage: res.value.usage,
      stopReason: res.value.stop_reason,
      model: res.value.model,
      cacheHit: res.hit,
      attempts: res.value.attempts,
      logFile,
      usd: res.hit ? 0 : usdFor(res.value.model, res.value.usage),
    };
  }

  private recordUsage(req: ParseRequest<unknown>, model: string, usage: Usage | null, cacheHit: boolean): void {
    const usd = cacheHit ? 0 : usdFor(model, usage);
    this.usd += usd;
    this.calls.push({ step: req.step, label: req.label, model, usage, usd, cacheHit });
  }

  private writeLog(rel: string, data: unknown): void {
    fs.writeFileSync(path.join(this.runDir, rel), JSON.stringify(data, null, 2));
  }
}
