// Module registry: every optional part of the audit is a toggle. Resolve, map, and the home mobile
// scrape are the always-on core. Skipped work is always declared in report.json / report.md.

export const MODULE_IDS = [
  'classify',
  'common-checklist',
  'persona-checklist',
  'deterministic',
  'judgment',
  'subpath',
  'desktop',
  'facts',
  'lighthouse',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  default: boolean;
  cost: string;
  built: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: 'classify', label: 'Industry classification', description: 'Detect the industry with one Haiku call. Off = you must pick the industry.', default: true, cost: 'One Haiku call, < $0.01', built: true },
  { id: 'common-checklist', label: 'Cross-industry checklist', description: 'Machine-readability items from personas/_common.md.', default: true, cost: 'No extra cost by itself', built: true },
  { id: 'persona-checklist', label: 'Industry persona checklist', description: 'Visitor-goal items from personas/<slug>.md.', default: true, cost: 'No extra cost by itself', built: true },
  { id: 'deterministic', label: 'Deterministic checks', description: 'Code checks against the scraped HTML and layout probe.', default: true, cost: 'Free (no API calls)', built: true },
  { id: 'judgment', label: 'Judgment checks (vision)', description: 'Opus 5 evaluates judgment items from screenshots + text.', default: true, cost: 'About $0.10-0.30 per page on Opus 5', built: true },
  { id: 'subpath', label: 'Subpath candidate search', description: 'For unmet subpath items, pick and scrape up to 3 candidate pages each.', default: true, cost: '1 Firecrawl credit + one judgment call per candidate page', built: true },
  { id: 'desktop', label: 'Desktop screenshot', description: 'Secondary 1366x768 full-page screenshot of the home page.', default: true, cost: '1 Firecrawl credit', built: true },
  { id: 'facts', label: 'Facts extraction', description: 'Business name, phones, address, hours, services for the v2 builder.', default: true, cost: 'Free', built: true },
  { id: 'lighthouse', label: 'Lighthouse scores', description: 'Reserved: mobile + desktop Lighthouse categories (not built yet).', default: false, cost: 'Local Chrome, no API cost', built: false },
];

export type ModuleSet = Record<ModuleId, boolean>;

export interface ResolveModulesInput {
  enable?: string[];
  disable?: string[];
  config?: Partial<Record<string, boolean>>;
  industry?: string | null;
}

export interface ResolvedModules {
  modules: ModuleSet;
  warnings: string[];
  errors: string[];
}

export function defaultModules(): ModuleSet {
  return Object.fromEntries(MODULES.map((m) => [m.id, m.default])) as ModuleSet;
}

export function isModuleId(id: string): id is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(id);
}

export function resolveModules(input: ResolveModulesInput): ResolvedModules {
  const modules = defaultModules();
  const warnings: string[] = [];
  const errors: string[] = [];
  const apply = (id: string, on: boolean, via: string) => {
    if (!isModuleId(id)) {
      errors.push(`unknown module "${id}" (${via}); valid: ${MODULE_IDS.join(', ')}`);
      return;
    }
    const def = MODULES.find((m) => m.id === id)!;
    if (on && !def.built) {
      errors.push(`module "${id}" is not built yet`);
      return;
    }
    modules[id] = on;
  };
  for (const [id, on] of Object.entries(input.config ?? {})) apply(id, !!on, 'config');
  for (const id of input.enable ?? []) apply(id, true, '--enable');
  for (const id of input.disable ?? []) apply(id, false, '--disable');

  if (!modules.classify && !input.industry) errors.push('module "classify" is off but no --industry <slug> was given');
  if (!modules.deterministic && !modules.judgment) warnings.push('both "deterministic" and "judgment" are off: no checklist items will be evaluated');
  if (!modules['common-checklist'] && !modules['persona-checklist']) warnings.push('both checklists are off: no items will be loaded');
  if (modules.subpath && !modules.deterministic && !modules.judgment) warnings.push('"subpath" has no effect while both check modules are off');
  return { modules, warnings, errors };
}

export function parseList(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
