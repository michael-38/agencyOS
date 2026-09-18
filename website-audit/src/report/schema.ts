// report.json type definitions (the contract). Fields marked "additive" extend the user-specified schema.
import type { CheckKind, Scope, Verdict, Weight } from '../personas/schema.js';
import type { ModuleSet } from '../modules.js';
import type { Facts } from '../checks/facts.js';
import type { JudgeTextMode, JudgeTextStats } from '../content/filter.js';
import type { CandidatePool } from '../steps/candidates.js';
import type { OpenSeoPlan } from '../openseo/plan.js';

export type HomeRule = 'root-2xx' | 'root-non-2xx' | 'splash-detected' | 'host-mismatch' | 'input-page-fallback';

export interface EvidenceJudgment {
  method: 'judgment';
  quote: string | null;
  location: string | null;
  screenshot: { viewport: 'mobile' | 'desktop'; image_index: number; region: string } | null;
  summary: string;
}
export interface EvidenceDeterministic {
  method: 'deterministic' | 'dom-order-fallback';
  selector?: string;
  snippet?: string;
  values?: Record<string, unknown>;
  summary: string;
}
export type Evidence = EvidenceJudgment | EvidenceDeterministic;

export type CandidateStatus = 'evaluated' | 'scrape-failed';

export interface CandidateLogEntry {
  url: string;
  status: CandidateStatus;
  verdict?: Verdict;
  error?: string;
}

export interface ReportItem {
  id: string;
  source: 'persona' | 'common';
  criterion: string;
  scope: Scope;
  check: CheckKind;
  weight: Weight;
  verdict: Verdict;
  evidence: Evidence;
  candidates_checked: string[];
  satisfied_at_url: string | null;
  note: string;
  // additive
  candidates_selected: string[];
  candidate_log: CandidateLogEntry[];
  unverified: string | null;
  extra: Record<string, string>;
}

export interface ReportPage {
  url: string;
  role: 'root' | 'home' | 'candidate';
  page_key: string;
  markdown_path: string | null;
  html_path: string | null;
  judge_text_path: string | null;
  judge_text_stats: JudgeTextStats | null; // additive
  screenshots: { mobile: string | null; desktop: string | null; mobile_fold: string | null; desktop_fold: string | null; mobile_tiles: string[] };
  status_code: number | null;
}

export interface Report {
  input_url: string;
  resolved_origin: string;
  home_url: string;
  home_rule: HomeRule;
  rules_fired: string[]; // additive
  industry: {
    slug: string;
    confidence: number;
    raw_slug: string | null; // additive
    rationale: string | null; // additive
    source: 'llm' | 'override'; // additive
  };
  persona_file: string | null;
  persona_fallback: boolean; // additive
  items: ReportItem[];
  summary: {
    pass: number;
    partial: number;
    fail: number;
    top_gaps: string[];
    verdict: 'strong' | 'fair' | 'weak' | 'n/a'; // additive
    partial_audit: boolean; // additive
    skipped: { modules: string[]; item_ids: string[] }; // additive
  };
  facts: Facts | null; // additive
  openseo: OpenSeoPlan | null; // additive — enrichment the operator asked for, for an agent to run
  pages: ReportPage[]; // additive
  run_meta: {
    timestamps: { started: string; finished: string };
    models: Record<string, string>;
    credits_used: number;
    anthropic_usd: number;
    viewports: { mobile: [number, number]; desktop: [number, number] | null };
    run_dir: string;
    cache_source: string | null;
    cache_stats: { hits: number; misses: number; source_hits: number };
    persona_hashes: Record<string, string>;
    probe_version: number;
    pipeline_version: string;
    modules: ModuleSet;
    launched_from: 'cli' | 'ui';
    judge_text: JudgeTextMode; // additive
    candidate_pool: CandidatePool; // additive
    flags: { markdown_truncated_pages: string[]; probe_fallback_pages: string[]; second_map: boolean; subdomain_share: number; candidate_pages_skipped: number };
  };
}
