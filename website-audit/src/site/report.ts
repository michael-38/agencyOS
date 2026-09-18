// seo-report.md: everything the pipeline knows but could not fix, written for a human to act on.
//
// The most important section is the last one. A one-page rebuild from a template closes most of a
// persona checklist but not all of it, and the honest number belongs in front of whoever hands the
// page to the client rather than buried in validate.json.
import fs from 'node:fs';
import type { TemplateManifest } from './template.js';
import type { ContentPack } from './content.js';
import type { SiteValidation } from './validate.js';
import type { AssetManifest, BuildProfile, CopyMap } from './types.js';

export interface ReportChecklistItem {
  id: string;
  criterion: string;
  verdict: string;
  weight: string;
  scope: string;
}

export interface SeoReportOptions {
  file: string;
  profile: BuildProfile;
  baseUrl: string;
  slug: string;
  manifest: TemplateManifest;
  pack: ContentPack;
  assets: AssetManifest;
  copyMap: CopyMap;
  validation: SiteValidation | null;
  /** The audit's non-pass items, so the report can explain each one's fate. */
  checklist: ReportChecklistItem[];
  notes: string[];
  usd: number;
  /** What `site:shot` wrote, if it has run for this build. */
  shots?: string[];
}

/** Why a template cannot carry a criterion, stated in terms the client can act on. */
function whyUncoverable(item: ReportChecklistItem): string {
  if (item.scope === 'subpath') return 'needs a page of its own, which a one-page rebuild does not create';
  return 'needs a third-party widget or content only the business can supply';
}

