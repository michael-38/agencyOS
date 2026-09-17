// Step 7: evaluate the checklist. Home first (deterministic checks + one judgment call), then for unmet
// subpath items the top-level pages linked from the home page, in document order, one judgment call per
// page for the items still unmet. An item stops being judged once it passes; the loop stops once all pass.
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS, VIEWPORTS } from '../config.js';
import { homeLeanText, prepareJudgeText, type JudgeTextMode } from '../content/filter.js';
import type { FirecrawlService } from '../firecrawl.js';
import { JudgeOutputError, type LlmClient } from '../llm/client.js';
import { judgmentSchema, type JudgmentOutput } from '../llm/schemas.js';
import { judgmentSystem, judgmentUserText, type JudgmentPersona } from '../llm/prompts/judgment.js';
import type { ModuleSet } from '../modules.js';
import type { ChecklistItem, Verdict } from '../personas/schema.js';
import type { Detectors } from '../personas/load.js';
import { runCheck, type PageContext } from '../checks/registry.js';
import type { Progress } from '../progress.js';
import type { CandidateLogEntry, Evidence } from '../report/schema.js';
import type { CandidatePool } from './candidates.js';
import { scrapePage, type PageRecord } from './scrape.js';

export interface PageVerdict {
  url: string;
  verdict: Verdict;
  evidence: Evidence;
  note: string;
}

export interface ItemEvaluation {
  item: ChecklistItem;
  verdict: Verdict;
  evidence: Evidence;
  note: string;
  candidates_selected: string[];
  candidates_checked: string[];
  candidate_log: CandidateLogEntry[];
  satisfied_at_url: string | null;
  unverified: string | null;
  pages: PageVerdict[];
}

export interface EvaluationFlags {
  markdown_truncated_pages: string[];
  probe_fallback_pages: string[];
  judge_calls: number;
  candidate_pages: number;
  /** Pool pages never scraped because every unmet item had already passed. */
  candidate_pages_skipped: number;
}

export interface EvaluationResult {
  items: ItemEvaluation[];
  candidatePages: PageRecord[];
  flags: EvaluationFlags;
  skippedItemIds: string[];
}

export interface EvaluateInput {
  items: ChecklistItem[];
  home: PageRecord;
  persona: JudgmentPersona;
  detectors: Detectors;
  jsonldType: string;
  modules: ModuleSet;
  candidatePool: CandidatePool;
  llm: Pick<LlmClient, 'parse'> | null;
  fc: Pick<FirecrawlService, 'scrape'>;
  probeScript: string;
  progress: Progress;
  runDir: string;
  judgeModel: string;
  tilesSent: number;
  lenient: boolean;
  judgeText: JudgeTextMode;
}

const RANK: Record<Verdict, number> = { pass: 2, partial: 1, fail: 0 };

function pageContext(page: PageRecord, input: EvaluateInput): PageContext {
  return {
    url: page.url,
    rawHtml: page.rawHtml,
    markdown: page.markdown,
    links: page.links,
    probe: page.probe,
    viewport: { ...VIEWPORTS.mobile },
    detectors: input.detectors,
    jsonldType: input.jsonldType,
  };
}

function judgeImages(page: PageRecord, tilesSent: number, includeDesktop: boolean): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  if (page.files.mobileFold) out.push({ path: page.files.mobileFold, label: `mobile fold (first ${VIEWPORTS.mobile.height} css px at ${VIEWPORTS.mobile.width} wide)` });
  page.files.tiles.slice(0, tilesSent).forEach((t, i) => out.push({ path: t, label: `mobile full-page tile ${i + 1} of ${page.tilesTotal} (top to bottom)` }));
  if (includeDesktop && page.files.desktopFold) out.push({ path: page.files.desktopFold, label: `desktop fold (${VIEWPORTS.desktop.width}x${VIEWPORTS.desktop.height})` });
  return out;
}

function siteHostOf(input: EvaluateInput): string {
  try {
    return new URL(input.home.url).hostname;
  } catch {
    return '';
  }
}

