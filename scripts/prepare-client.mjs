#!/usr/bin/env node
/**
 * scripts/prepare-client.mjs — the deterministic front half of /redesign-site.
 *
 *   node scripts/prepare-client.mjs <url> [slug] [--dry-run] [--force]
 *
 * Runs preflight, crawls, extracts NAP, harvests real imagery, seeds the client
 * design context, and emits prep-report.json. Everything lands on disk so the
 * orchestrating agent never carries page markdown or image bytes in context.
 *
 * Every step here encodes a failure this pipeline actually hit:
 *   - firecrawl_map on a SUB-PATH returns 0 links; map the root and filter.
 *   - onlyMainContent:true drops the footer, which is where NAP lives.
 *   - image hosts 403 a bare curl; a browser UA + Referer is required.
 *   - the med-spa archetype seeds a B2B owner-facing PRODUCT.md.
 *   - real file extensions must survive (.jpeg is not .jpg).
 *
 * Node built-ins only. No root package.json exists, so there are no deps.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const [rawUrl, slugArg] = argv.filter((a) => !a.startsWith('--'));
const DRY = flags.has('--dry-run');

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };
const say = (m) => console.log(m);

// ---------- env ----------------------------------------------------------
function loadEnv() {
  const f = path.join(REPO, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------- preflight ----------------------------------------------------
function preflight(slug) {
  const missing = [];
  if (!process.env.FIRECRAWL_API_KEY) missing.push('FIRECRAWL_API_KEY (crawl)');
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY (concierge, audit)');
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfAcct = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (cfToken && !cfAcct) missing.push('CLOUDFLARE_ACCOUNT_ID (required whenever the token is set)');
  if (missing.length) die(`preflight failed, add to ${REPO}/.env:\n       ` + missing.join('\n       '));
  if (!/^[a-z0-9]([a-z0-9-]{0,56}[a-z0-9])?$/.test(slug)) {
    die(`invalid slug "${slug}" — lowercase letters, digits, hyphens; no leading/trailing hyphen; max 58 chars`);
  }
  if (!cfToken) {
    say('  note: no CLOUDFLARE_API_TOKEN; deploy will fall back to cached wrangler OAuth');
  }
  say(`  preflight ok`);
}

// ---------- firecrawl ----------------------------------------------------
async function fc(endpoint, body) {
  const r = await fetch(`https://api.firecrawl.dev/v2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** Map the site ROOT. A sub-path returns zero links — the bug that yields a one-page crawl. */
async function mapRoot(url) {
  const root = new URL(url).origin;
  const j = await fc('map', { url: root, limit: 60 });
  if (!j.success) die(`map failed: ${j.error ?? JSON.stringify(j.errors ?? j).slice(0, 200)}`);
  const links = (j.links ?? []).map((l) => l.url).filter(Boolean);
  say(`  mapped ${links.length} urls from ${root}`);
  return [...new Set(links)];
}

const WANT = /(service|treatment|procedure|about|team|provider|staff|doctor|physician|contact|location|price|pricing|review|testimonial|financing|gallery|before|result|med.?spa|medical.spa)/i;
const SKIP = /(\/blog|\/tag\/|\/category\/|\/author\/|\/page\/|privacy|terms|sitemap|\/feed|\.xml$|\/wp-|cart|checkout|account|login)/i;

