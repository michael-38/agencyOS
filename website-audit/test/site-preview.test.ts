// --preview: the half-build that goes out to a prospect before the full site is paid for.
//
// The contract these tests hold: the architecture is planned in full and only the home page is
// written; the deferred pages survive in the plan so the nav and the acceptance build can see them;
// audit gaps belonging to a page that was not built do not fail the preview or feed the repair loop;
// and finishing the site later re-uses the architecture rather than buying it twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { estimateCost, runBuild, type BuildOptions } from '../src/site/build.js';
import { navEntries } from '../src/site/render.js';
import type { LlmParser, ParseRequest, ParseResult } from '../src/llm/client.js';
import { canonicalJson } from '../src/cache.js';
import { REPO_ROOT, tmpDir } from './helpers.js';
import { CORPUS_TEXT, fixtureArchitecture, fixtureContent, fixturePlan, fixtureReport, homeMarkup, item, previewHomeMarkup, serviceMarkup } from './site-helpers.js';
import type { DesignSpec, PageContent, RenderedPage, SiteArchitecture } from '../src/site/types.js';

const DESIGN: DesignSpec = {
  css: ':root{--ink:#111}\n.actionbar{position:fixed;bottom:0}\n@media (prefers-reduced-motion: reduce){*{animation:none}}',
  design_md: '# Contract\n\n`.wrap` — the container. `.btn` — the button.',
  theme_color: '#123456',
  direction: 'test direction',
};

class ReplayClient implements LlmParser {
  usd = 0;
  readonly calls: string[] = [];
  /** The cache-relevant shape of each request, keyed by `step/label`. See `cacheIdentity`. */
  readonly requests = new Map<string, string>();
  constructor(private readonly responses: Record<string, unknown>) {}
  async parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>> {
    const key = `${req.step}/${req.label}`;
    this.calls.push(key);
    this.requests.set(key, cacheIdentity(req));
    const base = `${req.step}/${req.label.replace(/-repair\d+$/, '')}`;
    const parsed = (this.responses[key] ?? this.responses[base]) as T | undefined;
    if (parsed === undefined) throw new Error(`replay: nothing recorded for "${key}"`);
    return { parsed, usage: null, stopReason: 'end_turn', model: 'replay', cacheHit: true, attempts: 1, logFile: null, usd: 0 };
  }
}

/**
 * Everything LlmClient puts in the run-cache key, minus the label (which the key omits). Two calls
 * with the same identity are one billed call; this is what lets the acceptance build re-run the plan
 * and design stages for free after a preview.
 */
function cacheIdentity(req: ParseRequest<unknown>): string {
  return canonicalJson({
    step: req.step,
    model: req.model,
    system: req.system,
    content: req.content.map((c) => (c.type === 'text' ? { type: 'text', text: c.text } : c)),
    maxTokens: req.maxTokens,
    thinking: req.thinking ?? null,
    fallbacks: !!req.fallbacks,
  });
}

