// Central configuration: model pins, viewports, limits, pricing, and path resolution.
// No industry knowledge lives here (see config/industries.yaml, config/detectors.yaml, personas/).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const PIPELINE_VERSION = '0.1.0';
export const PROBE_VERSION = 2;

export const MODELS = {
  classify: 'claude-haiku-4-5',
  home: 'claude-haiku-4-5',
  candidates: 'claude-haiku-4-5',
  judgment: 'claude-opus-5',
} as const;
export type ModelRole = keyof typeof MODELS;

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1366, height: 768 },
} as const;

export const LIMITS = {
  mapLimit: 100,
  subdomainShareForSecondMap: 0.3,
  candidatesPerItem: 3,
  tilesSent: 4,
  /** Long-edge limit above which Opus 5 / Sonnet 5 downscale an image (px). */
  maxTileEdgePx: 2576,
  judgeMarkdownMaxChars: 80_000,
  classifyConfidenceThreshold: 0.8,
  classifySlugCount: 50,
  splashMaxWords: 120,
  resolveTimeoutMs: 15_000,
  scrapeTimeoutMs: 60_000,
  scrapeWaitForMs: 1500,
  judgeMaxTokens: 16_000,
  smallMaxTokens: 1024,
  firecrawlMaxRetries: 2,
  anthropicMaxRetries: 4,
} as const;

/** USD per 1M tokens. Cache writes 1.25x input, cache reads 0.1x input. */
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function repoRoot(override?: string): string {
  return override ? path.resolve(override) : path.resolve(packageRoot(), '..');
}

/** Load secrets from website-audit/.env if present, else the repo-root .env. Never logs values. */
export function loadEnv(repo: string): { loadedFrom: string | null } {
  const candidates = [path.join(packageRoot(), '.env'), path.join(repo, '.env')];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, quiet: true } as Parameters<typeof dotenv.config>[0]);
      return { loadedFrom: p };
    }
  }
  return { loadedFrom: null };
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to website-audit/.env or the repo-root .env.`);
  return v;
}
