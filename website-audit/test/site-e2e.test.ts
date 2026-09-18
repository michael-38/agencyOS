// The whole orchestrator, driven from a recorded content pack. No API calls, no network, no spend.
//
// This is the loop the new design exists for: the only billed stage is one call, so everything after
// it — fill, brand, head, structured data, sidecars, all six gates, the report — is exercised here
// for free. Finding the next structural bug should cost nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BudgetExceeded, estimateCost, runBuild, type BuildOptions } from '../src/site/build.js';
import type { LlmParser, ParseRequest, ParseResult } from '../src/llm/client.js';
import { loadHtml } from '../src/checks/html.js';
import { REPO_ROOT, tmpDir } from './helpers.js';
import { CORPUS_TEXT, FIXTURE_TEMPLATE, fixturePack, fixtureReport, item } from './site-helpers.js';
import type { ContentPack } from '../src/site/content.js';

/** Serves one recorded pack, and records what it was asked for. */
class ReplayClient implements LlmParser {
  usd = 0;
  readonly calls: string[] = [];
  constructor(private readonly pack: ContentPack | null) {}
  async parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>> {
    this.calls.push(`${req.step}/${req.label}`);
    if (!this.pack) throw new Error(`replay: nothing recorded for "${req.step}/${req.label}"`);
    return { parsed: this.pack as unknown as T, usage: null, stopReason: 'end_turn', model: 'replay', cacheHit: true, attempts: 1, logFile: null, usd: 0 };
  }
}

/** A client that reports spend, to exercise the budget guard without a network. */
class SpendingClient extends ReplayClient {
  constructor(pack: ContentPack | null, public usd: number) {
    super(pack);
  }
}

let tplN = 0;
function seedTemplate(): string {
  const dir = tmpDir('tpl-e2e-');
  const file = path.join(dir, `template${tplN++}.html`);
  fs.writeFileSync(file, FIXTURE_TEMPLATE);
  return file;
}

/** A run directory with just enough on disk for buildCorpus to work. */
function seedRun(items = [item('tel-link'), item('faq-present')]): string {
  const dir = tmpDir('sitefill-e2e-');
  const report = fixtureReport(items);
  report.pages = [
    {
      url: 'https://example.test/',
      role: 'home',
      page_key: 'aaa',
      markdown_path: 'raw/pages/aaa/page.md',
      html_path: 'raw/pages/aaa/page.html',
      judge_text_path: null,
      judge_text_stats: null,
      screenshots: { mobile: null, desktop: null, mobile_fold: null, desktop_fold: null, mobile_tiles: [] },
      status_code: 200,
    },
  ];
  fs.mkdirSync(path.join(dir, 'raw', 'pages', 'aaa'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw', 'pages', 'aaa', 'page.md'), CORPUS_TEXT);
  // The source site's own outbound links, which is what the off-site link allowlist is built from.
  fs.writeFileSync(
    path.join(dir, 'raw', 'pages', 'aaa', 'page.html'),
    '<html><body><a href="https://booking.example/now">Book</a><a href="/local">Local</a></body></html>',
  );
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  return dir;
}

function options(dir: string, over: Partial<BuildOptions> = {}): BuildOptions {
  return {
    reportPath: path.join(dir, 'report.json'),
    repo: REPO_ROOT,
    profile: 'mockup',
    baseUrl: null,
    slug: 'landscaping',
    templatePath: seedTemplate(),
    brand: 'off',
    maxAssets: 0,
    useAssets: false,
    startStage: 'assets',
    maxUsd: 1.5,
    fromCache: null,
    offline: true,
    model: 'claude-opus-5',
    verbose: false,
    dryRun: false,
    ...over,
  };
}

const errorsOf = (res: Awaited<ReturnType<typeof runBuild>>) =>
  (res.validation?.findings ?? []).filter((f) => f.level === 'error').map((f) => `[${f.gate}] ${f.message}`);

test('a full build passes every gate and writes the artifacts', async () => {
  const dir = seedRun();
  const llm = new ReplayClient(fixturePack());
  const res = await runBuild({ ...options(dir), llm });

  assert.deepEqual(errorsOf(res), [], 'a correct build produces no errors');
  assert.equal(res.validation?.ok, true);
  assert.deepEqual(res.pagesWritten, ['/']);
  assert.deepEqual(llm.calls, ['site-content/content'], 'exactly one billed call');

  for (const f of ['index.html', 'content.json', 'copy_map.json', 'template.json', 'validate.json', 'self-test.json', 'seo-report.md', 'assets.json']) {
    assert.ok(fs.existsSync(path.join(res.siteDir, f)), `${f} was not written`);
  }
  // A mockup ships no sidecars: they are meaningless without a host.
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', 'index.md']) {
    assert.ok(!fs.existsSync(path.join(res.siteDir, f)), `${f} should not exist in the mockup profile`);
  }
});

test('the built page is about the client and carries nothing of the template', async () => {
  const dir = seedRun();
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(fixturePack()) });
  const html = fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8');
  const $ = loadHtml(html);

  for (const token of ['Mock Yard Co', 'mockyard.example', '(555) 000-0000', 'Mocktown']) {
    assert.ok(!html.includes(token), `the template's mock business survived: ${token}`);
  }
  assert.match($('h1').text(), /Example Yard Co/);
  assert.equal($('a[href^="tel:"]').first().attr('href'), 'tel:8015550100');
  // The persona's own design is untouched.
  assert.equal($('meta[name="theme-color"]').attr('content'), '#123456');
  assert.equal($('link[rel="stylesheet"]').length, 0, 'still zero network requests');
  assert.equal($('script').length, 1, 'the only script is the JSON-LD');
  // Scaffolding never ships.
  assert.doesNotMatch(html, /data-slot|data-repeat|data-omit-if-empty|data-mock-tokens/);
  // The audit's tags do.
  assert.ok($('[data-checklist]').length > 5);
  assert.ok($('[data-answer-first]').length >= 4);
});

