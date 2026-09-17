// Candidate loop: early stop, best-verdict-wins, scrape failures, module off, and lean judge text.
// Stubs stand in for the Anthropic client and Firecrawl; no network, no sharp (screenshotPath is null).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChecklist, type EvaluateInput } from '../src/steps/evaluate.js';
import type { PageRecord } from '../src/steps/scrape.js';
import { pageKeyFor, type ScrapedDoc, type ScrapeRequest } from '../src/firecrawl.js';
import type { ParseRequest, ParseResult } from '../src/llm/client.js';
import type { JudgmentOutput } from '../src/llm/schemas.js';
import type { ChecklistItem, Verdict } from '../src/personas/schema.js';
import { Progress } from '../src/progress.js';
import { defaultModules } from '../src/modules.js';
import { detectors, tmpDir } from './helpers.js';

const HOME = 'https://www.example.com/';
const P1 = 'https://www.example.com/services';
const P2 = 'https://www.example.com/about';
const P3 = 'https://www.example.com/contact';
const SHARED = 'Call us today for a free estimate on any landscaping project, big or small, anywhere in the valley.';

function item(id: string, over: Partial<ChecklistItem> = {}): ChecklistItem {
  return { id, criterion: `criterion ${id}`, scope: 'subpath', check: 'judgment', weight: 'med', extra: {}, line: 1, source: 'persona', ...over };
}

function homePage(markdown: string): PageRecord {
  return {
    key: 'home',
    url: HOME,
    finalUrl: HOME,
    role: 'home',
    statusCode: 200,
    title: 'Home',
    description: null,
    markdown,
    rawHtml: '<html><body>home</body></html>',
    links: [],
    probe: null,
    probeError: null,
    files: { mobile: null, desktop: null, mobileFold: null, desktopFold: null, tiles: [] },
    markdownPath: null,
    htmlPath: null,
    judgeTextPath: null,
    judgeTextStats: null,
    dpr: null,
    imageSize: null,
    tilesTotal: 0,
    creditsUsed: 0,
    cacheHits: 0,
    error: null,
  };
}

/** url → item id → verdict the stub judge returns. */
type Plan = Record<string, Record<string, Verdict>>;

interface Harness {
  input: EvaluateInput;
  judged: { url: string; ids: string[]; text: string }[];
  scraped: string[];
}

