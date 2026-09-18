// The one thing about a template that moves per client: its accent.
//
// The persona's layout, type scale, rhythm and imagery stay exactly as authored — that is the whole
// point of a template — but a page in a stranger's colours does not read as the client's. So the
// accent, and only the accent, is taken from the client's own logo.
//
// Two rules make this safe. The accent is reached through three custom properties and nothing else
// (the promotion gate enforces that), so overriding it cannot leak into a shadow or a border that
// was written as a literal. And an override that fails WCAG AA is never shipped: it is walked into
// compliance, or the template's own accent is kept and the report says why.
import path from 'node:path';
import sharp from 'sharp';
import type { AssetRecord } from './types.js';

export const BRAND_TOKENS = ['--brand-accent', '--brand-accent-dark', '--brand-accent-fg'] as const;

/** AA for body text; large text and UI components are held to 3:1. */
const TEXT_RATIO = 4.5;
const UI_RATIO = 3;

/** Below this chroma a swatch is a grey, a near-white or a near-black, and says nothing about brand. */
const MIN_CHROMA = 28;
/** A swatch this dark or this light is the logo's background, not its colour. */
const MIN_LUMA = 0.03;
const MAX_LUMA = 0.93;

export type BrandMode = 'auto' | 'off' | string;

export interface BrandSurfaces {
  /** Page background in the light scheme, and the dark scheme's equivalent. */
  light: string;
  dark: string;
}

export interface BrandDecision {
  /** null when the template's own accent is kept. */
  accent: string | null;
  accentDark: string | null;
  accentFg: string | null;
  origin: 'logo' | 'flag' | 'template-default';
  /** The `:root` rules to append to the template stylesheet, or null to change nothing. */
  css: string | null;
  /** Measured ratios, for seo-report.md. */
  ratios: { scheme: 'light' | 'dark'; against: string; ratio: number; required: number }[];
  notes: string[];
}

// ---------------------------------------------------------------------------------------------
// Colour maths (ported from templates/personas/tools/contrast.mjs, which these pages were built on)
// ---------------------------------------------------------------------------------------------

