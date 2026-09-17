// Stage C: one call produces the whole site's stylesheet plus the class contract the render stage
// must follow. One stylesheet for every page is what keeps a dozen independently rendered pages
// looking like one site; the class contract is what keeps the markup stage from inventing its own.
import { SITE_LIMITS } from '../config.js';
import type { LlmParser } from '../llm/client.js';
import { siteDesignSystem, siteDesignUser, type DesignFont, type DesignPersona } from '../llm/prompts/site-design.js';
import type { AvailableFont } from './fonts.js';
import { DesignSpecSchema, type BuildProfile, type DesignSpec } from './types.js';

export interface DesignStageOptions {
  llm: LlmParser;
  model: string;
  persona: DesignPersona;
  designSystem: string;
  directionGuidance: string;
  fonts: AvailableFont[];
  imagery: string;
  profile: BuildProfile;
}

export interface DesignStageResult {
  spec: DesignSpec;
  issues: string[];
  usd: number;
  cacheHit: boolean;
}

/** url() targets that would put the page back on the network, which both profiles forbid. */
const REMOTE_URL_RE = /url\(\s*['"]?(?:https?:)?\/\//i;
const REMOTE_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i;

export function checkCss(css: string, allowedFontFiles: string[]): string[] {
  const issues: string[] = [];
  if (REMOTE_URL_RE.test(css)) issues.push('stylesheet contains a url() pointing at a remote host');
  if (REMOTE_IMPORT_RE.test(css)) issues.push('stylesheet contains a remote @import');
  const allowed = new Set(allowedFontFiles);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const target = m[1].trim();
    if (target.startsWith('data:')) continue;
    if (!allowed.has(target)) issues.push(`stylesheet references "${target}", which is not an installed font file`);
  }
  if (!/prefers-reduced-motion/.test(css)) issues.push('stylesheet has no prefers-reduced-motion block');
  if (/outline:\s*(none|0)\s*[;}]/i.test(css) && !/:focus-visible/.test(css)) {
    issues.push('stylesheet removes outlines without defining a :focus-visible replacement');
  }
  return issues;
}

function toPromptFonts(fonts: AvailableFont[]): DesignFont[] {
  return fonts.map((f) => ({ family: f.family, file: f.cssRelative, weightRange: f.weight_range, style: f.style }));
}

export async function runDesignStage(o: DesignStageOptions): Promise<DesignStageResult> {
  const res = await o.llm.parse({
    step: 'site-design',
    label: 'design',
    model: o.model,
    system: siteDesignSystem(o.persona),
    content: [
      {
        type: 'text',
        text: siteDesignUser({
          designSystem: o.designSystem,
          directionGuidance: o.directionGuidance,
          fonts: toPromptFonts(o.fonts),
          imagery: o.imagery,
          profile: o.profile,
        }),
      },
    ],
    schema: DesignSpecSchema,
    maxTokens: SITE_LIMITS.designMaxTokens,
    thinking: { effort: 'medium' },
    fallbacks: true,
  });
  const issues = checkCss(res.parsed.css, o.fonts.map((f) => f.cssRelative));
  return { spec: res.parsed, issues, usd: res.usd, cacheHit: res.cacheHit };
}