function seedRun(items = [item('tel-link'), item('faq-present')]): string {
  const dir = tmpDir('siteredesign-preview-');
  const report = fixtureReport(items);
  report.pages = [
    {
      url: 'https://example.test/',
      role: 'home',
      page_key: 'aaa',
      markdown_path: 'raw/pages/aaa/page.md',
      html_path: null,
      judge_text_path: null,
      judge_text_stats: null,
      screenshots: { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] },
      status_code: 200,
    },
  ];
  fs.mkdirSync(path.join(dir, 'raw', 'pages', 'aaa'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw', 'pages', 'aaa', 'page.md'), CORPUS_TEXT);
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  return dir;
}

function options(dir: string, llm: LlmParser, over: Partial<BuildOptions> = {}): BuildOptions {
  return {
    reportPath: path.join(dir, 'report.json'),
    repo: REPO_ROOT,
    profile: 'mockup',
    baseUrl: null,
    slug: 'landscaping',
    maxPages: 4,
    preview: true,
    maxAssets: 0,
    useAssets: false,
    startStage: 'assets',
    repairPasses: 2,
    maxUsd: 6,
    fromCache: null,
    offline: false,
    models: { plan: 'replay', design: 'replay', render: 'replay' },
    verbose: false,
    dryRun: false,
    llm,
    ...over,
  };
}

function responses(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'site-arch/architecture': fixtureArchitecture() satisfies SiteArchitecture,
    'site-copy/home': fixtureContent(
      'overview',
      'Example Yard Co has kept gardens tidy in Riverton since 2009.',
      'Example Yard Co has kept gardens tidy in Riverton since 2009.',
      [{ text: 'Our crews work across Riverton and Draper.', quote: 'Our crews work across Riverton and Draper.' }],
      [{ q: 'When can I reach you?', a: 'We answer the phone seven days a week.', quote: 'We answer the phone seven days a week.' }],
    ) satisfies PageContent,
    'site-copy/services_mowing': fixtureContent('mowing', 'Weekly mowing starts at $45 per visit.', 'Weekly mowing starts at $45 per visit.') satisfies PageContent,
    'site-design/design': DESIGN,
    'site-render/home': previewHomeMarkup() satisfies RenderedPage,
    'site-render/services_mowing': serviceMarkup() satisfies RenderedPage,
    ...over,
  };
}

test('a preview writes the home page only, and pays for one copy call and one render', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(responses());
  const res = await runBuild(options(dir, llm));

  assert.equal(res.validation?.ok, true, `unexpected errors: ${JSON.stringify(res.validation?.findings.filter((f) => f.level === 'error'), null, 2)}`);
  assert.deepEqual(res.pagesWritten, ['index.html']);
  assert.deepEqual(llm.calls, ['site-arch/architecture', 'site-copy/home', 'site-design/design', 'site-render/home']);
  assert.ok(!fs.existsSync(path.join(res.siteDir, 'services', 'mowing', 'index.html')));
});

test('the architecture is still planned in full, so the deferred page survives in the plan', async () => {
  const dir = seedRun();
  const res = await runBuild(options(dir, new ReplayClient(responses())));
  const plan = JSON.parse(fs.readFileSync(path.join(res.siteDir, 'plan.json'), 'utf8'));

  assert.deepEqual(plan.pages.map((p: { path: string }) => p.path), ['/']);
  assert.deepEqual(plan.deferred_pages.map((d: { path: string }) => d.path), ['/services/mowing/']);
  assert.equal(plan.deferred_pages[0].label, 'Weekly mowing');
  assert.equal(plan.internal_links.length, 0, 'a link to a page that was not written is not a link');
});

test('the deferred page is named in the navigation, pointing at the home page rather than a 404', () => {
  const plan = fixturePlan({
    pages: [fixturePlan().pages[0]],
    deferred_pages: [{ path: '/services/mowing/', label: 'Weekly mowing', title: 'Weekly mowing in Riverton', checklist_ids: [] }],
  });
  const nav = navEntries(plan.pages[0], plan.pages, plan.deferred_pages, 'mockup');

  assert.deepEqual(nav.map((n) => n.label), ['Home', 'Weekly mowing']);
  assert.equal(nav[1].href, 'index.html', 'a deferred page must not be linked to a file that does not exist');
  assert.equal(nav[1].current, false);
});

test('the preview it produces has no dead local links', async () => {
  const dir = seedRun();
  const res = await runBuild(options(dir, new ReplayClient(responses())));
  const html = fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8');
  const bad: string[] = [];
  for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    const t = m[1].split('#')[0];
    if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) continue;
    if (!fs.existsSync(path.resolve(res.siteDir, t))) bad.push(t);
  }
  assert.deepEqual(bad, []);
});

