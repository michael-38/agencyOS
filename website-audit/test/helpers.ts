// Shared test helpers: fixture loading, PageContext construction, temp repo builder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS } from '../src/config.js';
import type { PageContext, ProbeResult } from '../src/checks/registry.js';
import { loadDetectors, type Detectors } from '../src/personas/load.js';

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PKG_ROOT, '..');
export const FIXTURES = path.join(PKG_ROOT, 'test', 'fixtures');

let detectorsCache: Detectors | null = null;
export function detectors(): Detectors {
  if (!detectorsCache) detectorsCache = loadDetectors(REPO_ROOT);
  return detectorsCache;
}

export function fixture(rel: string): string {
  return fs.readFileSync(path.join(FIXTURES, rel), 'utf8');
}

export function probeFixture(name: string): ProbeResult {
  return JSON.parse(fixture(`pages/${name}.probe.json`)) as ProbeResult;
}

export function pageCtx(name: string, opts: { probe?: boolean; jsonldType?: string; markdown?: string } = {}): PageContext {
  const rawHtml = fixture(`pages/${name}.html`);
  const probePath = path.join(FIXTURES, 'pages', `${name}.probe.json`);
  const probe = opts.probe && fs.existsSync(probePath) ? probeFixture(name) : null;
  return {
    url: `https://${name}.example/`,
    rawHtml,
    markdown: opts.markdown ?? '',
    links: [],
    probe,
    viewport: { ...VIEWPORTS.mobile },
    detectors: detectors(),
    jsonldType: opts.jsonldType ?? 'LocalBusiness',
  };
}

export function tmpDir(prefix = 'website-audit-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Build a throwaway repo root with config/ + personas/ copied from the real repo, plus overrides. */
export function tempRepo(opts: {
  industries?: string;
  personas?: Record<string, string>;
} = {}): string {
  const dir = tmpDir('website-audit-repo-');
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'personas'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'config', 'detectors.yaml'), path.join(dir, 'config', 'detectors.yaml'));
  fs.writeFileSync(path.join(dir, 'config', 'industries.yaml'), opts.industries ?? fs.readFileSync(path.join(REPO_ROOT, 'config', 'industries.yaml'), 'utf8'));
  for (const f of ['_common.md', 'generic.md', 'landscaping.md']) {
    fs.copyFileSync(path.join(REPO_ROOT, 'personas', f), path.join(dir, 'personas', f));
  }
  for (const [name, content] of Object.entries(opts.personas ?? {})) {
    fs.writeFileSync(path.join(dir, 'personas', name), content);
  }
  return dir;
}

export const BASE_INDUSTRIES_YAML = `version: 1
archetypes:
  - id: local-service
    jsonld_type: LocalBusiness
    reference_file: templates/archetypes/local-service.md
  - id: generic
    jsonld_type: Organization
    reference_file: templates/archetypes/generic.md
industries:
  - slug: landscaping
    display_name: Landscaping
    aliases: []
    archetype: local-service
    persona_file: personas/landscaping.md
    template_file: templates/personas/landscaping/index.html
    build_reference_file: templates/personas/landscaping/reference.md
  - slug: generic
    display_name: Generic business
    aliases: []
    archetype: generic
    persona_file: personas/generic.md
    template_file: templates/personas/generic/index.html
    build_reference_file: templates/personas/generic/reference.md
`;