async function judgePage(page: PageRecord, items: ChecklistItem[], input: EvaluateInput, flags: EvaluationFlags, homeLean: string | null): Promise<Record<string, PageVerdict> | 'invalid'> {
  if (!input.llm) throw new Error('judgment requested without an LLM client');
  // The home page always gets the full text so its request (and cache key) is independent of the mode.
  const candidate = page.role === 'candidate';
  const prepared = prepareJudgeText(page.markdown, {
    maxChars: LIMITS.judgeMarkdownMaxChars,
    mode: candidate ? input.judgeText : 'full',
    siteHost: siteHostOf(input),
    homeLeanText: candidate ? homeLean : null,
  });
  const judgeRel = path.join('raw', 'pages', page.key, 'judge.md');
  fs.mkdirSync(path.dirname(path.join(input.runDir, judgeRel)), { recursive: true });
  fs.writeFileSync(path.join(input.runDir, judgeRel), prepared.text);
  page.judgeTextPath = judgeRel;
  page.judgeTextStats = prepared.stats;
  if (prepared.stats.truncated) flags.markdown_truncated_pages.push(page.url);
  const images = judgeImages(page, input.tilesSent, !candidate);
  const content = [
    ...images.map((im) => ({ type: 'image' as const, path: im.path, label: im.label })),
    {
      type: 'text' as const,
      text: judgmentUserText({
        url: page.url,
        role: candidate ? 'candidate' : 'home',
        markdown: prepared.text,
        markdownTruncated: prepared.stats.truncated,
        images: images.map((im, i) => ({ index: i + 1, label: im.label })),
        items: items.map((it) => ({ id: it.id, criterion: it.criterion, scope: it.scope, weight: it.weight })),
      }),
    },
  ];
  flags.judge_calls++;
  try {
    const res = await input.llm.parse<JudgmentOutput>({
      step: '07-judge',
      label: candidate ? `candidate-${page.key}` : 'home',
      model: input.judgeModel,
      system: judgmentSystem(input.persona),
      content,
      schema: judgmentSchema(items.map((it) => it.id)),
      maxTokens: LIMITS.judgeMaxTokens,
      thinking: { effort: 'medium' },
      fallbacks: true,
    });
    const out: Record<string, PageVerdict> = {};
    for (const it of items) {
      const j = res.parsed[it.id];
      if (!j) continue;
      let summary = j.evidence.summary.replace(/\s+/g, ' ').trim();
      if (summary.length > 160) summary = `${summary.slice(0, 159)}…`;
      out[it.id] = {
        url: page.url,
        verdict: j.verdict,
        evidence: { method: 'judgment', quote: j.evidence.quote, location: j.evidence.location, screenshot: j.evidence.screenshot, summary },
        note: j.note,
      };
    }
    return out;
  } catch (e) {
    if (e instanceof JudgeOutputError && input.lenient) {
      input.progress.error(`lenient: judgment invalid for ${page.url} (${e.message}); items marked fail/unverified`);
      return 'invalid';
    }
    throw e;
  }
}

function deterministicVerdicts(page: PageRecord, items: ChecklistItem[], input: EvaluateInput, flags: EvaluationFlags): Record<string, PageVerdict> {
  const ctx = pageContext(page, input);
  const out: Record<string, PageVerdict> = {};
  let fallbackUsed = false;
  for (const it of items) {
    const r = runCheck(it.id, ctx);
    if (r.evidence.method === 'dom-order-fallback') fallbackUsed = true;
    out[it.id] = { url: page.url, verdict: r.verdict, evidence: r.evidence, note: r.note };
  }
  if (fallbackUsed && !flags.probe_fallback_pages.includes(page.url)) flags.probe_fallback_pages.push(page.url);
  return out;
}

async function evaluatePage(page: PageRecord, items: ChecklistItem[], input: EvaluateInput, flags: EvaluationFlags, homeLean: string | null): Promise<{ verdicts: Record<string, PageVerdict>; invalidJudgment: boolean }> {
  const det = items.filter((it) => it.check === 'deterministic');
  const jud = items.filter((it) => it.check === 'judgment');
  const verdicts: Record<string, PageVerdict> = {};
  let invalid = false;
  if (det.length) Object.assign(verdicts, deterministicVerdicts(page, det, input, flags));
  if (jud.length) {
    const j = await judgePage(page, jud, input, flags, homeLean);
    if (j === 'invalid') invalid = true;
    else Object.assign(verdicts, j);
  }
  return { verdicts, invalidJudgment: invalid };
}