test('an audit gap that belongs to a deferred page is reported, not failed, and never reaches the repair loop', async () => {
  // 'review-markup' is assigned to the service page by the architecture, so the home page has no way
  // to satisfy it. Failing the preview for that would be wrong, and re-rendering the home page twice
  // to chase it would be wrong and expensive.
  const dir = seedRun([item('tel-link'), item('faq-present'), item('review-markup')]);
  const arch = fixtureArchitecture();
  arch.pages[1].sections[0].checklist_ids = ['review-markup'];
  const llm = new ReplayClient(responses({ 'site-arch/architecture': arch }));
  const res = await runBuild(options(dir, llm));

  assert.equal(res.validation?.ok, true, `preview should pass: ${JSON.stringify(res.validation?.findings.filter((f) => f.level === 'error'))}`);
  assert.deepEqual(res.validation?.coverage.deferred, ['review-markup']);
  assert.ok(res.validation?.findings.some((f) => f.level === 'warning' && f.message.includes('this preview did not build')));
  assert.equal(llm.calls.filter((c) => c.startsWith('site-render')).length, 1, 'no repair pass should have fired');
  assert.ok(fs.readFileSync(path.join(res.siteDir, 'seo-report.md'), 'utf8').includes('Audit gaps this preview defers'));
});

test('the same run finishes into a full site without re-planning or re-designing it', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(responses());
  await runBuild(options(dir, llm));
  const afterPreview = llm.calls.length;

  // Acceptance: same run directory, no --preview, resume at the plan stage. Every call the preview
  // already made is byte-identical here, which is what makes the run cache pay for it once.
  const second = new ReplayClient({ ...responses(), 'site-render/home': homeMarkup() });
  const res = await runBuild(options(dir, second, { preview: false, startStage: 'plan' }));

  assert.equal(res.validation?.ok, true, `unexpected errors: ${JSON.stringify(res.validation?.findings.filter((f) => f.level === 'error'), null, 2)}`);
  assert.deepEqual(res.pagesWritten.sort(), ['index.html', 'services/mowing/index.html']);
  assert.equal(afterPreview, 4);
  const plan = JSON.parse(fs.readFileSync(path.join(res.siteDir, 'plan.json'), 'utf8'));
  assert.deepEqual(plan.deferred_pages, [], 'nothing is owed once the site is finished');

  // The saving is only real if these requests are byte-identical, because that is all the run cache
  // matches on. Architecture and design are the two most expensive calls in a build; buying them
  // twice would wipe out most of what the preview saved.
  for (const key of ['site-arch/architecture', 'site-copy/home']) {
    assert.equal(second.requests.get(key), llm.requests.get(key), `${key} must hit the run cache on the acceptance build`);
  }
  assert.equal(second.requests.get('site-design/design'), llm.requests.get('site-design/design'));
  assert.notEqual(
    second.requests.get('site-render/home'),
    llm.requests.get('site-render/home'),
    'the home page must be re-rendered: its nav and internal links now point at pages that exist',
  );
});

test('a preview cannot be a production build, because its sitemap would describe a one-page site', async () => {
  const dir = seedRun();
  await assert.rejects(
    () => runBuild(options(dir, new ReplayClient(responses()), { profile: 'production', baseUrl: 'https://example.test' })),
    /--preview .* cannot be --profile production/,
  );
});

test('the preview estimate keeps the full architecture but only one page of copy and markup', () => {
  const models = { plan: 'claude-opus-5', design: 'claude-opus-5', render: 'claude-opus-5' };
  const full = estimateCost({ corpusChars: 48_315, maxPages: 6, repairPasses: 2, models });
  const preview = estimateCost({ corpusChars: 48_315, maxPages: 6, buildPages: 1, repairPasses: 2, models });

  assert.equal(preview.stages.architecture, full.stages.architecture, 'the architecture is planned in full either way');
  assert.equal(preview.stages.design, full.stages.design);
  assert.ok(preview.stages.copy < full.stages.copy / 3, 'one copy call, not six');
  assert.ok(preview.expectedUsd < full.expectedUsd * 0.5, `a preview should cost well under half a full build, got $${preview.expectedUsd.toFixed(2)} vs $${full.expectedUsd.toFixed(2)}`);
  // The floor: architecture + design are whole-site calls, so they dominate a one-page build.
  assert.ok(preview.stages.architecture + preview.stages.design > preview.expectedUsd * 0.5);
});
