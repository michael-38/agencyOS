// check-html: run v1's deterministic checks against a local HTML file (the v2 self-test).
// Layout checks use static rules (no browser); anything untestable is reported as not-testable-offline.
import fs from 'node:fs';
import path from 'node:path';
import { VIEWPORTS } from '../config.js';
import { loadHtml } from '../checks/html.js';
import { REGISTERED_CHECK_IDS, REGISTRY, STATIC_LAYOUT_RULES, runCheck, type CheckResult, type PageContext } from '../checks/registry.js';
import { loadChecklist, loadDetectors, loadIndustries } from '../personas/load.js';

export interface CheckHtmlOptions {
  file: string;
  slug: string;
  repo: string;
  out: string | null;
}

export interface SelfTestItem {
  id: string;
  source: 'persona' | 'common';
  scope: string;
  weight: string;
  verdict: 'pass' | 'partial' | 'fail' | 'not-testable-offline';
  method: string;
  summary: string;
  has_data_checklist: boolean;
}

export interface SelfTestResult {
  file: string;
  slug: string;
  items: SelfTestItem[];
  data_checklist_ids: string[];
  judgment_items_present: string[];
  summary: { pass: number; partial: number; fail: number; not_testable: number };
}

/** How far above the page to look for a root-absolute stylesheet before giving up. */
const CSS_LOOKUP_MAX_DEPTH = 6;

/**
 * Read the local stylesheets the page links to, so layout rules can see the real CSS. A relative
 * href resolves against the page; a root-absolute one is resolved by walking up from the page until
 * it is found, because the site root is not knowable from a file path alone.
 */
export function readLinkedCss($: ReturnType<typeof loadHtml>, file: string): string {
  const parts: string[] = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').split('?')[0];
    if (!href || /^(https?:)?\/\//i.test(href) || href.startsWith('data:')) return;
    const candidates: string[] = [];
    if (href.startsWith('/')) {
      let dir = path.dirname(path.resolve(file));
      for (let i = 0; i <= CSS_LOOKUP_MAX_DEPTH; i++) {
        candidates.push(path.join(dir, href.slice(1)));
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } else {
      candidates.push(path.resolve(path.dirname(file), href));
    }
    const found = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (found) parts.push(fs.readFileSync(found, 'utf8'));
  });
  return parts.join('\n');
}

export function runSelfTest(o: CheckHtmlOptions): SelfTestResult {
  const industries = loadIndustries(o.repo);
  const industry = industries.industries.find((i) => i.slug === o.slug);
  if (!industry) throw new Error(`unknown slug "${o.slug}"`);
  const archetype = industries.archetypes.find((a) => a.id === industry.archetype)!;
  const detectors = loadDetectors(o.repo, industry);
  const checklist = loadChecklist(o.repo, industries, o.slug, { includePersona: true, includeCommon: true, registeredCheckIds: REGISTERED_CHECK_IDS });
  const rawHtml = fs.readFileSync(o.file, 'utf8');
  const $ = loadHtml(rawHtml);
  const localCss = readLinkedCss($, o.file);
  const dataIds = new Set<string>();
  $('[data-checklist]').each((_, el) => {
    for (const id of ($(el).attr('data-checklist') || '').split(/[\s,]+/)) if (id) dataIds.add(id);
  });
  const ctx: PageContext = {
    url: `file://${o.file}`,
    rawHtml,
    markdown: $('body').text(),
    links: [],
    probe: null,
    viewport: { ...VIEWPORTS.mobile },
    detectors,
    jsonldType: archetype.jsonld_type,
    localCss,
  };
  const items: SelfTestItem[] = [];
  for (const it of checklist.items) {
    if (it.check !== 'deterministic') continue;
    const def = REGISTRY.get(it.id)!;
    let r: CheckResult | null;
    let method = 'deterministic';
    if (def.needsProbe) {
      const rule = STATIC_LAYOUT_RULES[it.id];
      r = rule ? rule(ctx) : null;
      method = 'static-rule';
    } else {
      r = runCheck(it.id, ctx);
    }
    items.push({
      id: it.id,
      source: it.source,
      scope: it.scope,
      weight: it.weight,
      verdict: r ? r.verdict : 'not-testable-offline',
      method: r ? method : 'none',
      summary: r ? r.evidence.summary : 'layout-dependent check with no static rule',
      has_data_checklist: dataIds.has(it.id),
    });
  }
  const judgmentPresent = checklist.items.filter((it) => it.check === 'judgment' && dataIds.has(it.id)).map((it) => it.id);
  return {
    file: o.file,
    slug: o.slug,
    items,
    data_checklist_ids: [...dataIds].sort(),
    judgment_items_present: judgmentPresent,
    summary: {
      pass: items.filter((i) => i.verdict === 'pass').length,
      partial: items.filter((i) => i.verdict === 'partial').length,
      fail: items.filter((i) => i.verdict === 'fail').length,
      not_testable: items.filter((i) => i.verdict === 'not-testable-offline').length,
    },
  };
}

export function checkHtmlCommand(o: CheckHtmlOptions): number {
  const res = runSelfTest(o);
  const out = o.out ?? path.join(path.dirname(o.file), 'self-test.json');
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  for (const it of res.items) {
    process.stdout.write(`${it.verdict.padEnd(20)} ${it.id.padEnd(24)} ${it.has_data_checklist ? '[tagged] ' : '         '}${it.summary}\n`);
  }
  process.stdout.write(`\n${res.summary.pass} pass, ${res.summary.partial} partial, ${res.summary.fail} fail, ${res.summary.not_testable} not testable offline → ${out}\n`);
  return res.summary.fail > 0 ? 1 : 0;
}