export function renderSeoReport(o: SeoReportOptions): string {
  const errors = o.validation?.findings.filter((f) => f.level === 'error') ?? [];
  const warnings = o.validation?.findings.filter((f) => f.level === 'warning') ?? [];
  const unsourced = o.copyMap.paragraphs.filter((p) => p.source === 'placeholder').length;
  const templated = o.copyMap.paragraphs.filter((p) => p.source === 'template').length;
  const total = o.copyMap.paragraphs.length;
  const pct = total ? Math.round((unsourced / total) * 100) : 0;
  const byId = new Map(o.checklist.map((i) => [i.id, i]));

  const covered = o.validation?.coverage.tagged ?? [];
  const uncoverable = o.validation?.coverage.uncoverable ?? [];
  const closed = o.checklist.filter((i) => covered.includes(i.id)).length;
  const closedPct = o.checklist.length ? Math.round((closed / o.checklist.length) * 100) : 100;

  const out: string[] = [];
  out.push(`# ${o.pack.business_name} — rebuilt home page`, '');
  out.push(
    `- Industry: \`${o.slug}\``,
    `- Template: \`${o.manifest.file}\` (sha256 \`${o.manifest.sha256.slice(0, 16)}\`)`,
    `- Profile: \`${o.profile}\` (base URL \`${o.baseUrl}\`)`,
    `- Audit gaps closed: ${closed} of ${o.checklist.length} (${closedPct}%)`,
    `- Unverified copy: ${unsourced} of ${total} blocks (${pct}%)${templated ? `, plus ${templated} from the template` : ''}`,
    `- Images reused from the source site: ${o.assets.downloaded} of ${o.assets.harvested} found`,
    `- Anthropic spend: $${o.usd.toFixed(4)}`,
    `- Validation: ${o.validation ? (o.validation.ok ? 'passed' : `${errors.length} error(s)`) : 'not run'}`,
    '',
  );

  if (o.shots?.length) {
    out.push('## Screenshots', '');
    for (const f of o.shots) out.push(`- \`${f}\``);
    out.push('');
  }

  out.push('## What was optimised', '');
  out.push(
    '- One `<h1>`, a descriptive `<h2>` per section, and a heading outline with no skipped levels.',
    '- An answer-first opening sentence per section, marked `data-answer-first` and named in the page\'s `speakable` specification.',
    '- A JSON-LD `@graph`: `WebSite`, `WebPage`, the industry archetype node, and `FAQPage` built from the questions actually rendered on the page, so the two cannot disagree.',
    '- Title and meta description inside the length bounds search results render.',
    '- Every image carries `alt` and intrinsic `width`/`height`; the LCP image is preloaded and the rest are lazy.',
    o.profile === 'production'
      ? '- `sitemap.xml`, `robots.txt` (naming the AI crawlers explicitly), `llms.txt`, an `index.md` mirror, and Cloudflare Pages `_headers`.'
      : '- Canonical, Open Graph, `sitemap.xml`, `robots.txt` and `llms.txt` are omitted in the mockup profile because they are meaningless without a host. Re-run with `--profile production --base-url …` to emit them.',
    '',
  );

  const needsCheck = o.assets.assets.filter((a) => a.verify_license || a.likely_stock);
  if (needsCheck.length) {
    out.push('## Images to check before publishing', '');
    for (const a of needsCheck) {
      const why = [a.verify_license ? 'hosted off the audited domain' : null, a.likely_stock ? 'filename looks like a stock-library download' : null]
        .filter(Boolean)
        .join('; ');
      out.push(`- \`${a.file}\` — ${why}. Source: ${a.source_url}`);
    }
    out.push(
      '',
      'Reuse is not the same as a licence to republish. Stock photography in particular is what the audit penalises the original site for, so it is worth asking the client for photographs of their own work.',
      '',
    );
  }

  if (errors.length) {
    out.push(
      '## Unresolved validation errors',
      '',
      'Fix these before the page is shown to anyone. A structure, SEO or AEO error is usually a template bug: fix the template and re-run `--stage fill`, which is free. A fabrication or residue error is usually a content problem: re-run `--stage content`.',
      '',
    );
    for (const f of errors) out.push(`- [${f.gate}] ${f.message}`);
    out.push('');
  }
  if (warnings.length) {
    out.push('## Warnings', '');
    for (const f of warnings) out.push(`- [${f.gate}] ${f.message}`);
    out.push('');
  }
  if (o.validation?.coverage.missing.length) {
    out.push(
      '## Audit gaps the template should have closed, and did not',
      '',
      'The template carries an element for each of these, but the built page does not — the fill removed the section that was meant to satisfy it, usually because the source gave it nothing.',
      '',
    );
    for (const id of o.validation.coverage.missing) {
      const item = byId.get(id);
      out.push(`- \`${id}\`${item ? ` — ${item.criterion}` : ''}`);
    }
    out.push('');
  }

  // The honest accounting. Read this to the client rather than claiming a clean sweep.
  out.push('## What this page does not close', '');
  if (!uncoverable.length) {
    out.push(`Every one of the audit's ${o.checklist.length} open items is addressed on this page.`, '');
  } else {
    out.push(
      `${uncoverable.length} of the audit's ${o.checklist.length} open items are outside what a single templated page can carry. Say so at handoff; do not let the rebuild imply a clean sweep.`,
      '',
      '| criterion | weight | why not | what would close it |',
      '|---|---|---|---|',
    );
    for (const id of uncoverable) {
      const item = byId.get(id);
      const fix =
        item?.scope === 'subpath'
          ? 'a dedicated page, which is a separate piece of work'
          : 'a third-party integration, or photography, video or copy from the client';
      out.push(`| \`${id}\`${item ? ` ${item.criterion}` : ''} | ${item?.weight ?? '?'} | ${item ? whyUncoverable(item) : 'the template carries no element for it'} | ${fix} |`);
    }
    out.push('');
  }

  if (o.manifest.slots.length) {
    const omitted = o.pack.omit_sections;
    if (omitted.length) {
      out.push(
        '## Sections removed for lack of source material',
        '',
        'The source site said nothing about these, so the page omits them rather than filling them with placeholders. Each one is a specific thing to ask the client for.',
        '',
      );
      for (const s of omitted) out.push(`- \`${s}\``);
      out.push('');
    }
  }

  if (o.notes.length) {
    out.push('## Notes from the build', '');
    for (const n of o.notes) out.push(`- ${n}`);
    out.push('');
  }

  out.push(
    '## What this is not',
    '',
    'Every sentence marked placeholder is unverified and must be confirmed with the business before publication. No review, rating, credential, price or statistic appears on this page unless the source site already stated it — where the source was silent, the page says less rather than guessing.',
    '',
    `The design is this industry's template, not a bespoke one. ${
      o.notes.some((n) => n.startsWith('brand: accent'))
        ? 'Its accent was taken from the client\'s own logo and checked for contrast in both colour schemes.'
        : 'Its accent is the template\'s own; pass `--brand <hex>` and re-run `--stage fill` to match the client\'s.'
    }`,
    '',
  );
  return out.join('\n');
}

export function writeSeoReport(o: SeoReportOptions): void {
  fs.writeFileSync(o.file, renderSeoReport(o));
}
