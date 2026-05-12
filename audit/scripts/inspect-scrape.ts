import 'dotenv/config';
import fs from 'fs';
import { scrapeSite } from '../src/extractors/scrape.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: tsx scripts/inspect-scrape.ts <url>');
  process.exit(1);
}

const out = await scrapeSite(url);
const mdPath = '/tmp/scrape-md.txt';
const htmlPath = '/tmp/scrape-html.txt';
fs.writeFileSync(mdPath, out.markdown);
fs.writeFileSync(htmlPath, out.html);

console.log(`markdown: ${out.markdown.length} chars  → ${mdPath}`);
console.log(`html:     ${out.html.length} chars  → ${htmlPath}`);
console.log(`title:    ${out.title}`);
console.log(`finalUrl: ${out.finalUrl}`);

const needles = ['hour', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'open', 'close', 'am', 'pm', 'mon-fri', 'mon -', '9:00', '10:00', '5:00', '6:00'];
console.log('\n--- "hours-ish" hits in markdown ---');
for (const n of needles) {
  const re = new RegExp(`.{0,50}${n}.{0,50}`, 'gi');
  const matches = out.markdown.match(re);
  if (matches && matches.length > 0) {
    console.log(`[${n}] (${matches.length})`);
    for (const m of matches.slice(0, 3)) console.log(`  …${m.replace(/\s+/g, ' ').trim()}…`);
  }
}

console.log('\n--- last 1500 chars of markdown (footer-ish region) ---');
console.log(out.markdown.slice(-1500));
