// Webfonts are data: config/fonts.yaml names every self-hostable face, and the files are copied into
// the site so the page never reaches the network. A design direction that no available file serves
// falls back to a system stack, which costs nothing and always renders.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const FontSchema = z.object({
  family: z.string().min(1),
  file: z.string().min(1),
  weight_range: z.string().min(1),
  style: z.enum(['normal', 'italic']).default('normal'),
  classification: z.enum(['sans', 'serif', 'mono', 'display']).default('sans'),
});
export const FontsFileSchema = z.object({ version: z.number(), fonts: z.array(FontSchema).default([]) });
export type FontEntry = z.infer<typeof FontSchema>;

export interface AvailableFont extends FontEntry {
  /** Absolute path to the source file. */
  absolute: string;
  /** Path relative to assets/site.css, which is what @font-face must reference. */
  cssRelative: string;
}

export const FONTS_FILE = 'config/fonts.yaml';

/** Read config/fonts.yaml and drop any entry whose file is missing, rather than failing the build. */
export function loadFonts(repo: string): { fonts: AvailableFont[]; warnings: string[] } {
  const file = path.join(repo, FONTS_FILE);
  if (!fs.existsSync(file)) return { fonts: [], warnings: [`${FONTS_FILE} is missing; system font stacks only`] };
  const parsed = FontsFileSchema.safeParse(parseYaml(fs.readFileSync(file, 'utf8')));
  if (!parsed.success) {
    return { fonts: [], warnings: [`${FONTS_FILE} is invalid (${parsed.error.issues[0]?.message ?? 'unknown'}); system font stacks only`] };
  }
  const fonts: AvailableFont[] = [];
  const warnings: string[] = [];
  for (const f of parsed.data.fonts) {
    const abs = path.join(repo, f.file);
    if (!fs.existsSync(abs)) {
      warnings.push(`${FONTS_FILE}: "${f.family}" points at ${f.file}, which does not exist`);
      continue;
    }
    fonts.push({ ...f, absolute: abs, cssRelative: `fonts/${path.basename(abs)}` });
  }
  return { fonts, warnings };
}

/** Copy the faces the build offers into <siteDir>/assets/fonts. */
export function installFonts(fonts: AvailableFont[], siteDir: string): string[] {
  if (!fonts.length) return [];
  const dir = path.join(siteDir, 'assets', 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const f of fonts) {
    const dest = path.join(dir, path.basename(f.absolute));
    fs.copyFileSync(f.absolute, dest);
    written.push(path.posix.join('assets', 'fonts', path.basename(f.absolute)));
  }
  return written;
}