export async function evaluateChecklist(input: EvaluateInput): Promise<EvaluationResult> {
  const { modules, progress } = input;
  const flags: EvaluationFlags = { markdown_truncated_pages: [], probe_fallback_pages: [], judge_calls: 0, candidate_pages: 0, candidate_pages_skipped: 0 };
  const skippedItemIds: string[] = [];
  const active = input.items.filter((it) => {
    const on = it.check === 'deterministic' ? modules.deterministic : modules.judgment;
    if (!on) skippedItemIds.push(it.id);
    return on;
  });
  const evals = new Map<string, ItemEvaluation>();
  for (const it of active) {
    evals.set(it.id, {
      item: it,
      verdict: 'fail',
      evidence: { method: 'deterministic', summary: 'not evaluated' },
      note: '',
      candidates_selected: [],
      candidates_checked: [],
      candidate_log: [],
      satisfied_at_url: null,
      unverified: null,
      pages: [],
    });
  }
  if (!active.length) return { items: [], candidatePages: [], flags, skippedItemIds };

  // --- home page ---
  progress.log(`evaluating ${active.length} item(s) on home (${active.filter((i) => i.check === 'deterministic').length} deterministic, ${active.filter((i) => i.check === 'judgment').length} judgment)`);
  const home = await evaluatePage(input.home, active, input, flags, null);
  for (const it of active) {
    const ev = evals.get(it.id)!;
    const v = home.verdicts[it.id];
    if (v) {
      ev.pages.push(v);
      ev.verdict = v.verdict;
      ev.evidence = v.evidence;
      ev.note = v.note;
      ev.satisfied_at_url = v.verdict === 'fail' ? null : input.home.url;
    } else if (it.check === 'judgment' && home.invalidJudgment) {
      ev.verdict = 'fail';
      ev.unverified = 'judge-output-invalid';
      ev.note = 'judge-output-invalid';
      ev.evidence = { method: 'judgment', quote: null, location: null, screenshot: null, summary: 'judge output invalid on home page' };
    }
  }

  // --- top-level pages linked from home, for subpath items still unmet ---
  const unmet = active.filter((it) => it.scope === 'subpath' && evals.get(it.id)!.verdict !== 'pass' && !evals.get(it.id)!.unverified);
  const pool = input.candidatePool;
  if (!modules.subpath) {
    for (const it of unmet) evals.get(it.id)!.note = [evals.get(it.id)!.note, 'subpath search disabled'].filter(Boolean).join('; ');
    return { items: [...evals.values()], candidatePages: [], flags, skippedItemIds };
  }
  if (!unmet.length) return { items: [...evals.values()], candidatePages: [], flags, skippedItemIds };
  if (!pool.urls.length) {
    progress.log(`${unmet.length} subpath item(s) unmet on home but no top-level pages are linked from it`);
    return { items: [...evals.values()], candidatePages: [], flags, skippedItemIds };
  }

  progress.log(`${unmet.length} subpath item(s) unmet on home; checking ${pool.urls.length} top-level page(s) linked from it`);
  for (const it of unmet) evals.get(it.id)!.candidates_selected = [...pool.urls];
  const homeLean = input.judgeText === 'lean' ? homeLeanText(input.home.markdown, siteHostOf(input)) : null;
  const candidatePages: PageRecord[] = [];
  for (let i = 0; i < pool.urls.length; i++) {
    const p = pool.urls[i];
    const need = unmet.filter((it) => evals.get(it.id)!.verdict !== 'pass');
    if (!need.length) {
      flags.candidate_pages_skipped += pool.urls.length - i;
      progress.log(`every unmet item has passed; skipping ${pool.urls.length - i} remaining page(s)`);
      break;
    }
    let page: PageRecord;
    try {
      page = await scrapePage(input.fc, p, 'candidate', { desktop: false, probeScript: input.probeScript, runDir: input.runDir, progress });
      if (page.statusCode != null && (page.statusCode < 200 || page.statusCode >= 400)) throw new Error(`HTTP ${page.statusCode}`);
    } catch (e) {
      const err = (e as Error).message;
      progress.info(`candidate scrape failed ${p}: ${err}`);
      for (const it of need) {
        const ev = evals.get(it.id)!;
        ev.candidates_checked.push(p);
        ev.candidate_log.push({ url: p, status: 'scrape-failed', error: err });
      }
      continue;
    }
    candidatePages.push(page);
    flags.candidate_pages++;
    const res = await evaluatePage(page, need, input, flags, homeLean);
    for (const it of need) {
      const ev = evals.get(it.id)!;
      ev.candidates_checked.push(p);
      const v = res.verdicts[it.id];
      if (!v) {
        ev.candidate_log.push({ url: p, status: 'scrape-failed', error: res.invalidJudgment ? 'judge-output-invalid' : 'no verdict' });
        continue;
      }
      ev.pages.push(v);
      ev.candidate_log.push({ url: p, status: 'evaluated', verdict: v.verdict });
      if (RANK[v.verdict] > RANK[ev.verdict]) {
        ev.verdict = v.verdict;
        ev.evidence = v.evidence;
        ev.note = v.note;
        ev.satisfied_at_url = v.verdict === 'fail' ? null : p;
      }
    }
  }
  return { items: [...evals.values()], candidatePages, flags, skippedItemIds };
}