test('FAQPage mirrors the rendered questions, and the structured data names the client', async () => {
  const dir = seedRun();
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(fixturePack()) });
  const $ = loadHtml(fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8'));
  const graph = JSON.parse($('script[type="application/ld+json"]').text())['@graph'] as Record<string, unknown>[];
  const faq = graph.find((n) => n['@type'] === 'FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.deepEqual(
    faq.mainEntity.map((q) => q.name),
    $('[data-faq-q]').map((_, el) => $(el).text().trim()).toArray(),
  );
  const org = graph.find((n) => n['@type'] === 'LocalBusiness') as Record<string, unknown>;
  assert.equal(org.name, 'Example Yard Co');
  assert.equal(org.telephone, '801-555-0100');
});

test('production writes the sidecars, and they describe the one page', async () => {
  const dir = seedRun();
  const res = await runBuild({ ...options(dir), profile: 'production', baseUrl: 'https://client.example', llm: new ReplayClient(fixturePack()) });
  assert.deepEqual(errorsOf(res), []);
  const read = (f: string) => fs.readFileSync(path.join(res.siteDir, f), 'utf8');
  assert.match(read('sitemap.xml'), /<loc>https:\/\/client\.example\/<\/loc>/);
  assert.equal(read('sitemap.xml').match(/<loc>/g)?.length, 1);
  assert.match(read('robots.txt'), /User-agent: ClaudeBot/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/client\.example\/sitemap\.xml/);
  assert.match(read('llms.txt'), /# Example Yard Co/);
  assert.match(read('llms.txt'), /- Phone: 801-555-0100/);
  assert.match(read('index.md'), /^# Example Yard Co/);
  assert.ok(fs.existsSync(path.join(res.siteDir, '_headers')));
  const $ = loadHtml(read('index.html'));
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://client.example/');
});

test('production without a base URL is refused rather than guessed at', async () => {
  const dir = seedRun();
  await assert.rejects(
    () => runBuild({ ...options(dir), profile: 'production', llm: new ReplayClient(fixturePack()) }),
    /--profile production requires --base-url/,
  );
});

test('a section the source gives nothing for is removed, with its nav link', async () => {
  const dir = seedRun();
  const pack = fixturePack({ omit_sections: ['faq'] });
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(pack) });
  const $ = loadHtml(fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8'));
  assert.equal($('#faq').length, 0);
  assert.equal($('a[href="#faq"]').length, 0, 'the nav link went with it');
  // And the gate that would otherwise have been satisfied by it is reported, not silently dropped.
  assert.ok(res.validation);
  assert.ok(errorsOf(res).some((m) => m.includes('faq-present')), 'a dropped section that owed a gap is an error');
});

test('an audit gap the template cannot carry is a warning, and lands in the report', async () => {
  const dir = seedRun([item('tel-link'), item('faq-present'), item('live-chat')]);
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(fixturePack()) });
  assert.deepEqual(errorsOf(res), [], 'live-chat must not fail an otherwise perfect build');
  assert.deepEqual(res.validation?.coverage.uncoverable, ['live-chat']);
  const report = fs.readFileSync(path.join(res.siteDir, 'seo-report.md'), 'utf8');
  assert.match(report, /## What this page does not close/);
  assert.match(report, /`live-chat`/);
  assert.match(report, /Audit gaps closed: 2 of 3/);
});

