import fs from 'fs';
import path from 'path';
import ora from 'ora';
import {
  PipelineInput,
  PipelineResult,
  BatchResult,
  BusinessType,
  CLIOptions,
} from './types.js';
import { scrapeWebsite } from './scraper.js';
import { classifyBusiness, extractBusinessData, rewriteCopy } from './analyzer.js';
import { populateTemplate } from './populator.js';
import { deploy, DeployTarget } from './deployer.js';
import { slugify } from './utils/phone.js';
import { log } from './utils/logger.js';

export async function runSingle(
  input: PipelineInput,
  options: CLIOptions
): Promise<PipelineResult> {
  const startTime = Date.now();
  const spinner = ora();

  try {
    // Step 1: Scrape
    spinner.start('Scraping website...');
    const scrapeResult = await scrapeWebsite(input.url, options.verbose);
    spinner.succeed(`Scraped ${scrapeResult.pages.length} pages`);

    // Step 2: Classify
    let businessType: BusinessType;
    if (input.typeOverride) {
      businessType = input.typeOverride;
      log.info(`Using specified type: ${businessType}`);
    } else {
      spinner.start('Classifying business type...');
      const classification = await classifyBusiness(scrapeResult, options.verbose);
      businessType = classification.type;

      if (classification.confidence < 0.7) {
        log.warn(
          `Low confidence (${classification.confidence}) for type "${businessType}". ` +
          `Use --type to override if incorrect.`
        );
      }

      spinner.succeed(`Classified as: ${businessType} (${Math.round(classification.confidence * 100)}% confidence)`);
    }

    // Step 3: Extract structured data
    spinner.start('Extracting business data...');
    const data = await extractBusinessData(
      scrapeResult,
      businessType,
      input.phoneOverride,
      options.verbose
    );
    spinner.succeed(`Extracted data for "${data.companyName}"`);

    // Step 4: Rewrite copy
    spinner.start('Generating optimized copy...');
    const copy = await rewriteCopy(data, options.verbose);
    spinner.succeed('Copy generated');

    // Step 5: Populate template
    spinner.start('Building landing page...');
    const html = populateTemplate(businessType, data, copy);

    // Write output
    const slug = slugify(data.companyName);
    const outputDir = path.resolve(options.output, slug);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    spinner.succeed(`Page built: ${outputPath}`);

    // Step 6: Deploy
    let liveUrl: string | null = null;
    const deployTarget: DeployTarget = options.dryRun ? 'none' : (options.deploy as DeployTarget);

    if (deployTarget !== 'none') {
      spinner.start('Deploying...');
      liveUrl = await deploy(outputDir, data.companyName, deployTarget);
      spinner.succeed(`Live at: ${liveUrl}`);
    }

    const duration = Date.now() - startTime;

    // Summary
    log.header('Result');
    log.result('Company', data.companyName);
    log.result('Type', businessType);
    log.result('Phone', data.phone);
    log.result('City', `${data.primaryCity}, ${data.address?.state || ''}`);
    log.result('Output', outputPath);
    if (liveUrl) log.result('Live URL', liveUrl);
    log.result('Time', `${Math.round(duration / 1000)}s`);

    return {
      originalUrl: input.url,
      companyName: data.companyName,
      businessType,
      liveUrl,
      outputPath,
      status: 'success',
      duration,
    };
  } catch (err: any) {
    spinner.fail(err.message);
    const duration = Date.now() - startTime;

    return {
      originalUrl: input.url,
      companyName: 'Unknown',
      businessType: input.typeOverride || 'unknown',
      liveUrl: null,
      outputPath: '',
      status: 'failed',
      error: err.message,
      duration,
    };
  }
}

export async function runBatch(
  inputs: PipelineInput[],
  options: CLIOptions
): Promise<BatchResult> {
  const startTime = Date.now();
  const results: PipelineResult[] = [];
  const concurrency = options.concurrency;

  log.header(`Processing ${inputs.length} sites (concurrency: ${concurrency})`);

  // Process in batches
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(inputs.length / concurrency);

    log.divider();
    log.info(`Batch ${batchNum}/${totalBatches} (${batch.length} sites)`);

    const batchResults = await Promise.allSettled(
      batch.map((input, idx) => {
        log.step(i + idx + 1, inputs.length, input.url);
        return runSingle(input, options);
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          originalUrl: 'unknown',
          companyName: 'Unknown',
          businessType: 'roofing',
          liveUrl: null,
          outputPath: '',
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
          duration: 0,
        });
      }
    }
  }

  const totalTime = Date.now() - startTime;
  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount = results.filter((r) => r.status === 'failed').length;

  // Write results CSV
  const csvPath = path.resolve(options.output, 'results.csv');
  const csvHeader = 'original_url,company_name,type,live_url,output_path,status,error\n';
  const esc = (s: string) => s.replace(/"/g, '""');
  const csvRows = results
    .map(
      (r) =>
        `"${esc(r.originalUrl)}","${esc(r.companyName)}","${esc(r.businessType)}","${esc(r.liveUrl || '')}","${esc(r.outputPath)}","${esc(r.status)}","${esc(r.error || '')}"`
    )
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');

  // Summary
  log.header('Batch Complete');
  log.result('Total', `${inputs.length} sites`);
  log.result('Success', `${successCount}`);
  log.result('Failed', `${failCount}`);
  log.result('Time', `${Math.round(totalTime / 1000)}s`);
  log.result('Results CSV', csvPath);
  log.divider();

  if (failCount > 0) {
    log.warn('Failed sites:');
    results
      .filter((r) => r.status === 'failed')
      .forEach((r) => log.error(`  ${r.originalUrl}: ${r.error}`));
  }

  return {
    results,
    totalTime,
    successCount,
    failCount,
    outputCsvPath: csvPath,
  };
}
