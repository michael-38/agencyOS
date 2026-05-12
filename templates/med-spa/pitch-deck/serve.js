#!/usr/bin/env node
// Static server for the med-spa pitch deck. No dependencies.
// Usage: node serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = parseInt(process.argv[2] || '8766', 10);
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '') url = '/index.html';
  const filePath = path.join(ROOT, url);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403).end(); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const accept = (req.headers['accept-encoding'] || '').toLowerCase();
    const useGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(accept);
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=604800, immutable';

    const headers = {
      'Content-Type': type,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    };
    if (useGzip) headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    if (useGzip) stream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
    else stream.pipe(res);
  });
}).listen(PORT, () => {
  console.log(`pitch deck · http://localhost:${PORT}/`);
});
