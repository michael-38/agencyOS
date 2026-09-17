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
  judgment: 'claude-opus-5',
} as const;
export type ModelRole = keyof typeof MODELS;

/**
 * SiteRedesign (site:build) models. Kept separate from MODELS so the audit's run_meta.models keeps
 * describing the audit only.
 */
export const SITE_MODELS = {
  plan: 'claude-opus-5',
  design: 'claude-opus-5',
  /**
   * Render was tried on Sonnet 5 on the theory that markup against an explicit contract, with a
   * validator and repair passes behind it, is where a cheaper model is safest. Measured on a real
   * 6-page build (2026-09-17) it is not: Sonnet went 36 → 13 → 21 errors across its repair passes and
   * never converged, mostly by omitting `data-copy-id` and inventing step labels, while Opus went
   * 2 → 0. It also cost more in practice ($1.32 vs $1.49) because it burned every repair pass and
   * still failed. Keep Opus; `--render-model` is there if you want to retest.
   */
  render: 'claude-opus-5',
} as const;
export type SiteModelRole = keyof typeof SITE_MODELS;

export const SITE_LIMITS = {
  /** Per-source-page cap on the corpus sent to the plan stage. */
  corpusMaxCharsPerPage: 40_000,
  /** Total pages a build may generate, including the home page. */
  maxPages: 12,
  /** Images downloaded from the source site. */
  maxAssets: 24,
  architectureMaxTokens: 24_000,
  contentMaxTokens: 16_000,
  /** Pages whose copy is written concurrently. */
  contentConcurrency: 4,
  designMaxTokens: 32_000,
  renderMaxTokens: 16_000,
  /** Validation failures are fed back to the render stage at most this many times. */
  repairPasses: 2,
  /** Abort the build once spend passes this, so a bad run cannot quietly cost a good one twice over. */
  maxUsd: 6,
  /** Pages rendered concurrently. */
  renderConcurrency: 4,
  titleMinChars: 10,
  titleMaxChars: 70,
  descriptionMinChars: 50,
  descriptionMaxChars: 170,
} as const;

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1366, height: 768 },
} as const;

export const LIMITS = {
  mapLimit: 100,
  subdomainShareForSecondMap: 0.3,
  /** Top-level pages linked from home to judge for unmet subpath items (--max-candidate-pages). */
  candidatePagesMax: 8,
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
