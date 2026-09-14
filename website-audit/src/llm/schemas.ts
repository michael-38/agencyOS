// Zod output schemas for every LLM call. Structured outputs support enum/required/nested objects but
// not length or count constraints, so those are enforced in code after parsing.
import { z } from 'zod';

const nonEmpty = (values: string[], what: string): [string, ...string[]] => {
  if (!values.length) throw new Error(`cannot build an enum for ${what}: no values`);
  return values as [string, ...string[]];
};

export function classifySchema(slugs: string[]) {
  return z.object({
    slug: z.enum(nonEmpty(slugs, 'industry slugs')),
    confidence: z.number(),
    rationale: z.string(),
  });
}
export type ClassifyOutput = z.infer<ReturnType<typeof classifySchema>>;

export function homeChooserSchema(urls: string[]) {
  return z.object({
    home_url: z.enum(nonEmpty(urls, 'home candidates')),
    reason: z.string(),
  });
}
export type HomeChooserOutput = z.infer<ReturnType<typeof homeChooserSchema>>;

export function candidatesSchema(itemIds: string[], urls: string[]) {
  const urlEnum = z.enum(nonEmpty(urls, 'candidate URLs'));
  const shape = Object.fromEntries(
    itemIds.map((id) => [
      id,
      z.object({
        candidates: z.array(z.object({ url: urlEnum, reason: z.string() })),
      }),
    ]),
  );
  return z.object(shape);
}
export type CandidatesOutput = Record<string, { candidates: { url: string; reason: string }[] }>;

export const JudgmentItemSchema = z.object({
  verdict: z.enum(['pass', 'partial', 'fail']),
  evidence: z.object({
    quote: z.string().nullable(),
    location: z.string().nullable(),
    screenshot: z
      .object({
        viewport: z.enum(['mobile', 'desktop']),
        image_index: z.number(),
        region: z.string(),
      })
      .nullable(),
    summary: z.string(),
  }),
  note: z.string(),
});
export type JudgmentItem = z.infer<typeof JudgmentItemSchema>;

export function judgmentSchema(itemIds: string[]) {
  const shape = Object.fromEntries(itemIds.map((id) => [id, JudgmentItemSchema]));
  return z.object(shape);
}
export type JudgmentOutput = Record<string, JudgmentItem>;