function harness(
  plan: Plan,
  opts: { failScrape?: string[]; pool?: string[]; subpath?: boolean; homeMarkdown?: string; pageMarkdown?: (url: string) => string; judgeText?: 'lean' | 'full' } = {},
): Harness {
  const judged: Harness['judged'] = [];
  const scraped: string[] = [];
  const llm = {
    parse: async <T>(req: ParseRequest<T>): Promise<ParseResult<T>> => {
      const text = req.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
      const url = /^URL: (\S+) \(role/m.exec(text)?.[1] ?? '?';
      const ids = [...text.matchAll(/^- id: (\S+) \|/gm)].map((m) => m[1]);
      judged.push({ url, ids, text });
      const verdicts = plan[url] ?? {};
      const parsed: JudgmentOutput = Object.fromEntries(
        ids.map((id) => [id, { verdict: verdicts[id] ?? 'fail', evidence: { quote: null, location: null, screenshot: null, summary: `${id} on ${url}` }, note: '' }]),
      );
      return { parsed: parsed as T, usage: null, stopReason: 'end_turn', model: req.model, cacheHit: false, attempts: 1, logFile: null, usd: 0 };
    },
  };
  const fc = {
    scrape: async (req: ScrapeRequest): Promise<{ doc: ScrapedDoc; hit: boolean }> => {
      scraped.push(req.url);
      if (opts.failScrape?.includes(req.url)) throw new Error('boom');
      const doc: ScrapedDoc = {
        requestedUrl: req.url,
        normalizedUrl: req.url,
        pageKey: pageKeyFor(req.url),
        role: req.role,
        viewport: req.viewport,
        finalUrl: req.url,
        statusCode: 200,
        title: null,
        description: null,
        markdown: opts.pageMarkdown ? opts.pageMarkdown(req.url) : `# ${req.url}\n\nPage content.`,
        rawHtml: '<html><body>page</body></html>',
        links: [],
        screenshotPath: null,
        screenshotSourceUrl: null,
        probeRaw: null,
        creditsUsed: 1,
        cacheState: null,
        error: null,
        warning: null,
      };
      return { doc, hit: false };
    },
  };
  const runDir = tmpDir();
  const modules = defaultModules();
  if (opts.subpath === false) modules.subpath = false;
  const pool = opts.pool ?? [P1, P2, P3];
  const input: EvaluateInput = {
    items: [item('A'), item('B')],
    home: homePage(opts.homeMarkdown ?? '# Home\n\nWelcome.'),
    persona: { personaName: 'Visitor', primaryGoal: 'Find a service', deviceBias: 'mobile', goalsProse: '', industryDisplayName: 'Test' },
    detectors: detectors(),
    jsonldType: 'LocalBusiness',
    modules,
    candidatePool: { rule: 'home-links-top-level', relative_depth: 1, urls: pool, capped: [], cap: 8, considered: pool.length },
    llm,
    fc,
    probeScript: '',
    progress: new Progress(runDir, false, false, true),
    runDir,
    judgeModel: 'claude-opus-5',
    tilesSent: 4,
    lenient: false,
    judgeText: opts.judgeText ?? 'lean',
  };
  return { input, judged, scraped };
}

test('early stop: an item is never judged again once it passes; pages with nothing left are not scraped', async () => {
  const h = harness({ [HOME]: { A: 'fail', B: 'fail' }, [P1]: { A: 'pass', B: 'fail' }, [P2]: { B: 'pass' }, [P3]: { A: 'pass', B: 'pass' } });
  const r = await evaluateChecklist(h.input);
  assert.deepEqual(h.judged.map((j) => j.url), [HOME, P1, P2]);
  assert.deepEqual(h.judged[0].ids, ['A', 'B']);
  assert.deepEqual(h.judged[1].ids, ['A', 'B']);
  assert.deepEqual(h.judged[2].ids, ['B']);
  assert.deepEqual(h.scraped, [P1, P2]);
  const A = r.items.find((i) => i.item.id === 'A')!;
  const B = r.items.find((i) => i.item.id === 'B')!;
  assert.equal(A.verdict, 'pass');
  assert.equal(A.satisfied_at_url, P1);
  assert.deepEqual(A.candidates_checked, [P1]);
  assert.deepEqual(A.candidates_selected, [P1, P2, P3]);
  assert.deepEqual(A.candidate_log, [{ url: P1, status: 'evaluated', verdict: 'pass' }]);
  assert.equal(B.verdict, 'pass');
  assert.equal(B.satisfied_at_url, P2);
  assert.deepEqual(B.candidates_checked, [P1, P2]);
  assert.deepEqual(B.candidate_log, [
    { url: P1, status: 'evaluated', verdict: 'fail' },
    { url: P2, status: 'evaluated', verdict: 'pass' },
  ]);
  assert.equal(r.flags.judge_calls, 3);
  assert.equal(r.flags.candidate_pages, 2);
  assert.equal(r.flags.candidate_pages_skipped, 1);
  assert.equal(r.candidatePages.length, 2);
});

test('partial keeps looking; best verdict wins and the first page reaching it sets satisfied_at_url; home passes stay out of the pool', async () => {
  const h = harness({ [HOME]: { A: 'fail', B: 'pass' }, [P1]: { A: 'partial' }, [P2]: { A: 'partial' }, [P3]: { A: 'fail' } });
  const r = await evaluateChecklist(h.input);
  assert.deepEqual(h.judged.map((j) => j.url), [HOME, P1, P2, P3]);
  for (const j of h.judged.slice(1)) assert.deepEqual(j.ids, ['A']);
  const A = r.items.find((i) => i.item.id === 'A')!;
  const B = r.items.find((i) => i.item.id === 'B')!;
  assert.equal(A.verdict, 'partial');
  assert.equal(A.satisfied_at_url, P1);
  assert.deepEqual(A.candidates_checked, [P1, P2, P3]);
  assert.equal(B.satisfied_at_url, HOME);
  assert.deepEqual(B.candidates_selected, []);
  assert.deepEqual(B.candidates_checked, []);
  assert.equal(r.flags.candidate_pages_skipped, 0);
});

test('a failed scrape is logged for the items still needed and the loop continues', async () => {
  const h = harness({ [HOME]: { A: 'fail', B: 'fail' }, [P1]: { A: 'fail', B: 'fail' }, [P3]: { A: 'pass', B: 'pass' } }, { failScrape: [P2] });
  const r = await evaluateChecklist(h.input);
  assert.deepEqual(h.scraped, [P1, P2, P3]);
  assert.deepEqual(h.judged.map((j) => j.url), [HOME, P1, P3]);
  const A = r.items.find((i) => i.item.id === 'A')!;
  assert.deepEqual(A.candidates_checked, [P1, P2, P3]);
  assert.deepEqual(A.candidate_log, [
    { url: P1, status: 'evaluated', verdict: 'fail' },
    { url: P2, status: 'scrape-failed', error: 'boom' },
    { url: P3, status: 'evaluated', verdict: 'pass' },
  ]);
  assert.equal(A.verdict, 'pass');
  assert.equal(A.satisfied_at_url, P3);
  assert.equal(r.flags.candidate_pages, 2);
});

test('subpath module off or an empty pool: nothing is scraped and the work is declared', async () => {
  const off = harness({ [HOME]: { A: 'fail', B: 'fail' } }, { subpath: false });
  const r1 = await evaluateChecklist(off.input);
  assert.deepEqual(off.scraped, []);
  assert.deepEqual(off.judged.map((j) => j.url), [HOME]);
  assert.match(r1.items.find((i) => i.item.id === 'A')!.note, /subpath search disabled/);

  const empty = harness({ [HOME]: { A: 'fail', B: 'fail' } }, { pool: [] });
  const r2 = await evaluateChecklist(empty.input);
  assert.deepEqual(empty.scraped, []);
  assert.deepEqual(r2.items.find((i) => i.item.id === 'A')!.candidates_selected, []);
  assert.equal(r2.items.find((i) => i.item.id === 'A')!.verdict, 'fail');
});

test('lean judge text: candidate pages lose link targets, image markup, and blocks the home page already showed; home keeps full text', async () => {
  const homeMarkdown = `# Home\n\n${SHARED}\n\n[About us](https://www.example.com/about)`;
  const pageMarkdown = (url: string) => `# ${url}\n\n${SHARED}\n\n[About us](https://www.example.com/about) [Book](https://clienthub.getjobber.com/x)\n\n![](https://www.example.com/hero.png)\n\nUnique page copy.`;
  const lean = harness({ [HOME]: { A: 'fail', B: 'fail' }, [P1]: { A: 'pass', B: 'pass' } }, { homeMarkdown, pageMarkdown });
  const r = await evaluateChecklist(lean.input);
  assert.ok(lean.judged[0].text.includes(SHARED), 'home judge text keeps the shared block');
  assert.ok(lean.judged[0].text.includes('(https://www.example.com/about)'), 'home judge text keeps link targets');
  assert.equal(lean.input.home.judgeTextStats?.mode, 'full');
  const candidateText = lean.judged[1].text;
  assert.ok(!candidateText.includes(SHARED), 'shared block dropped on the candidate page');
  assert.ok(!candidateText.includes('https://www.example.com/about'), 'same-site link target dropped');
  assert.ok(candidateText.includes('[About us] [Book](clienthub.getjobber.com)'), candidateText);
  assert.ok(!candidateText.includes('hero.png'), 'empty-alt image dropped');
  assert.ok(candidateText.includes('Unique page copy.'));
  const stats = r.candidatePages[0].judgeTextStats!;
  assert.equal(stats.mode, 'lean');
  assert.equal(stats.home_dup_blocks_removed, 1);
  assert.equal(stats.links_stripped, 2);
  assert.equal(stats.images_stripped, 1);
  assert.ok(stats.chars_sent < stats.chars_raw);

  const full = harness({ [HOME]: { A: 'fail', B: 'fail' }, [P1]: { A: 'pass', B: 'pass' } }, { homeMarkdown, pageMarkdown, judgeText: 'full' });
  const r2 = await evaluateChecklist(full.input);
  assert.ok(full.judged[1].text.includes(SHARED));
  assert.ok(full.judged[1].text.includes('(https://www.example.com/about)'));
  assert.equal(r2.candidatePages[0].judgeTextStats?.mode, 'full');
});
