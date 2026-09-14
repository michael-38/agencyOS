// Judge-input filtering: strip legal boilerplate from page markdown before the vision judge sees it.
// Raw markdown on disk is never modified; the filtered text is persisted alongside as judge.md.

const LEGAL_HEADING = /\b(privacy|terms|legal|cookie|cookies|disclaimer|gdpr|ccpa|copyright)\b/i;
const COOKIE_LINE =
  /(we use cookies|this (web)?site uses cookies|uses cookies to|accept all( cookies)?|reject all|cookie settings|manage (cookie )?preferences|cookie consent|cookie policy|by (continuing|clicking).*cookies)/i;
const FOOTER_LEGAL =
  /((©|\(c\)|copyright)\s*\d{4}|all rights reserved|privacy policy\s*[|·•\-–]\s*terms|terms\s*(of|&|and)\s*(service|use|conditions)|site (by|design by)|powered by)/i;
const LEGAL_KEYWORDS = [
  'privacy policy',
  'terms of service',
  'terms and conditions',
  'terms of use',
  'personal data',
  'personal information',
  'liability',
  'governing law',
  'arbitration',
  'third-party cookies',
  'third party cookies',
  'data controller',
  'gdpr',
  'ccpa',
  'opt-out',
  'indemnif',
  'warranties',
  'disclaim',
];

export interface FilterResult {
  text: string;
  removedChars: number;
  truncated: boolean;
  removedBlocks: number;
}

function headingLevel(line: string): number | null {
  const m = /^(#{1,6})\s+\S/.exec(line);
  return m ? m[1].length : null;
}

/** Strip legal boilerplate then cap length. */
export function filterForJudge(markdown: string, maxChars: number): FilterResult {
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];
  let skipUntilLevel: number | null = null;
  let removedBlocks = 0;

  // Pass 1: drop whole legal sections (heading + content until a heading of same/higher level).
  for (const line of lines) {
    const lvl = headingLevel(line);
    if (lvl !== null) {
      if (skipUntilLevel !== null && lvl <= skipUntilLevel) skipUntilLevel = null;
      if (skipUntilLevel === null && LEGAL_HEADING.test(line.replace(/^#+\s*/, ''))) {
        skipUntilLevel = lvl;
        removedBlocks++;
        continue;
      }
    }
    if (skipUntilLevel !== null) continue;
    kept.push(line);
  }

  // Pass 2: drop cookie-consent blocks, footer legal lines, and legal-keyword-dense paragraphs.
  const blocks = kept.join('\n').split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    if (b.length < 600 && COOKIE_LINE.test(b)) {
      removedBlocks++;
      continue;
    }
    if (b.length < 400 && FOOTER_LEGAL.test(b)) {
      removedBlocks++;
      continue;
    }
    const lower = b.toLowerCase();
    const hits = LEGAL_KEYWORDS.filter((k) => lower.includes(k)).length;
    if (hits >= 2) {
      removedBlocks++;
      continue;
    }
    out.push(b);
  }

  let text = out.join('\n\n');
  const removedChars = markdown.length - text.length;
  let truncated = false;
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n\n[… truncated at ${maxChars} characters …]`;
    truncated = true;
  }
  return { text, removedChars: Math.max(0, removedChars), truncated, removedBlocks };
}
