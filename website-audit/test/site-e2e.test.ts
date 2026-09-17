// The whole orchestrator, driven from recorded stage outputs. No API calls, no network, no spend.
//
// Every structural bug the first paid build surfaced — the FAQ rendered twice, internal-link list
// items with invented copy ids, breadcrumbs linking to hub pages that are never generated — is
// visible here. This test exists so finding the next one costs nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { estimateCost, runBuild, type BuildOptions } from '../src/site/build.js';
import type { LlmParser, ParseRequest, ParseResult } from '../src/llm/client.js';
import { REPO_ROOT, tmpDir } from './helpers.js';
import { CORPUS_TEXT, fixtureArchitecture, fixtureContent, fixtureReport, homeMarkup, item, serviceMarkup } from './site-helpers.js';
import type { DesignSpec, PageContent, RenderedPage, SiteArchitecture } from '../src/site/types.js';

const DESIGN: DesignSpec = {
  css: ':root{--ink:#111}\n.actionbar{position:fixed;bottom:0}\n@media (prefers-reduced-motion: reduce){*{animation:none}}',
  design_md: '# Contract\n\n`.wrap` — the container. `.btn` — the button.',
  theme_color: '#123456',
  direction: 'test direction',
};

/**
 * Serves recorded stage outputs keyed by `step/label`, and records what it was asked for. Keyed
 * rather than queued because pages render concurrently, so call order is not deterministic; a repair
 * label (`home-repair1`) falls back to its base page's recording.
 */
class ReplayClient implements LlmParser {
  usd = 0;
  readonly calls: string[] = [];
  constructor(private readonly responses: Record<string, unknown>) {}
  async parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>> {
    const key = `${req.step}/${req.label}`;
    this.calls.push(key);
    const base = `${req.step}/${req.label.replace(/-repair\d+$/, '')}`;
    const parsed = (this.responses[key] ?? this.responses[base]) as T | undefined;
    if (parsed === undefined) throw new Error(`replay: nothing recorded for "${key}"`);
    return { parsed, usage: null, stopReason: 'end_turn', model: 'replay', cacheHit: true, attempts: 1, logFile: null, usd: 0 };
  }
}

/** A run directory with just enough on disk for buildCorpus to work. */
function seedRun(): string {
  const dir = tmpDir('siteredesign-e2e-');
  const report = fixtureReport([item('tel-link'), item('faq-present')]);
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

function goodResponses(): Record<string, unknown> {
  const arch: SiteArchitecture = fixtureArchitecture();
  return {
    'site-arch/architecture': arch,
    // The blocks and the FAQ line up with homeMarkup()'s copy ids: p001 opener, p002 block, p003 answer.
    'site-copy/home': fixtureContent(
      'overview',
      'Example Yard Co has kept gardens tidy in Riverton since 2009.',
      'Example Yard Co has kept gardens tidy in Riverton since 2009.',
      [{ text: 'Our crews work across Riverton and Draper.', quote: 'Our crews work across Riverton and Draper.' }],
      [{ q: 'When can I reach you?', a: 'We answer the phone seven days a week.', quote: 'We answer the phone seven days a week.' }],
    ) satisfies PageContent,
    'site-copy/services_mowing': fixtureContent('mowing', 'Weekly mowing starts at $45 per visit.', 'Weekly mowing starts at $45 per visit.') satisfies PageContent,
    'site-design/design': DESIGN,
    'site-render/home': homeMarkup() satisfies RenderedPage,
    'site-render/services_mowing': serviceMarkup() satisfies RenderedPage,
  };
}

test('a full build runs end to end from recorded stage outputs, with no API calls', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(goodResponses());
  const res = await runBuild(options(dir, llm));

  assert.equal(res.validation?.ok, true, `unexpected errors: ${JSON.stringify(res.validation?.findings.filter((f) => f.level === 'error'), null, 2)}`);
  assert.equal(res.budgetStop, null);
  assert.deepEqual(res.pagesWritten.sort(), ['index.html', 'services/mowing/index.html']);
  assert.deepEqual(llm.calls, ['site-arch/architecture', 'site-copy/home', 'site-copy/services_mowing', 'site-design/design', 'site-render/home', 'site-render/services_mowing']);

  for (const f of ['index.html', 'services/mowing/index.html', 'assets/site.css', 'plan.json', 'design.json', 'copy_map.json', 'assets.json', 'design.md', 'validate.json', 'self-test.json', 'seo-report.md']) {
    assert.ok(fs.existsSync(path.join(res.siteDir, f)), `${f} was not written`);
  }
  assert.ok(fs.readFileSync(path.join(res.siteDir, 'seo-report.md'), 'utf8').includes('Validation: passed'));
});