test('--stage fill re-fills from content.json without a second call', async () => {
  const dir = seedRun();
  const template = seedTemplate();
  const first = await runBuild({ ...options(dir), templatePath: template, llm: new ReplayClient(fixturePack()) });
  assert.ok(fs.existsSync(path.join(first.siteDir, 'content.json')));

  // No pack recorded: a client that would throw if asked proves nothing was.
  const silent = new ReplayClient(null);
  const again = await runBuild({ ...options(dir), templatePath: template, startStage: 'fill', llm: silent });
  assert.deepEqual(silent.calls, [], 'the fill stage is free');
  assert.deepEqual(errorsOf(again), []);
  assert.equal(again.usd, 0);
});

test('--stage fill against a missing artifact says which stage to run first', async () => {
  const dir = seedRun();
  await assert.rejects(
    () => runBuild({ ...options(dir), startStage: 'fill', llm: new ReplayClient(null) }),
    /--stage fill needs content\.json, which does not exist/,
  );
});

test('the budget is checked before the call, not after the money is gone', async () => {
  const dir = seedRun();
  await assert.rejects(
    () => runBuild({ ...options(dir), maxUsd: 0.000001, llm: new ReplayClient(fixturePack()) }),
    (e: unknown) => e instanceof BudgetExceeded && /would be exceeded by the content stage/.test(e.message),
  );
  // Nothing was written, because the refusal happens before any stage runs.
  assert.ok(!fs.existsSync(path.join(dir, 'site', 'index.html')));

  // Spend already on the clock counts toward the ceiling.
  const spent = new SpendingClient(fixturePack(), 1.4);
  await assert.rejects(() => runBuild({ ...options(dir), maxUsd: 1.5, llm: spent }), BudgetExceeded);
});

test('a dry run prices the build and writes nothing', async () => {
  const dir = seedRun();
  const res = await runBuild({ ...options(dir), dryRun: true, llm: new ReplayClient(fixturePack()) });
  assert.equal(res.usd, 0);
  assert.deepEqual(res.pagesWritten, []);
  assert.equal(res.validation, null);
  assert.ok(!fs.existsSync(path.join(dir, 'site', 'index.html')));
});

test('the estimate brackets what a build actually looks like, and scales with the template', async () => {
  const small = estimateCost({ corpusChars: 48_000, slotCount: 20, model: 'claude-opus-5' });
  const large = estimateCost({ corpusChars: 48_000, slotCount: 62, model: 'claude-opus-5' });
  assert.ok(large.expectedUsd > small.expectedUsd, 'more slots costs more');
  assert.ok(large.usd >= large.expectedUsd, 'the worst case is never below the expected case');
  // The real Olympus corpus is 48,315 chars and landscaping declares 62 prompted slots. The whole
  // point of this rewrite is that the number is under a dollar.
  assert.ok(large.expectedUsd < 1, `expected under $1, got $${large.expectedUsd.toFixed(2)}`);
  assert.ok(large.expectedUsd > 0.1, `an estimate this low is probably a bug: $${large.expectedUsd.toFixed(2)}`);
  assert.ok(large.lines.some((l) => /assets, fill, head, sidecars and every gate are code/.test(l)));
});

test('a pack naming a slot the template does not declare is dropped, not written', async () => {
  const dir = seedRun();
  const pack = fixturePack();
  pack.slots.push({ slot: 'ghost.slot', text: 'Invented copy that must not appear.', source_kind: 'source', source_page_url: 'u', source_quote: 'q' });
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(pack) });
  const html = fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8');
  assert.ok(!html.includes('Invented copy'));
  const tpl = JSON.parse(fs.readFileSync(path.join(res.siteDir, 'template.json'), 'utf8')) as { slots_unknown: string[] };
  assert.deepEqual(tpl.slots_unknown, ['ghost.slot']);
});

test('an unverifiable quote loses its credit and brings the notice with it', async () => {
  const dir = seedRun();
  const pack = fixturePack();
  const hero = pack.slots.find((s) => s.slot === 'hero.lede')!;
  hero.source_quote = 'A sentence that appears nowhere in the scraped source at all.';
  const res = await runBuild({ ...options(dir), llm: new ReplayClient(pack) });
  const $ = loadHtml(fs.readFileSync(path.join(res.siteDir, 'index.html'), 'utf8'));
  assert.equal($('[data-copy="placeholder"]').length, 1);
  assert.equal($('[data-placeholder-notice]').length, 1);
  assert.ok(res.notes.some((n) => /quote not found in any scraped page/.test(n)));
  const copyMap = JSON.parse(fs.readFileSync(path.join(res.siteDir, 'copy_map.json'), 'utf8')) as { placeholder_ratio: number };
  assert.ok(copyMap.placeholder_ratio > 0);
});
