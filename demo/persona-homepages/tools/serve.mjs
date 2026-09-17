#!/usr/bin/env node
// Static preview server for the persona home pages.
//
// Each page is authored as a production site rooted at its own mock domain, so its canonical,
// og:url, sitemap and llms.txt all carry absolute URLs. Serving it from localhost would make
// those URLs cross-origin, which is a testing artefact rather than a real defect, Lighthouse's
// canonical audit, for example, would flag a canonical it would pass in production. So the
// server rewrites each site's own origin to the origin it is actually being served from, which
// is exactly what the page looks like once deployed.
//
//   node tools/serve.mjs [port]        → http://127.0.0.1:8099/<slug>/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8099);

/** slug → the mock production origin the page was authored against. */
export function siteOrigins(root = ROOT) {
  const out = new Map();
  for (const slug of fs.readdirSync(root)) {
    const file = path.join(root, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const m = /<link rel="canonical" href="(https?:\/\/[^/"]+)/.exec(fs.readFileSync(file, 'utf8'));
    if (m) out.set(slug, m[1]);
  }
  return out;
}

const ORIGINS = siteOrigins();
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const REWRITABLE = new Set(['.html', '.md', '.txt', '.xml']);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }
  const ext = path.extname(file);
  const headers = {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (!REWRITABLE.has(ext)) {
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
    return;
  }
  const slug = rel.split('/').filter(Boolean)[0];
  const origin = ORIGINS.get(slug);
  let body = fs.readFileSync(file, 'utf8');
  if (origin) body = body.split(origin).join(`http://${req.headers.host}/${slug}`);
  res.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(body) });
  res.end(body);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`serving ${ROOT} on http://127.0.0.1:${PORT}/\n`);
  for (const slug of [...ORIGINS.keys()].sort()) process.stdout.write(`  http://127.0.0.1:${PORT}/${slug}/\n`);
});
