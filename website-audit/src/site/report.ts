// seo-report.md — the honest account of what the build did, what it optimised, and what it could not
// verify. It exists so the operator never has to read validate.json to find out what is still wrong.
import fs from 'node:fs';
import type { AssetManifest, BuildProfile, CopyMap, SitePlan } from './types.js';
import type { SiteValidation } from './validate.js';

export interface SeoReportOptions {
  file: string;
  plan: SitePlan;
  profile: BuildProfile;
  baseUrl: string;
  slug: string;
  assets: AssetManifest;
  copyMap: CopyMap;
  validation: SiteValidation | null;
  notes: string[];
  usd: number;
  /** True when only the home page was built (`--preview`). */
  preview: boolean;
  /** What `site:shot` wrote, if it has run for this build. */
  shots?: string[];
}

export function renderSeoReport(o: SeoReportOptions): string {
  const errors = o.validation?.findings.filter((f) => f.level === 'error') ?? [];
  const warnings = o.validation?.findings.filter((f) => f.level === 'warning') ?? [];
  const placeholders = o.copyMap.paragraphs.filter((p) => p.source === 'placeholder').length;
  const total = o.copyMap.paragraphs.length;
  const pct = total ? Math.round((placeholders / total) * 100) : 0;

  const deferred = o.plan.deferred_pages ?? [];

  const out: string[] = [];
  out.push(`# ${o.plan.business_name} — generated ${o.preview ? 'home-page preview' : 'site'}`, '');
  out.push(
    `- Industry: \`${o.slug}\``,
    `- Profile: \`${o.profile}\` (base URL \`${o.baseUrl}\`)`,
    `- Pages: ${o.plan.pages.length}${deferred.length ? ` built, ${deferred.length} planned and deferred` : ''}`,
    `- Placeholder copy: ${placeholders} of ${total} blocks (${pct}%)`,
    `- Images reused from the source site: ${o.assets.downloaded} of ${o.assets.harvested} found`,
    `- Anthropic spend: $${o.usd.toFixed(4)}`,
    `- Validation: ${o.validation ? (o.validation.ok ? 'passed' : `${errors.length} error(s)`) : 'not run'}`,
    '',
  );

  out.push('## Pages', '');
  out.push('| path | kind | title | meta description | sections | FAQ |', '|---|---|---|---|---|---|');
  for (const p of o.plan.pages) {
    out.push(`| \`${p.path}\` | ${p.kind} | ${p.title.length} ch | ${p.meta_description.length} ch | ${p.sections.length} | ${p.faq.length} |`);
  }
  out.push('');

  if (o.preview) {
    out.push(
      '## This is a preview',
      '',
      'Only the home page was written. It is real HTML built from the business\'s own words under the same fabrication gate as a full build — not a mockup image — so nothing here has to be redone if the prospect says yes.',
      '',
    );
    if (deferred.length) {
      out.push('The architecture planned these pages and this build deferred them. They appear in the navigation, pointing at the home page:', '');
      for (const d of deferred) out.push(`- \`${d.path}\` — ${d.title}${d.checklist_ids.length ? ` (would satisfy: ${d.checklist_ids.join(', ')})` : ''}`);
      out.push('');
    }
    out.push(
      'Re-run the same command without `--preview` and with `--stage plan` to finish the site. The architecture and design calls are already cached in this run, so only the remaining pages are billed.',
      '',
    );
  }

  if (o.shots?.length) {
    out.push('## Screenshots', '');
    for (const f of o.shots) out.push(`- \`${f}\``);
    out.push('');
  }

  out.push('## What was optimised', '');
  out.push(
    '- One `<h1>` per page, a descriptive `<h2>` per section, and a heading outline with no skipped levels.',
    '- An answer-first opening sentence per section, marked `data-answer-first` and named in the page\'s `speakable` specification.',
    '- A JSON-LD `@graph` per page: `WebSite`, `WebPage`, the industry archetype node, `BreadcrumbList` below the home page, and `FAQPage` mirroring the rendered questions exactly.',
    '- Unique title and meta description per page, within the length bounds search results actually render.',
    '- Every image carries `alt`, intrinsic `width`/`height`, and lazy loading except the LCP image, which is preloaded.',
    o.profile === 'production'
      ? '- `sitemap.xml`, `robots.txt` (naming the AI crawlers explicitly), `llms.txt` with per-page markdown mirrors, `llms-full.txt`, and Cloudflare Pages `_headers`.'
      : '- Canonical, Open Graph, `sitemap.xml`, `robots.txt`, and `llms.txt` are omitted in the mockup profile because they are meaningless without a host. Re-run with `--profile production --base-url …` to emit them.',
    '',
  );

  const needsCheck = o.assets.assets.filter((a) => a.verify_license || a.likely_stock);
  if (needsCheck.length) {
    out.push('## Images to check before publishing', '');
    for (const a of needsCheck) {
      const why = [a.verify_license ? 'hosted off the audited domain' : null, a.likely_stock ? 'filename looks like a stock-library download' : null].filter(Boolean).join('; ');
      out.push(`- \`${a.file}\` — ${why}. Source: ${a.source_url}`);
    }
    out.push(
      '',
      'These were reused because they are on the business\'s current site, but reuse is not the same as a licence to republish. Stock photography in particular is what the audit penalises the original site for, so it is worth asking the client for real photographs of their own work.',
      '',
    );
  }

  if (errors.length) {
    out.push('## Unresolved validation errors', '', 'These survived the repair budget and must be fixed by hand before this site is shown to anyone.', '');
    for (const f of errors) out.push(`- \`${f.page}\` [${f.gate}] ${f.message}`);
    out.push('');
  }
  if (warnings.length) {
    out.push('## Warnings', '');
    for (const f of warnings) out.push(`- \`${f.page}\` [${f.gate}] ${f.message}`);
    out.push('');
  }
  if (o.validation?.coverage.missing.length) {
    out.push('## Audit gaps with no home on the page', '');
    for (const id of o.validation.coverage.missing) out.push(`- \`${id}\``);
    out.push('');
  }
  if (o.validation?.coverage.deferred?.length) {
    out.push('## Audit gaps this preview defers', '', 'These are planned for pages the preview did not build. The full build has to satisfy them.', '');
    for (const id of o.validation.coverage.deferred) out.push(`- \`${id}\``);
    out.push('');
  }
  if (o.notes.length) {
    out.push('## Notes from the build', '');
    for (const n of o.notes) out.push(`- ${n}`);
    out.push('');
  }

  out.push(
    '## What this is not',
    '',
    'Every sentence marked placeholder is unverified and must be confirmed with the business before publication. No review, rating, credential, price, or statistic appears on these pages unless the source site already stated it — where the source was silent, the page says less rather than guessing.',
    '',
  );
  return out.join('\n');
}

export function writeSeoReport(o: SeoReportOptions): void {
  fs.writeFileSync(o.file, renderSeoReport(o));
}
