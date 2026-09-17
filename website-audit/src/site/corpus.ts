// Stage A input: turn a finished audit run's scraped markdown into a clean, quotable source corpus.
//
// The audit scrapes with onlyMainContent:false, so page.md carries the nav (often twice, once per
// breakpoint) and the footer. stripLegal + stripLinkTargets from content/filter.ts remove legal
// boilerplate and link targets; dropRepeatedBlocks removes the chrome that repeats inside one page.
// Nothing on disk is modified — the corpus is derived and the raw markdown stays the source of truth
// for provenance quotes.
import fs from 'node:fs';
import path from 'node:path';
import { stripLegal, stripLinkTargets } from '../content/filter.js';
import { stripSiteHost } from '../urls.js';
import type { Facts } from '../checks/facts.js';
import type { Report } from '../report/schema.js';

export interface CorpusPage {
  url: string;
  role: 'root' | 'home' | 'candidate';
  page_key: string;
  title: string | null;
  headings: string[];
  /** Cleaned markdown, safe to quote from. */
  text: string;
  chars_raw: number;
  chars_clean: number;
  repeated_blocks_removed: number;
  truncated: boolean;
}

export interface SourceCorpus {
  host: string;
  home_url: string;
  pages: CorpusPage[];
  facts: Facts | null;
  total_chars: number;
}

const HEADING_ONLY = /^#{1,6}\s+[^\n]*$/;
const HR_ONLY = /^(\* \* \*|\*\*\*|---|___)$/;

/**
 * Drop paragraph blocks that occur more than once inside a single page (duplicated responsive navs,
 * repeated CTA rows, the footer address echoed in a sidebar). The first occurrence is kept so the
 * text stays quotable; later ones are dropped. Headings and rules are never eligible, and very short
 * blocks are left alone because repetition there is usually meaningful (a phone number, a price).
 */
export function dropRepeatedBlocks(text: string, minChars = 40): { text: string; removedBlocks: number } {
  const seen = new Map<string, number>();
  const out: string[] = [];
  let removedBlocks = 0;
  for (const raw of text.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const eligible = block.length >= minChars && !HEADING_ONLY.test(block) && !HR_ONLY.test(block);
    if (!eligible) {
      out.push(block);
      continue;
    }
    const count = (seen.get(block) ?? 0) + 1;
    seen.set(block, count);
    if (count > 1) {
      removedBlocks++;
      continue;
    }
    out.push(block);
  }
  return { text: out.join('\n\n'), removedBlocks };
}

/** The first H1 in the markdown, which is the closest thing the corpus has to a page title. */
export function firstH1(markdown: string): string | null {
  const m = /^#\s+(\S.*?)\s*$/m.exec(markdown);
  return m ? m[1] : null;
}

/** Markdown ATX headings, in document order, with the leading hashes removed. */
export function headingsOf(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = /^(#{1,6})\s+(\S.*?)\s*$/.exec(line);
    if (m) out.push(`${'#'.repeat(m[1].length)} ${m[2]}`);
  }
  return out;
}

export interface BuildCorpusOptions {
  /** Per-page cap. 0 disables capping. */
  maxCharsPerPage: number;
}

/**
 * Read every page the audit persisted markdown for and clean it. Pages whose markdown file is
 * missing (a scrape that failed) are skipped rather than faked.
 */
export function buildCorpus(report: Report, runDir: string, opts: BuildCorpusOptions): SourceCorpus {
  const host = stripSiteHost(new URL(report.home_url).hostname);
  const pages: CorpusPage[] = [];
  for (const p of report.pages) {
    if (!p.markdown_path) continue;
    const abs = path.join(runDir, p.markdown_path);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, 'utf8');
    const legal = stripLegal(raw);
    const stripped = stripLinkTargets(legal.text, host);
    const deduped = dropRepeatedBlocks(stripped.text);
    let text = deduped.text;
    let truncated = false;
    if (opts.maxCharsPerPage > 0 && text.length > opts.maxCharsPerPage) {
      text = text.slice(0, opts.maxCharsPerPage);
      truncated = true;
    }
    pages.push({
      url: p.url,
      role: p.role,
      page_key: p.page_key,
      title: firstH1(text),
      headings: headingsOf(text),
      text,
      chars_raw: raw.length,
      chars_clean: text.length,
      repeated_blocks_removed: deduped.removedBlocks,
      truncated,
    });
  }
  // Home first, then the rest in audit order: the plan prompt reads top-down.
  pages.sort((a, b) => (a.role === 'home' ? -1 : b.role === 'home' ? 1 : 0));
  return {
    host,
    home_url: report.home_url,
    pages,
    facts: report.facts,
    total_chars: pages.reduce((n, p) => n + p.chars_clean, 0),
  };
}

/** Render the corpus as the prompt block the plan stage sends. Page URLs are the provenance keys. */
export function corpusToPrompt(corpus: SourceCorpus): string {
  const parts: string[] = [];
  for (const p of corpus.pages) {
    parts.push(`<page url="${p.url}" role="${p.role}"${p.truncated ? ' truncated="true"' : ''}>\n${p.text}\n</page>`);
  }
  return parts.join('\n\n');
}

/** Facts block for the prompt: the values that must survive the rewrite unchanged. */
export function factsToPrompt(facts: Facts | null): string {
  if (!facts) return '(no facts were extracted from the source site)';
  const lines: string[] = [];
  if (facts.business_name) lines.push(`business_name: ${facts.business_name}`);
  if (facts.phones.length) lines.push(`phones: ${facts.phones.join(', ')}`);
  if (facts.address) lines.push(`address: ${typeof facts.address === 'string' ? facts.address : JSON.stringify(facts.address)}`);
  if (facts.hours) lines.push(`hours: ${typeof facts.hours === 'string' ? facts.hours : JSON.stringify(facts.hours)}`);
  if (facts.services.length) lines.push(`services (as scraped from nav/headings, may be noisy): ${facts.services.join(' | ')}`);
  lines.push(`provenance: ${JSON.stringify(facts.sources)}`);
  return lines.join('\n');
}
