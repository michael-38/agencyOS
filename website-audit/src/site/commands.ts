// v2 builder support: site:scaffold, site:validate, site:preview. Logic lives here so the skill's
// scripts/ are thin wrappers and share the deterministic check registry (check-html).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadHtml, extractJsonLd, hasType } from '../checks/html.js';
import { loadIndustries } from '../personas/load.js';
import type { Report } from '../report/schema.js';
import { runSelfTest } from './check-html.js';

// ---------------------------------------------------------------------------------------------
// scaffold
// ---------------------------------------------------------------------------------------------

const SECTION_ORDER = ['hero', 'services', 'trust', 'gallery', 'process', 'faq', 'contact'] as const;
type SectionId = (typeof SECTION_ORDER)[number];

function sectionFor(id: string, criterion: string): SectionId | 'head' {
  const s = `${id} ${criterion}`.toLowerCase();
  if (/jsonld|json-ld|structured|meta-title|schema|title|description/.test(s)) return 'head';
  if (/faq|question/.test(s)) return 'faq';
  if (/gallery|photo|before|after|project|portfolio|image/.test(s)) return 'gallery';
  if (/review|rating|trust|testimonial|credential|license|insur|years|award|proof/.test(s)) return 'trust';
  if (/hours|address|contact|form|book|schedule|quote|estimate|map|location|area|tel|phone|call|cta/.test(s)) return /hero|first screen|above|fold|scroll/.test(s) ? 'hero' : 'contact';
  if (/service|offer|what/.test(s)) return 'services';
  if (/process|how|step|plan|maintenance|season/.test(s)) return 'process';
  return 'services';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function siteScaffold(o: { slug: string; report: string; repo: string }): number {
  const report = JSON.parse(fs.readFileSync(o.report, 'utf8')) as Report;
  const industries = loadIndustries(o.repo);
  const industry = industries.industries.find((i) => i.slug === o.slug);
  if (!industry) {
    process.stderr.write(`unknown slug "${o.slug}"\n`);
    return 2;
  }
  const archetype = industries.archetypes.find((a) => a.id === industry.archetype)!;
  const siteDir = path.join(path.dirname(o.report), 'site');
  fs.mkdirSync(siteDir, { recursive: true });
  const gaps = report.items.filter((it) => it.verdict !== 'pass');
  const bySection = new Map<SectionId | 'head', typeof gaps>();
  for (const g of gaps) {
    const s = sectionFor(g.id, g.criterion);
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s)!.push(g);
  }
  const name = report.facts?.business_name ?? new URL(report.home_url).hostname;
  const phone = report.facts?.phones?.[0] ?? '';
  const telHref = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#contact';
  let copyId = 0;
  const copyMap: { copy_id: string; text_sha256: string; source: 'placeholder' | { url: string; quote: string } }[] = [];
  const placeholderP = (text: string, extraAttrs = '') => {
    copyId++;
    const id = `p${String(copyId).padStart(3, '0')}`;
    copyMap.push({ copy_id: id, text_sha256: '', source: 'placeholder' });
    return `<p data-copy-id="${id}" data-copy="placeholder"${extraAttrs}>${esc(text)}</p>`;
  };
  const stubs = (s: SectionId | 'head') =>
    (bySection.get(s) ?? []).map((g) => `      <!-- gap ${g.id} (${g.verdict}, ${g.weight}): ${esc(g.criterion)} -->`).join('\n');
  const tag = (s: SectionId | 'head') => (bySection.get(s) ?? []).map((g) => g.id).join(' ');
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': archetype.jsonld_type,
        name,
        url: report.home_url,
        ...(phone ? { telephone: phone } : {}),
        ...(report.facts?.address && typeof report.facts.address === 'object' ? { address: report.facts.address } : {}),
      },
      { '@type': 'FAQPage', mainEntity: [] },
    ],
  };
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(name)} — [service] in [service area]</title>
  <meta name="description" content="[50-170 chars: what ${esc(name)} does, for whom, where; one direct sentence.]">
  <!-- ${tag('head') ? `data-checklist targets in head: ${tag('head')}` : 'no head-level gaps'} -->
