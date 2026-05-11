#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditInput, CLIOptions, ModuleId } from './types.js';
import { log } from './utils/logger.js';
import { normalizeUrl } from './utils/url.js';
import { runBatch, runSingle } from './pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_MODULES: ModuleId[] = [
  'lighthouse',
  'seo-onpage',
  'seo-ranking',
  'traffic-metrics',
  'llm-copy-aeo',
  'llm-discoverability',
  'copy-conversion',
  'design-review',
  'ux-medspa',
];

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function parseBatchFile(filePath: string): Promise<AuditInput[]> {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  const ext = path.extname(fullPath).toLowerCase();

  if (ext === '.csv') return parseCsv(fullPath);
  if (ext === '.xlsx' || ext === '.xls') return parseXlsxAsync(fullPath);
  if (ext === '.txt') return parseTxt(fullPath);
  throw new Error(`Unsupported batch file format: ${ext}`);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsv(filePath: string): AuditInput[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV must have header + at least one row.');
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxUrl = header.findIndex((h) => h === 'url' || h === 'website' || h === 'site');
  const idxName = header.findIndex((h) => h === 'name' || h === 'clinic');
  const idxCity = header.findIndex((h) => h === 'city');
  const idxKw = header.findIndex((h) => h === 'keywords');
  if (idxUrl === -1) throw new Error('CSV must have a "url" column.');

  return lines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .map((cols) => {
      const url = cols[idxUrl]?.replace(/"/g, '').trim();
      if (!url) return null;
      return {
        url: normalizeUrl(url),
        nameOverride: idxName >= 0 ? cols[idxName]?.replace(/"/g, '').trim() || undefined : undefined,
        cityOverride: idxCity >= 0 ? cols[idxCity]?.replace(/"/g, '').trim() || undefined : undefined,
        keywordsOverride:
          idxKw >= 0 && cols[idxKw]
            ? cols[idxKw].replace(/"/g, '').split('|').map((s) => s.trim()).filter(Boolean)
            : undefined,
      } as AuditInput;
    })
    .filter(Boolean) as AuditInput[];
}

async function parseXlsxAsync(filePath: string): Promise<AuditInput[]> {
  const XLSX: any = await import('xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws);
  return rows
    .map((row) => {
      const url = row.url || row.URL || row.website || row.Website;
      if (!url) return null;
      return {
        url: normalizeUrl(String(url)),
        nameOverride: row.name || row.Name || row.clinic || undefined,
        cityOverride: row.city || row.City || undefined,
        keywordsOverride: row.keywords ? String(row.keywords).split('|').map((s: string) => s.trim()) : undefined,
      } as AuditInput;
    })
    .filter(Boolean) as AuditInput[];
}

function parseTxt(filePath: string): AuditInput[] {
  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((url) => ({ url: normalizeUrl(url) }));
}

const program = new Command();

program
  .name('medspa-audit')
  .description('Comprehensive med spa website audit → shareable HTML dashboard')
  .version('0.1.0');

program
  .argument('[url]', 'URL of the clinic website')
  .option('--batch <file>', 'CSV/XLSX/TXT of URLs (primary mode for sales prospecting)')
  .option('--output <dir>', 'Output directory', path.resolve(__dirname, '../output'))
  .option('--concurrency <n>', 'Number of clinics to audit in parallel', '2')
  .option('--skip <list>', 'Comma-separated module ids to skip')
  .option('--enable <list>', 'Comma-separated module ids to re-enable (overrides built-in defaults). E.g. --enable design-review,ux-medspa')
  .option('--keywords <list>', 'Comma-separated SEO keyword overrides')
  .option('--open', 'Open report.html when done (single URL only)', false)
  .option('--index', 'Generate output/index.html summary across the batch', false)
  .option('--max-pages <n>', 'Max pages to crawl per clinic (Firecrawl)', '15')
  .option('--max-corpus <n>', 'Max chars of site corpus sent to LLM modules', '100000')
  .option('--shallow-design', 'Fall back to 2 screenshots (home only) instead of the default 6', false)
  .option('--budget <usd>', 'Hard abort if estimated cost exceeds this (USD). Pass 0 to disable.', '0.50')
  .option('--verbose', 'Verbose logging', false)
  .action(async (url: string | undefined, opts: any) => {
    const skipRaw = parseList(opts.skip);
    const skip: ModuleId[] = skipRaw.filter((s): s is ModuleId => (VALID_MODULES as string[]).includes(s));
    const invalid = skipRaw.filter((s) => !(VALID_MODULES as string[]).includes(s));
    if (invalid.length) {
      log.error(`Unknown --skip module(s): ${invalid.join(', ')}`);
      log.info(`Valid: ${VALID_MODULES.join(', ')}`);
      process.exit(1);
    }

    const enableRaw = parseList(opts.enable);
    const enable: ModuleId[] = enableRaw.filter((s): s is ModuleId => (VALID_MODULES as string[]).includes(s));
    const invalidEnable = enableRaw.filter((s) => !(VALID_MODULES as string[]).includes(s));
    if (invalidEnable.length) {
      log.error(`Unknown --enable module(s): ${invalidEnable.join(', ')}`);
      log.info(`Valid: ${VALID_MODULES.join(', ')}`);
      process.exit(1);
    }

    const options: CLIOptions = {
      output: opts.output,
      batch: opts.batch,
      concurrency: Math.max(1, Math.min(10, parseInt(opts.concurrency, 10) || 2)),
      skip,
      enable,
      keywords: parseList(opts.keywords).length ? parseList(opts.keywords) : undefined,
      open: !!opts.open,
      index: !!opts.index,
      verbose: !!opts.verbose,
      maxPages: Math.max(1, Math.min(50, parseInt(opts.maxPages, 10) || 15)),
      maxCorpus: Math.max(10_000, parseInt(opts.maxCorpus, 10) || 100_000),
      shallowDesign: !!opts.shallowDesign,
      budget: Math.max(0, parseFloat(opts.budget) || 0),
    };

    fs.mkdirSync(options.output, { recursive: true });

    if (!process.env.ANTHROPIC_API_KEY) {
      log.error('ANTHROPIC_API_KEY is required (set in .env).');
      process.exit(1);
    }
    if (!process.env.FIRECRAWL_API_KEY) {
      log.error('FIRECRAWL_API_KEY is required (set in .env).');
      process.exit(1);
    }
    for (const [name, key] of [
      ['SERPAPI_API_KEY', 'seo-ranking module'],
      ['PERPLEXITY_API_KEY', 'llm-discoverability (Perplexity leg)'],
      ['OPENAI_API_KEY', 'llm-discoverability (ChatGPT leg)'],
      ['DATAFORSEO_LOGIN', 'traffic-metrics module'],
      ['DATAFORSEO_PASSWORD', 'traffic-metrics module'],
    ] as const) {
      if (!process.env[name]) log.warn(`${name} not set — ${key} will be skipped or partial.`);
    }

    try {
      if (options.batch) {
        const inputs = await parseBatchFile(options.batch);
        if (inputs.length === 0) {
          log.error('No URLs found in batch file.');
          process.exit(1);
        }
        log.info(`Processing ${inputs.length} URL(s) with concurrency ${options.concurrency}…`);
        const entries = await runBatch(inputs, options);
        const failed = entries.filter((e) => e.status === 'failed').length;
        log.divider();
        log.info(`Done. ${entries.length - failed} succeeded, ${failed} failed.`);
        process.exit(failed === entries.length ? 1 : 0);
      } else if (url) {
        const input: AuditInput = { url: normalizeUrl(url) };
        await runSingle(input, options);
        process.exit(0);
      } else {
        log.error('Provide a URL or --batch <file>.');
        log.info('Examples:');
        log.info('  npx tsx src/index.ts https://example-medspa.com --open');
        log.info('  npx tsx src/index.ts --batch prospects.csv --index');
        process.exit(1);
      }
    } catch (err: any) {
      log.error(err.message);
      if (options.verbose) console.error(err);
      process.exit(1);
    }
  });

program.parse();
