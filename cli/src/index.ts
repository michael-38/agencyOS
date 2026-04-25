#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PipelineInput, BusinessType, CLIOptions } from './types.js';
import { runSingle, runBatch } from './pipeline.js';
import { log } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function parseInputFile(filePath: string): Promise<PipelineInput[]> {
  const ext = path.extname(filePath).toLowerCase();
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  if (ext === '.csv') {
    return parseCsv(fullPath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return await parseXlsx(fullPath);
  } else if (ext === '.txt') {
    return parseTxt(fullPath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv, .xlsx, or .txt`);
  }
}

function parseCsv(filePath: string): PipelineInput[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
  const urlIdx = header.findIndex((h) => h === 'url' || h === 'website' || h === 'site');
  const typeIdx = header.findIndex((h) => h === 'type' || h === 'industry' || h === 'category');
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'phone_override');

  if (urlIdx === -1) {
    throw new Error('CSV must have a "url" column');
  }

  return lines.slice(1).filter((line) => line.trim()).map((line) => {
    const cols = parseCSVLine(line);
    const url = cols[urlIdx]?.trim();

    if (!url) return null;

    return {
      url: normalizeUrl(url),
      typeOverride: typeIdx >= 0 ? (cols[typeIdx]?.trim() as BusinessType) || undefined : undefined,
      phoneOverride: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || undefined : undefined,
    };
  }).filter(Boolean) as PipelineInput[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function parseXlsx(filePath: string): Promise<PipelineInput[]> {
  let XLSX: any;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('xlsx package not found. Run: npm install xlsx');
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  return rows.map((row: any) => {
    const url = row.url || row.URL || row.website || row.Website || row.site || row.Site;
    if (!url) return null;

    const type = row.type || row.Type || row.industry || row.Industry || row.category;
    const phone = row.phone || row.Phone || row.phone_override;

    return {
      url: normalizeUrl(String(url)),
      typeOverride: type ? (String(type).toLowerCase() as BusinessType) : undefined,
      phoneOverride: phone ? String(phone) : undefined,
    };
  }).filter(Boolean) as PipelineInput[];
}

function parseTxt(filePath: string): PipelineInput[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .trim()
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => ({
      url: normalizeUrl(line.trim()),
    }));
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

const program = new Command();

program
  .name('siterefresh')
  .description('Scrape outdated contractor websites, improve with AI, deploy modern landing pages')
  .version('1.0.0');

program
  .argument('[url]', 'URL of the website to rebuild')
  .option('--batch <file>', 'Process multiple URLs from a CSV, XLSX, or TXT file')
  .option('--type <type>', 'Override business type (roofing, hvac, plumbing)')
  .option('--phone <phone>', 'Override phone number')
  .option('--deploy <target>', 'Deployment target (surge, netlify)', 'surge')
  .option('--dry-run', 'Generate HTML locally without deploying', false)
  .option('--output <dir>', 'Output directory', path.resolve(__dirname, '../output'))
  .option('--verbose', 'Show detailed output', false)
  .option('--concurrency <n>', 'Number of concurrent sites to process', '3')
  .action(async (url: string | undefined, opts: any) => {
    const options: CLIOptions = {
      type: opts.type as BusinessType | undefined,
      phone: opts.phone,
      deploy: opts.deploy,
      dryRun: opts.dryRun,
      output: opts.output,
      verbose: opts.verbose,
      batch: opts.batch,
      concurrency: Math.max(1, Math.min(10, parseInt(opts.concurrency, 10) || 3)),
    };

    // Ensure output directory exists
    fs.mkdirSync(options.output, { recursive: true });

    // Validate env vars
    if (!process.env.FIRECRAWL_API_KEY) {
      log.error('Missing FIRECRAWL_API_KEY. Create a .env file or set the environment variable.');
      log.info('Get your API key at https://firecrawl.dev');
      process.exit(1);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      log.error('Missing ANTHROPIC_API_KEY. Create a .env file or set the environment variable.');
      log.info('Get your API key at https://console.anthropic.com');
      process.exit(1);
    }

    try {
      if (options.batch) {
        // Batch mode
        const inputs = await parseInputFile(options.batch);

        if (inputs.length === 0) {
          log.error('No valid URLs found in the input file.');
          process.exit(1);
        }

        // Apply global type override if specified
        if (options.type) {
          inputs.forEach((input) => {
            if (!input.typeOverride) input.typeOverride = options.type;
          });
        }

        log.info(`Found ${inputs.length} URLs to process`);
        const result = await runBatch(inputs, options);

        process.exit(result.failCount > 0 ? 1 : 0);
      } else if (url) {
        // Single URL mode
        const input: PipelineInput = {
          url: normalizeUrl(url),
          typeOverride: options.type,
          phoneOverride: options.phone,
        };

        const result = await runSingle(input, options);

        process.exit(result.status === 'success' ? 0 : 1);
      } else {
        log.error('Provide a URL or use --batch <file>');
        log.info('Usage:');
        log.info('  npx tsx src/index.ts https://example.com');
        log.info('  npx tsx src/index.ts --batch leads.csv');
        log.info('  npx tsx src/index.ts https://example.com --dry-run');
        process.exit(1);
      }
    } catch (err: any) {
      log.error(err.message);
      if (options.verbose) {
        console.error(err);
      }
      process.exit(1);
    }
  });

program.parse();