test('the build it produces has no dead local links', async () => {
  const dir = seedRun();
  const res = await runBuild(options(dir, new ReplayClient(goodResponses())));
  const bad: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
          const t = m[1].split('#')[0];
          if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) continue;
          if (!fs.existsSync(path.resolve(path.dirname(p), t))) bad.push(`${path.relative(res.siteDir, p)} → ${t}`);
        }
      }
    }
  };
  walk(res.siteDir);
  assert.deepEqual(bad, []);
});

test('the FAQ and the internal links are emitted once, by the build, not by the markup stage', async () => {
  const dir = seedRun();
  const res = await runBuild(options(dir, new ReplayClient(goodResponses())));
  const home = fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8');
  assert.equal(home.split('class="faq-q"').length - 1, 1, 'exactly one rendered question');
  assert.equal(home.split('class="related"').length - 1, 1);
  assert.equal(home.split('data-copy-id="p003"').length - 1, 1, 'no planned block is rendered twice');
});

test('the repair loop stops as soon as a pass fails to reduce the error count', async () => {
  const dir = seedRun();
  const broken = goodResponses();
  // Markup that always fails the same way: an untracked paragraph the repair pass never removes.
  const stubborn: RenderedPage = { ...homeMarkup(), main_html: `${homeMarkup().main_html}\n<p>Untracked, every time.</p>` };
  broken['site-render/home'] = stubborn;
  const llm = new ReplayClient(broken);
  const res = await runBuild(options(dir, llm, { repairPasses: 2 }));

  assert.equal(res.validation?.ok, false);
  const renders = llm.calls.filter((c) => c.startsWith('site-render')).length;
  assert.ok(renders <= 3, `expected the loop to give up early, but it made ${renders} render calls`);
  assert.ok(res.notes.some((n) => n.includes('repair stopped after pass')), `notes were: ${JSON.stringify(res.notes)}`);
});

test('--max-usd refuses to start a build it cannot afford, before anything is billed', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(goodResponses());
  // A budget that only watches the running total is useless: the first and largest batch has already
  // been paid for by the time it notices. This must fail with zero calls made.
  await assert.rejects(() => runBuild(options(dir, llm, { maxUsd: 0.0001 })), /max-usd .* would be exceeded by the plan stage/);
  assert.deepEqual(llm.calls, [], 'no call may be made once the budget is known to be insufficient');
});

test('--max-usd stops a build that overruns partway through', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(goodResponses());
  Object.defineProperty(llm, 'usd', { get: () => 99 });
  await assert.rejects(() => runBuild(options(dir, llm, { maxUsd: 100 })), /max-usd/);
});

test('a budget that comfortably covers the estimate lets the build through', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(goodResponses());
  const res = await runBuild(options(dir, llm, { maxUsd: 1000 }));
  assert.equal(res.validation?.ok, true);
  assert.ok(llm.calls.length > 0);
});

test('the dry-run estimate brackets what the observed build actually cost', () => {
  // The 6-page build this was calibrated against cost $4.25 with render on Opus and one repair pass.
  const est = estimateCost({ corpusChars: 48_315, maxPages: 6, repairPasses: 2, models: { plan: 'claude-opus-5', design: 'claude-opus-5', render: 'claude-opus-5' } });
  assert.ok(est.expectedUsd > 3 && est.expectedUsd < 5.5, `expected should sit near the $4.25 actual, got $${est.expectedUsd.toFixed(2)}`);
  assert.ok(est.usd > est.expectedUsd, 'the worst case must exceed the expected case');
  assert.equal(est.lines.length, 4);
  assert.ok(est.lines.some((l) => l.includes('corpus cached after the first')));
});

test('the budget is gated on the expected cost, not the worst case', () => {
  // Gating on the worst case would refuse a routine build that was never going to be expensive.
  const est = estimateCost({ corpusChars: 48_315, maxPages: 6, repairPasses: 2, models: { plan: 'claude-opus-5', design: 'claude-opus-5', render: 'claude-opus-5' } });
  assert.ok(est.usd > 6 && est.expectedUsd < 6, 'this is exactly the case that must still be allowed under the $6 default');
});

test('the estimate scales with corpus size and page count', () => {
  const models = { plan: 'claude-opus-5', design: 'claude-opus-5', render: 'claude-opus-5' };
  const small = estimateCost({ corpusChars: 10_000, maxPages: 2, repairPasses: 0, models });
  const big = estimateCost({ corpusChars: 100_000, maxPages: 12, repairPasses: 2, models });
  assert.ok(big.usd > small.usd * 4);
  assert.ok(big.expectedUsd > small.expectedUsd * 4);
});
