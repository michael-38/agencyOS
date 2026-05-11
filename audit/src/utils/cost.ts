// Per-audit Anthropic cost telemetry.
//
// Pricing per 1M tokens (Sonnet 4.6 / Haiku 4.5 / Opus 4.7).
// Cache writes are 1.25× input; cache reads are 0.1× input.
// Pricing source: `shared/models.md` in the claude-api skill.

import chalk from 'chalk';

interface ModelPricing {
  input: number;  // $/1M
  output: number; // $/1M
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7': { input: 5.00, output: 25.00 },
  'claude-opus-4-6': { input: 5.00, output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00 },
};

function priceFor(model: string): ModelPricing {
  // Match the longest alias prefix
  const exact = PRICING[model];
  if (exact) return exact;
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key];
  }
  // Conservative fallback
  return { input: 3.00, output: 15.00 };
}

export interface CallUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CallEntry {
  label: string;
  model: string;
  usage: CallUsage;
}

export interface CostSummary {
  callEntries: CallEntry[];
  totalUsd: number;
  byLabel: Record<string, number>;
}

export function entryCostUsd(entry: CallEntry): number {
  const p = priceFor(entry.model);
  const u = entry.usage || {};
  const inputUsd = (u.input_tokens ?? 0) * p.input / 1_000_000;
  const writeUsd = (u.cache_creation_input_tokens ?? 0) * (p.input * 1.25) / 1_000_000;
  const readUsd = (u.cache_read_input_tokens ?? 0) * (p.input * 0.10) / 1_000_000;
  const outputUsd = (u.output_tokens ?? 0) * p.output / 1_000_000;
  return inputUsd + writeUsd + readUsd + outputUsd;
}

export class CostTracker {
  private entries: CallEntry[] = [];

  add(label: string, model: string, usage: CallUsage | undefined | null): void {
    if (!usage) return;
    this.entries.push({ label, model, usage });
  }

  summary(): CostSummary {
    const byLabel: Record<string, number> = {};
    let total = 0;
    for (const e of this.entries) {
      const c = entryCostUsd(e);
      byLabel[e.label] = (byLabel[e.label] ?? 0) + c;
      total += c;
    }
    return { callEntries: this.entries, totalUsd: total, byLabel };
  }

  print(): void {
    const s = this.summary();
    if (s.callEntries.length === 0) return;
    console.log('');
    console.log(chalk.bold.white('Anthropic cost summary'));
    console.log(chalk.dim('─'.repeat(60)));
    const grouped: Record<string, { calls: number; model: string; inputTokens: number; outputTokens: number; cacheWrite: number; cacheRead: number; usd: number }> = {};
    for (const e of s.callEntries) {
      if (!grouped[e.label]) {
        grouped[e.label] = { calls: 0, model: e.model, inputTokens: 0, outputTokens: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };
      }
      const g = grouped[e.label];
      g.calls += 1;
      g.inputTokens += e.usage.input_tokens ?? 0;
      g.outputTokens += e.usage.output_tokens ?? 0;
      g.cacheWrite += e.usage.cache_creation_input_tokens ?? 0;
      g.cacheRead += e.usage.cache_read_input_tokens ?? 0;
      g.usd += entryCostUsd(e);
    }
    for (const [label, g] of Object.entries(grouped)) {
      const cacheNote = g.cacheRead > 0
        ? chalk.green(`cache_read=${g.cacheRead}`)
        : g.cacheWrite > 0
          ? chalk.yellow(`cache_write=${g.cacheWrite}`)
          : chalk.dim('no cache');
      const callsNote = g.calls > 1 ? ` (×${g.calls})` : '';
      console.log(
        `  ${chalk.bold(label.padEnd(22))}${callsNote.padEnd(6)} ${chalk.dim(g.model.padEnd(20))} ` +
        `in=${g.inputTokens.toLocaleString()} out=${g.outputTokens.toLocaleString()} ${cacheNote}  ${chalk.green('$' + g.usd.toFixed(4))}`
      );
    }
    console.log(chalk.dim('─'.repeat(60)));
    console.log(`  ${chalk.bold('Total Anthropic'.padEnd(28))}                                ${chalk.green.bold('$' + s.totalUsd.toFixed(4))}`);
  }

  estimatedNext(model: string, additionalInputTokens: number, additionalOutputTokens: number): number {
    const p = priceFor(model);
    return (additionalInputTokens * p.input + additionalOutputTokens * p.output) / 1_000_000;
  }
}
