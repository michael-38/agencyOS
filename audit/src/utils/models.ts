// Per-module model assignment, tuned for cost without sacrificing output quality.
//
//   - cheap_extraction → Haiku 4.5 ($1 / $5 per 1M tokens)
//   - rubric_judgment / vision_rubric → Sonnet 4.6 ($3 / $15)
//   - consumer_proxy → Sonnet 4.6 (matches what real claude.ai users see, so the
//     LLM-discoverability audit reflects actual recall behavior)
//
// Bump centrally if you want to A/B against Opus 4.7 ($5 / $25).
export const MODELS = {
  cheap_extraction: 'claude-haiku-4-5',
  rubric_judgment: 'claude-sonnet-4-6',
  vision_rubric: 'claude-sonnet-4-6',
  consumer_proxy: 'claude-sonnet-4-6',
} as const;