function pickPages(links, seedUrl, max = 10) {
  const seed = seedUrl.replace(/\/$/, '');
  const scored = links
    .filter((u) => !SKIP.test(u))
    .map((u) => {
      let s = 0;
      const p = new URL(u).pathname.replace(/\/$/, '');
      if (u.replace(/\/$/, '') === seed) s += 100;      // the page the user actually named
      if (p === '' || p === '/') s += 40;                // home
      if (WANT.test(u)) s += 20;
      s -= p.split('/').filter(Boolean).length * 2;      // prefer shallow
      return { u, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, max).map((x) => x.u);
}

/**
 * Boilerplate strip. audit/src/extractors/corpus.ts has a richer cleanPageMarkdown,
 * but it is TypeScript inside a separate package with its own node_modules and no
 * build output, so importing it from a dependency-free .mjs would be fragile.
 * Keep this list small and in sync deliberately rather than half-importing.
 */
function clean(md) {
  return md
    .split('\n')
    .filter((l) => !/^\[Skip to /.test(l))
    .filter((l) => !/\[Afrikaans\]|\[Zulu\]|gtranslate/i.test(l))
    .filter((l) => !/^(JanuaryFebruaryMarch|MonTueWed)/.test(l))
    .filter((l) => !/^\d{2,}$/.test(l.trim()))
    .filter((l) => !/^(NoYes|Are you over 18 years of age\?)$/.test(l.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const nameFor = (u) => {
  const p = new URL(u).pathname.replace(/^\/|\/$/g, '');
  return (p === '' ? 'home' : p.replace(/\//g, '_')).slice(0, 60);
};

// ---------- images -------------------------------------------------------
function pixelWidth(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', file], { encoding: 'utf8' });
    return parseInt(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? '0', 10);
  } catch { return 0; }
}

async function harvestImages(dir, mdFiles, pageUrl) {
  const urls = new Set();
  for (const f of mdFiles) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/!\[[^\]]*\]\((https:[^)\s]+)\)/g)) urls.add(m[1]);
  }
  const cand = [...urls].filter((u) => !/gtranslate|\/flags\/|favicon|\.svg(\?|$)|sprite|pixel|tracking/i.test(u));
  const stockSkipped = [];
  const seen = new Map();
  let kept = 0;
  const lines = [];
  for (const u of cand) {
    const base = path.basename(u.split('?')[0]);       // preserve the real extension
    const out = path.join(dir, base);
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: new URL(pageUrl).origin + '/' } });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (seen.has(hash)) continue;                     // dedupe by content, not filename
      fs.writeFileSync(out, buf);
      // `!w` matters: sips returns 0 for anything that is not an image, and an earlier
      // `w && w < 600` let an HTML error page through into assets/ as a fake photograph.
      const w = pixelWidth(out);
      if (!w || w < 600) { fs.unlinkSync(out); continue; }
      // Licensing: stock re-hosted on an agency demo is outside the client's licence.
      // Copyright/credit lives in EXIF even when the filename looks like a real photo.
      let exif = '';
      try { exif = execFileSync('sips', ['-g', 'all', out], { encoding: 'utf8' }); } catch {}
      if (/shutterstock|getty|istock|adobe ?stock|depositphotos|unsplash/i.test(exif)) {
        fs.unlinkSync(out); stockSkipped.push(base); continue;
      }
      if (w > 1400) { try { execFileSync('sips', ['-Z', '1400', out], { stdio: 'ignore' }); } catch {} }
      try { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', out, '--out', out], { stdio: 'ignore' }); } catch {}
      seen.set(hash, base);
      lines.push(`${base}  ${w || '?'}px  <- ${u}`);
      kept++;
    } catch { /* skip unreachable */ }
  }
  fs.writeFileSync(path.join(dir, 'PROVENANCE.txt'), lines.join('\n') + '\n');
  if (stockSkipped.length) console.log(`    skipped ${stockSkipped.length} stock-licensed image(s): ${stockSkipped.join(", ")}`);
  return kept;
}

// ---------- archetype + divergence --------------------------------------
function detectArchetype(corpus) {
  const c = corpus.toLowerCase();
  const hit = (re) => (c.match(re) ?? []).length;
  const scores = {
    'med-spa': hit(/botox|filler|aesthetic|dermatolog|med(ical)? spa|facial|microneedl|laser|injector|skin/g),
    roofing: hit(/roof|shingle|gutter|storm damage|hail/g),
    plumbing: hit(/plumb|drain|water heater|sewer|leak/g),
    hvac: hit(/hvac|furnace|air condition|heating|cooling|thermostat/g),
  };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return { archetype: best[1] > 0 ? best[0] : 'hvac', scores };
}

/**
 * Disjoint constraint pair so A and B can build IN PARALLEL and still cannot
 * converge. Replaces the old honour-system "B must not read A", which forced
 * serial execution and is what exhausted the context budget every run.
 */
function divergence(slug) {
  const n = parseInt(crypto.createHash('md5').update(slug).digest('hex').slice(0, 8), 16);
  const A_FACES = ['condensed-industrial', 'wide-engineered-grotesk', 'geometric-display'];
  const B_FACES = ['editorial-serif', 'humanist-sans', 'slab'];
  return {
    sharedNegativeFloor: {
      bannedFaces: ['Fraunces','Playfair Display','Cormorant','Lora','Crimson','Newsreader','Syne',
        'Space Grotesk','Space Mono','IBM Plex','Inter','DM Sans','DM Serif','Outfit',
        'Plus Jakarta Sans','Instrument Sans','Instrument Serif'],
      bannedClusters: [
        'warm cream ground + high-contrast serif display + terracotta/signal-red accent',
        'near-black + one neon accent + glowing edges',
        'broadsheet hairlines + italic display serif + tracked mono labels',
      ],
      alwaysBanned: ['eyebrows/kickers above headings', 'em dashes in visible text',
        'section numbers on non-sequential content', 'cards as page structure'],
    },
    a: { ground: 'dark', faceClass: A_FACES[n % A_FACES.length],
         colorStrategy: (n >> 3) % 2 ? 'Committed' : 'Drenched' },
    b: { ground: 'light', faceClass: B_FACES[(n >> 5) % B_FACES.length],
         colorStrategy: (n >> 7) % 2 ? 'Restrained' : 'Full palette' },
  };
}

