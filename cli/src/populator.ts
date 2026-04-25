import * as fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { BusinessType, ExtractedBusinessData, RewrittenCopy } from './types.js';
import { populateRoofingTemplate } from './populators/roofing.js';
import { populateHvacTemplate } from './populators/hvac.js';
import { populatePlumbingTemplate } from './populators/plumbing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, '../../templates');

const populators: Record<BusinessType, (html: string, data: ExtractedBusinessData, copy: RewrittenCopy) => string> = {
  roofing: populateRoofingTemplate,
  hvac: populateHvacTemplate,
  plumbing: populatePlumbingTemplate,
};

export function populateTemplate(
  templateType: BusinessType,
  data: ExtractedBusinessData,
  copy: RewrittenCopy,
): string {
  const templatePath = path.join(templatesDir, templateType, 'index.html');
  const rawHtml = fs.readFileSync(templatePath, 'utf-8');

  const populate = populators[templateType];
  if (!populate) {
    throw new Error(`No populator for template type: ${templateType}`);
  }

  return populate(rawHtml, data, copy);
}