${stubs('head')}
  <script type="application/ld+json" data-checklist="${esc(tag('head'))}">${JSON.stringify(jsonld, null, 2)}</script>
  <style>
    :root { --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px; --space-5: 32px; --space-6: 48px; --space-7: 64px; --radius-md: 12px; --accent: #1f6f43; --ink: #111827; --muted: #6b7280; --bg: #ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.5; }
    .notice { position: sticky; top: 0; z-index: 10; background: #fef3c7; color: #78350f; padding: var(--space-3); font-size: 14px; border-bottom: 1px solid #f59e0b; }
    header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); }
    nav a { margin-right: var(--space-3); }
    .cta { display: inline-block; background: var(--accent); color: #fff; padding: var(--space-3) var(--space-5); border-radius: var(--radius-md); font-weight: 600; text-decoration: none; min-height: 48px; }
    .tel { font-weight: 800; font-variant-numeric: tabular-nums; }
    section { padding: var(--space-6) var(--space-4); max-width: 1200px; margin: 0 auto; }
    .placeholder-img { background: #e5e7eb; color: var(--muted); display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; border-radius: var(--radius-md); }
    .sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: #fff; border-top: 1px solid #e5e7eb; }
    .sticky-bar a { flex: 1; text-align: center; }
    @media (min-width: 900px) { .sticky-bar { display: none; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  </style>
</head>
<body>
  <div class="notice" role="status" aria-live="polite">Preview mockup: all text marked as placeholder is unverified and must be confirmed with the business before use.</div>
  <header>
    <a href="#top"><strong>${esc(name)}</strong></a>
    <nav aria-label="Sections">${SECTION_ORDER.map((s) => `<a href="#${s}">${s}</a>`).join('')}</nav>
    <a class="cta tel" href="${esc(telHref)}" data-checklist="tel-link tel-link-above-fold">${esc(phone || 'Call now')}</a>
  </header>
  <main id="top">
    <section id="hero" data-checklist="${esc(tag('hero'))}">
${stubs('hero')}
      <h1>[One sentence: what ${esc(name)} does, for whom, where]</h1>
      ${placeholderP('[Answer-first opener: the single most important thing this visitor wants to know.]')}
      <a class="cta" href="#contact">[Primary CTA]</a>
      <div class="placeholder-img" role="img" aria-label="Hero photo: [describe intended asset]">Hero photo: [describe intended asset]</div>
    </section>
    <section id="services" data-checklist="${esc(tag('services'))}">
${stubs('services')}
      <h2>[Services heading]</h2>
      ${placeholderP('[First sentence answers: what services are offered.]')}
    </section>
    <section id="trust" data-checklist="${esc(tag('trust'))}">
${stubs('trust')}
      <h2>[Why choose us heading]</h2>
      ${placeholderP('[Only facts from the source site; no invented reviews, numbers, or credentials.]')}
    </section>
    <section id="gallery" data-checklist="${esc(tag('gallery'))}">
${stubs('gallery')}
      <h2>[Projects heading]</h2>
      <div class="placeholder-img" role="img" aria-label="Project photo: [before/after description]">Project photo: [before/after description]</div>
    </section>
    <section id="process" data-checklist="${esc(tag('process'))}">
${stubs('process')}
      <h2>[How it works heading]</h2>
      ${placeholderP('[Step one in one sentence.]')}
    </section>
    <section id="faq" data-checklist="${esc(tag('faq'))}">
${stubs('faq')}
      <h2>Frequently asked questions</h2>
      <h3>[Question in question form?]</h3>
      ${placeholderP('[Short direct answer.]')}
    </section>
    <section id="contact" data-checklist="${esc(tag('contact'))}">
${stubs('contact')}
      <h2>[Contact heading]</h2>
      ${phone ? `<p data-copy-id="p-phone"><a class="tel" href="${esc(telHref)}">${esc(phone)}</a></p>` : placeholderP('[phone]')}
      <address>${esc(typeof report.facts?.address === 'string' ? report.facts.address : '[address or service area]')}</address>
      <form action="#" method="post" onsubmit="return false">
        <label>Name <input name="name" required></label>
        <label>Phone <input name="phone" type="tel" required></label>
        <label>What do you need? <textarea name="message"></textarea></label>
        <button class="cta" type="submit">[Request a quote]</button>
      </form>
    </section>
  </main>
  <footer>
    <p>${esc(name)}</p>
  </footer>
  <div class="sticky-bar" data-checklist="sticky-mobile-cta"><a class="cta tel" href="${esc(telHref)}">Call</a><a class="cta" href="#contact">Request a quote</a></div>
</body>
</html>
`;
  fs.writeFileSync(path.join(siteDir, 'index.html'), html);
  if (phone) copyMap.push({ copy_id: 'p-phone', text_sha256: '', source: { url: report.home_url, quote: phone } });
  const placeholders = copyMap.filter((c) => c.source === 'placeholder').length;
  fs.writeFileSync(path.join(siteDir, 'copy_map.json'), JSON.stringify({ paragraphs: copyMap, placeholder_ratio: copyMap.length ? placeholders / copyMap.length : 0 }, null, 2));
  process.stdout.write(`scaffold written: ${path.join(siteDir, 'index.html')} (${gaps.length} gap stub(s), ${copyMap.length} placeholder paragraph(s))\n`);
  return 0;
}

// ---------------------------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------------------------

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  placeholder: { placeholder: number; total: number };
  self_test: unknown;
}

const EXTERNAL_RE = /(?:src|href|action)\s*=\s*["'](https?:)?\/\//i;

export function validateSite(dir: string, repo: string, slug: string | null): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indexPath = path.join(dir, 'index.html');
  if (!fs.existsSync(indexPath)) return { ok: false, errors: ['index.html missing'], warnings, placeholder: { placeholder: 0, total: 0 }, self_test: null };
  const html = fs.readFileSync(indexPath, 'utf8');
  const $ = loadHtml(html);

  // Structural validity (offline, dependency-free).
  if (!/^\s*<!doctype html>/i.test(html)) errors.push('missing <!doctype html>');
  if ($('html').length !== 1) errors.push('expected exactly one <html>');
  if (!$('html').attr('lang')) errors.push('<html> has no lang attribute');
  if (!$('title').text().trim()) errors.push('<title> missing or empty');
  if (!$('meta[name="description"]').attr('content')) errors.push('meta description missing');
  if (!$('meta[name="viewport"]').length) errors.push('viewport meta missing');
  for (const lm of ['header', 'nav', 'main', 'footer']) if (!$(lm).length) errors.push(`landmark <${lm}> missing`);
  if ($('main section').length === 0) errors.push('no <section> inside <main>');
  if ($('h1').length !== 1) errors.push(`expected exactly one <h1>, found ${$('h1').length}`);
  $('main section').each((_, el) => {
    if (!$(el).find('h1, h2').length) warnings.push(`section#${$(el).attr('id') ?? '?'} has no <h2>`);
  });
  $('img').each((_, el) => {
    if (!($(el).attr('alt') || '').trim()) errors.push(`<img src="${$(el).attr('src')}"> has no alt text`);
  });

  // Zero external requests.
  $('script[src], link[href], img[src], iframe[src], source[src], video[src], audio[src], form[action]').each((_, el) => {
    const v = $(el).attr('src') || $(el).attr('href') || $(el).attr('action') || '';
    if (/^(https?:)?\/\//i.test(v)) errors.push(`external request: <${(el as unknown as { tagName: string }).tagName} ${v.slice(0, 80)}>`);
  });
  if (/@import\s+url\(\s*["']?(https?:)?\/\//i.test(html) || /url\(\s*["']?(https?:)?\/\//i.test($('style').text())) errors.push('external URL in CSS (@import or url())');
  if (/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/.test($('script').not('[type="application/ld+json"]').text())) errors.push('script uses fetch/XHR/beacon');
  if (/<link[^>]+rel=["']?stylesheet/i.test(html) && EXTERNAL_RE.test(html)) warnings.push('stylesheet link present; verify it is local');
  if (/fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg\.com|jsdelivr/i.test(html)) errors.push('CDN / web-font reference found');

  // JSON-LD: parses, includes archetype type + FAQPage.
  const ld = extractJsonLd($);
  if (ld.parseErrors) errors.push(`${ld.parseErrors} JSON-LD block(s) do not parse`);
  if (!ld.objects.length) errors.push('no JSON-LD objects');
  let archetypeType: string | null = null;
  if (slug) {
    const industries = loadIndustries(repo);
    const ind = industries.industries.find((i) => i.slug === slug);
    if (ind) archetypeType = industries.archetypes.find((a) => a.id === ind.archetype)?.jsonld_type ?? null;
  }
  if (archetypeType && !hasType(ld, [archetypeType])) errors.push(`JSON-LD lacks @type ${archetypeType}`);
  if (!hasType(ld, ['FAQPage'])) errors.push('JSON-LD lacks FAQPage');

  // copy_map.json: every data-copy-id mapped; placeholder notice iff placeholders exist.
  const copyMapPath = path.join(dir, 'copy_map.json');
  const copyIds = new Set<string>();
  $('[data-copy-id]').each((_, el) => { copyIds.add($(el).attr('data-copy-id')!); });
  const placeholders = $('[data-copy="placeholder"]').length;
  let mapped = new Set<string>();
  if (!fs.existsSync(copyMapPath)) {
    errors.push('copy_map.json missing');
  } else {
    try {
      const cm = JSON.parse(fs.readFileSync(copyMapPath, 'utf8')) as { paragraphs?: { copy_id: string }[] };
      mapped = new Set((cm.paragraphs ?? []).map((p) => p.copy_id));
    } catch (e) {
      errors.push(`copy_map.json invalid: ${(e as Error).message}`);
    }
  }
  for (const id of copyIds) if (!mapped.has(id)) errors.push(`paragraph ${id} is not mapped in copy_map.json`);
  let untagged = 0;
  $('main p, main li').each((_, el) => {
    if (!$(el).attr('data-copy-id') && $(el).text().trim()) untagged++;
  });
  if (untagged) errors.push(`${untagged} <p>/<li> text node(s) in <main> lack data-copy-id`);
  const notice = $('.notice, [data-placeholder-notice]').first();
  if (placeholders > 0 && !notice.length) errors.push('placeholder copy exists but no visible placeholder notice');
  if (placeholders === 0 && notice.length) warnings.push('placeholder notice present but no placeholder copy');
  if (notice.length && (notice.find('button').length || /dismiss|close/i.test(notice.attr('class') || ''))) errors.push('placeholder notice must not be dismissible');

  // Gap coverage + self-test via the shared registry.
  let self_test: unknown = null;
  const reportPath = path.join(path.dirname(dir), 'report.json');
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Report;
    const tagged = new Set<string>();
    $('[data-checklist]').each((_, el) => {
      for (const id of ($(el).attr('data-checklist') || '').split(/[\s,]+/)) if (id) tagged.add(id);
    });
    for (const it of report.items.filter((i) => i.verdict !== 'pass')) if (!tagged.has(it.id)) errors.push(`gap ${it.id} (${it.verdict}) has no data-checklist element`);
    const effectiveSlug = slug ?? report.industry.slug;
    try {
      self_test = runSelfTest({ file: indexPath, slug: effectiveSlug, repo, out: null });
      fs.writeFileSync(path.join(dir, 'self-test.json'), JSON.stringify(self_test, null, 2));
    } catch (e) {
      warnings.push(`self-test failed: ${(e as Error).message}`);
    }
  } else {
    warnings.push('no report.json beside the site dir; gap coverage not checked');
  }
  return { ok: errors.length === 0, errors, warnings, placeholder: { placeholder: placeholders, total: copyIds.size }, self_test };
}

export function siteValidate(o: { dir: string; repo: string; slug?: string | null }): number {
  const res = validateSite(o.dir, o.repo, o.slug ?? null);
  for (const w of res.warnings) process.stdout.write(`warning: ${w}\n`);
  for (const e of res.errors) process.stdout.write(`error: ${e}\n`);
  process.stdout.write(`${res.ok ? 'OK' : 'FAILED'} — placeholder copy ${res.placeholder.placeholder}/${res.placeholder.total}\n`);
  return res.ok ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------------------------

export function sitePreview(o: { dir: string }): number {
  const file = path.join(o.dir, 'index.html');
  if (!fs.existsSync(file)) {
    process.stderr.write(`${file} not found\n`);
    return 2;
  }
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const r = spawnSync(cmd, [file], { stdio: 'ignore', shell: process.platform === 'win32' });
  process.stdout.write(`opened ${file}\n`);
  return r.status ?? 0;
}