// ---------- main ---------------------------------------------------------
(async () => {
  if (!rawUrl) die('usage: node scripts/prepare-client.mjs <url> [slug] [--dry-run] [--force]');
  loadEnv();
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const host = new URL(url).hostname.replace(/^www\./, '');
  // Only fold the path into the slug when it reads as a SECTION ("/medical-spa"), not an
  // article ("/top-med-spa-to-visit-in-utah"). The slug becomes the public URL you send a
  // client, so a blog-post path would produce something unsendable.
  const seg = new URL(url).pathname.replace(/^\/|\/$/g, '').split('/')[0] || '';
  const pathSeg = seg && seg.split('-').length <= 2 && seg.length <= 20 ? seg : '';
  const slug = (slugArg || `${host.split('.')[0]}${pathSeg ? '-' + pathSeg : ''}`)
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 58);

  say(`\nprepare-client  ${url}\n  slug: ${slug}`);
  preflight(slug);

  const links = await mapRoot(url);
  const pages = pickPages(links, url);
  say(`  selected ${pages.length} pages:`);
  pages.forEach((p) => say(`    ${p}`));
  if (DRY) { say('\n--dry-run: stopping before any write.\n'); process.exit(0); }

  const dir = path.join(REPO, 'clients', slug);
  for (const d of ['source-content', 'assets', 'briefs', '.impeccable', 'versions/a', 'versions/b', 'versions/compare']) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }

  const written = [];
  for (const p of pages) {
    const j = await fc('scrape', { url: p, formats: ['markdown'], onlyMainContent: true });
    const md = j?.data?.markdown;
    if (!md) { say(`    scrape FAILED ${p}`); continue; }
    const file = path.join(dir, 'source-content', `${nameFor(p)}.md`);
    fs.writeFileSync(file, `---\nurl: ${p}\n---\n\n${clean(md)}\n`);
    written.push(file);
  }
  say(`  scraped ${written.length} pages`);

  // NAP needs onlyMainContent:false — the footer carries address and hours.
  const nap = await fc('scrape', {
    url, onlyMainContent: false,
    formats: [{ type: 'json',
      prompt: 'Extract the published business name, phone, email, and every clinic/office location with full street address, city, state, zip, plus opening hours. Use null for anything absent; never guess.',
      schema: { type: 'object', properties: {
        businessName: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
        hours: { type: 'string' },
        locations: { type: 'array', items: { type: 'object', properties: {
          name: { type: 'string' }, streetAddress: { type: 'string' }, city: { type: 'string' },
          state: { type: 'string' }, zip: { type: 'string' }, phone: { type: 'string' } } } } } } }],
  });
  fs.writeFileSync(path.join(dir, 'source-content', 'nap.json'), JSON.stringify(nap?.data?.json ?? {}, null, 2));
  say(`  nap: ${nap?.data?.json?.phone ?? 'not found'}`);

  const images = await harvestImages(path.join(dir, 'assets'), written, url);
  say(`  images kept: ${images}`);

  const corpus = written.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const { archetype, scores } = detectArchetype(corpus);
  say(`  archetype: ${archetype}`);
  try {
    execFileSync('node', [path.join(REPO, '.impeccable/seed-client.mjs'), archetype, `clients/${slug}`,
      ...(flags.has('--force') ? ['--force'] : [])], { cwd: REPO, stdio: 'pipe' });
    say('  seeded DESIGN.md + PRODUCT.md');
  } catch (e) { say(`  seed warning: ${String(e.message).split('\n')[0]}`); }

  const report = {
    slug, sourceUrl: url, preparedAt: new Date().toISOString().slice(0, 10),
    archetype, archetypeScores: scores,
    pages: written.map((f) => path.relative(dir, f)),
    imagesKept: images,
    napPhone: nap?.data?.json?.phone ?? null,
    // med-spa seeds AgencyOS's own B2B pitch record aimed at spa OWNERS, not patients.
    audienceRewriteRequired: archetype === 'med-spa',
    divergence: divergence(slug),
    deployRoots: ['versions/a', 'versions/b', 'versions/compare'],
  };
  fs.writeFileSync(path.join(dir, '.impeccable', 'prep-report.json'), JSON.stringify(report, null, 2));

  say(`\n  report: clients/${slug}/.impeccable/prep-report.json`);
  if (report.audienceRewriteRequired) {
    say('  ACTION: archetype med-spa seeds a B2B owner-facing PRODUCT.md — the fact-sheet agent must rewrite it against patients.');
  }
  say(`  next: fact-sheet agent, then build A (${report.divergence.a.ground}) and B (${report.divergence.b.ground}) in parallel\n`);
})();