export function parseHex(h: string): [number, number, number] | null {
  const s = h.trim().replace(/^#/, '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as [number, number, number];
}

export const toHex = (rgb: number[]): string =>
  `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 0;
  const [l1, l2] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Walk the colour toward black or white, whichever helps, until it clears `target`. */
export function towardContrast(fg: string, bg: string, target: number): string {
  const bgRgb = parseHex(bg);
  const fgRgb = parseHex(fg);
  if (!bgRgb || !fgRgb) return fg;
  const bgLight = luminance(bgRgb) > 0.4;
  let rgb = fgRgb.slice();
  for (let i = 0; i < 255; i++) {
    if (contrast(toHex(rgb), bg) >= target) break;
    rgb = rgb.map((v) => (bgLight ? v - 1 : v + 1));
  }
  return toHex(rgb);
}

const chroma = (rgb: number[]): number => Math.max(...rgb) - Math.min(...rgb);

/** Whether a swatch says anything about the brand, or is just the logo's paper. */
export function isUsableSwatch(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const l = luminance(rgb);
  return chroma(rgb) >= MIN_CHROMA && l > MIN_LUMA && l < MAX_LUMA;
}

// ---------------------------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------------------------

/**
 * The dominant colour of the client's logo. `sharp` is already a dependency (the asset stage
 * re-encodes every harvested image with it) and its `stats()` reports a dominant swatch, so this
 * costs one read of a file already on disk.
 */
export async function logoAccent(assets: AssetRecord[], siteDir: string): Promise<{ hex: string; file: string } | null> {
  const logos = assets.filter((a) => a.role === 'logo' && a.same_host);
  if (!logos.length) return null;
  for (const logo of logos) {
    try {
      const { dominant } = await sharp(path.join(siteDir, logo.file)).stats();
      const hex = toHex([dominant.r, dominant.g, dominant.b]);
      if (isUsableSwatch(hex)) return { hex, file: logo.file };
    } catch {
      // A logo that will not decode is not worth failing a build over.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------------------------

export interface BrandInput {
  mode: BrandMode;
  /** Dominant logo colour, when the asset stage found a usable one. */
  extracted: { hex: string; file: string } | null;
  /** The template's own accent triple, for the fallback and for the light/dark defaults. */
  templateAccent: { light: string; dark: string; fg: string };
  surfaces: BrandSurfaces;
}

/**
 * Decide the accent, and prove it before returning it.
 *
 * The candidate is checked against the page background in *both* colour schemes — the persona pages
 * ship `prefers-color-scheme` support and Lighthouse only ever exercises one of them, so an override
 * verified in light alone would ship a dark-mode contrast failure unseen.
 */
export function decideBrand(o: BrandInput): BrandDecision {
  const keep = (notes: string[]): BrandDecision => ({
    accent: null,
    accentDark: null,
    accentFg: null,
    origin: 'template-default',
    css: null,
    ratios: [],
    notes,
  });

  if (o.mode === 'off') return keep(['brand override disabled with --brand off; the template accent is unchanged']);

  let candidate: string | null = null;
  let origin: BrandDecision['origin'] = 'template-default';
  const notes: string[] = [];

  if (o.mode !== 'auto') {
    const given = parseHex(o.mode);
    if (!given) return keep([`--brand "${o.mode}" is not a hex colour; the template accent is unchanged`]);
    candidate = toHex(given);
    origin = 'flag';
  } else if (o.extracted) {
    candidate = o.extracted.hex;
    origin = 'logo';
    notes.push(`accent taken from the dominant colour of ${o.extracted.file}`);
  } else {
    return keep(['no usable logo colour was harvested, so the template accent is unchanged']);
  }

  // Light scheme: the accent carries links and the focus ring on the page background, so it is held
  // to text contrast; the button fill only has to clear UI contrast.
  const light = towardContrast(candidate, o.surfaces.light, UI_RATIO);
  const lightInk = towardContrast(light, o.surfaces.light, TEXT_RATIO);
  // Dark scheme: the same hue has to come back up off a dark surface.
  const dark = towardContrast(candidate, o.surfaces.dark, UI_RATIO);
  const darkInk = towardContrast(dark, o.surfaces.dark, TEXT_RATIO);
  // Button text sits on the accent itself, so pick whichever of white/near-black clears it.
  const fg = contrast('#ffffff', light) >= contrast('#111111', light) ? '#ffffff' : '#111111';

  const ratios: BrandDecision['ratios'] = [
    { scheme: 'light', against: o.surfaces.light, ratio: contrast(lightInk, o.surfaces.light), required: TEXT_RATIO },
    { scheme: 'light', against: light, ratio: contrast(fg, light), required: TEXT_RATIO },
    { scheme: 'dark', against: o.surfaces.dark, ratio: contrast(darkInk, o.surfaces.dark), required: TEXT_RATIO },
  ];

  const failing = ratios.filter((r) => r.ratio < r.required);
  if (failing.length) {
    return keep([
      ...notes,
      `the ${origin === 'flag' ? 'requested' : 'harvested'} accent ${candidate} could not be brought to WCAG AA in ${failing.map((f) => f.scheme).join(' and ')} ` +
        `(best ${failing.map((f) => f.ratio.toFixed(2)).join(', ')} against ${failing.map((f) => f.against).join(', ')}), so the template accent was kept`,
    ]);
  }

  const css =
    `:root{--brand-accent:${light};--brand-accent-dark:${lightInk};--brand-accent-fg:${fg};}\n` +
    `@media (prefers-color-scheme: dark){:root{--brand-accent:${dark};--brand-accent-dark:${darkInk};--brand-accent-fg:${fg};}}`;

  return { accent: light, accentDark: lightInk, accentFg: fg, origin, css, ratios, notes };
}

/**
 * The template's own accent and its two page backgrounds, read out of its stylesheet. Needed both as
 * the fallback and as what a candidate has to contrast against.
 */
export function readTemplateColours(css: string): { templateAccent: BrandInput['templateAccent']; surfaces: BrandSurfaces } | null {
  const darkBlockAt = css.search(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/i);
  const lightCss = darkBlockAt === -1 ? css : css.slice(0, darkBlockAt);
  const darkCss = darkBlockAt === -1 ? '' : css.slice(darkBlockAt);
  const pick = (source: string, name: string): string | null => {
    const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,6})`).exec(source);
    return m ? m[1] : null;
  };
  const accentLight = pick(lightCss, '--brand-accent');
  const fg = pick(lightCss, '--brand-accent-fg');
  if (!accentLight || !fg) return null;
  const bodyBg = (source: string): string | null => {
    const m = /body\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/.exec(source);
    return m ? m[1] : null;
  };
  return {
    templateAccent: { light: accentLight, dark: pick(darkCss, '--brand-accent') ?? accentLight, fg },
    // The persona pages set the page background on a token, so fall back to plain white/near-black
    // rather than guessing: a wrong surface would produce a wrong ratio, which is worse than a
    // conservative one.
    surfaces: { light: bodyBg(lightCss) ?? '#ffffff', dark: bodyBg(darkCss) ?? '#111111' },
  };
}
