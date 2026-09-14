// HTML helpers shared by deterministic checks and facts extraction. Pure functions over raw HTML.
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export type JsonLdObject = Record<string, unknown>;

export interface JsonLdExtract {
  objects: JsonLdObject[]; // every object (recursively) that has an @type
  scripts: number;
  parseErrors: number;
}

export function loadHtml(rawHtml: string): CheerioAPI {
  return cheerio.load(rawHtml || '');
}

function collectTyped(node: unknown, out: JsonLdObject[], depth = 0): void {
  if (depth > 8 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collectTyped(n, out, depth + 1);
    return;
  }
  const obj = node as JsonLdObject;
  if ('@type' in obj) out.push(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === '@context') continue;
    if (v && typeof v === 'object') collectTyped(v, out, depth + 1);
  }
}

export function extractJsonLd($: CheerioAPI): JsonLdExtract {
  const objects: JsonLdObject[] = [];
  let scripts = 0;
  let parseErrors = 0;
  $('script').each((_, el) => {
    const type = ($(el).attr('type') || '').toLowerCase();
    if (!type.includes('ld+json')) return;
    scripts++;
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      collectTyped(parsed, objects);
    } catch {
      parseErrors++;
    }
  });
  return { objects, scripts, parseErrors };
}

export function typesOf(obj: JsonLdObject): string[] {
  const t = obj['@type'];
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string') return [t];
  return [];
}

export function allTypes(extract: JsonLdExtract): string[] {
  return [...new Set(extract.objects.flatMap(typesOf))];
}

export function hasType(extract: JsonLdExtract, wanted: string[]): boolean {
  const w = new Set(wanted.map((t) => t.toLowerCase()));
  return extract.objects.some((o) => typesOf(o).some((t) => w.has(t.toLowerCase())));
}

/** Case-insensitive substring match; a `*` in a pattern matches any run of characters. */
export function matchesPattern(haystackLower: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (!p.includes('*')) return haystackLower.includes(p);
  const re = new RegExp(p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'));
  return re.test(haystackLower);
}

export function findVendors(rawHtml: string, vendors: { name: string; patterns: string[] }[]): string[] {
  const lower = rawHtml.toLowerCase();
  return vendors.filter((v) => v.patterns.some((p) => matchesPattern(lower, p))).map((v) => v.name);
}

export function headingTexts($: CheerioAPI, selector: string): string[] {
  const out: string[] = [];
  $(selector).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  });
  return out;
}

export function visibleText($: CheerioAPI): string {
  const clone = $.root().clone();
  clone.find('script, style, noscript, template').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

export function telHrefs($: CheerioAPI): string[] {
  const out: string[] = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (/^tel:/i.test(href)) out.push(href);
  });
  return out;
}

export interface FormInfo {
  action: string | null;
  fieldCount: number;
  hasSubmit: boolean;
  isSearch: boolean;
}

export function forms($: CheerioAPI): FormInfo[] {
  const out: FormInfo[] = [];
  $('form').each((_, el) => {
    const f = $(el);
    const fields = f.find('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
    const isSearch =
      (f.attr('role') || '').toLowerCase() === 'search' ||
      f.find('input[type=search]').length > 0 ||
      /search/i.test(f.attr('id') || '') ||
      /search/i.test(f.attr('class') || '');
    out.push({
      action: f.attr('action') ?? null,
      fieldCount: fields.length,
      hasSubmit: f.find('button, input[type=submit]').length > 0,
      isSearch,
    });
  });
  return out;
}

export const QUESTION_RE = /\?\s*$|^(how|what|why|when|where|which|who|do|does|can|is|are|should|will)\b/i;

export function questionHeadings($: CheerioAPI): string[] {
  return headingTexts($, 'h2, h3').filter((h) => QUESTION_RE.test(h));
}

export function snippet(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
