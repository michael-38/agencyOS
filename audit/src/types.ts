export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Issue {
  severity: Severity;
  title: string;
  description: string;
  quickFix?: string;
  evidence?: string;
}

export type ModuleId =
  | 'lighthouse'
  | 'seo-onpage'
  | 'seo-ranking'
  | 'traffic-metrics'
  | 'llm-copy-aeo'
  | 'llm-discoverability'
  | 'copy-conversion'
  | 'design-review'
  | 'ux-medspa';

export type ModuleStatus = 'ok' | 'skipped' | 'error';

export interface ModuleResult<E = unknown> {
  id: ModuleId;
  label: string;
  status: ModuleStatus;
  score: number | null;
  summary: string;
  issues: Issue[];
  evidence?: E;
  skipReason?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface ClinicInfo {
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  services: string[];
  domain: string;
  url: string;
}

export interface AuditInput {
  url: string;
  nameOverride?: string;
  cityOverride?: string;
  keywordsOverride?: string[];
}

export interface AuditCost {
  totalUsd: number;
  byLabel: Record<string, number>;
}

export interface AuditReport {
  input: AuditInput;
  clinic: ClinicInfo;
  startedAt: string;
  finishedAt: string;
  overallScore: number;
  modules: ModuleResult[];
  outputDir: string;
  cost?: AuditCost;
  corpusStats?: { includedPages: number; droppedPages: number; totalChars: number };
}

export interface BatchEntry {
  input: AuditInput;
  status: 'success' | 'failed';
  outputDir?: string;
  reportPath?: string;
  overallScore?: number;
  errorMessage?: string;
  clinic?: ClinicInfo;
  moduleScores?: Record<ModuleId, number | null>;
}

export interface CLIOptions {
  output: string;
  batch?: string;
  concurrency: number;
  skip: ModuleId[];
  enable: ModuleId[];
  keywords?: string[];
  open: boolean;
  index: boolean;
  verbose: boolean;
  maxPages: number;
  maxCorpus: number;
  shallowDesign: boolean;
  budget: number; // USD; 0 disables
}

export interface AvailableKeys {
  anthropic: boolean;
  firecrawl: boolean;
  serpapi: boolean;
  perplexity: boolean;
  openai: boolean;
  dataforseo: boolean;
}
