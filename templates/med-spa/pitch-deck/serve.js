#!/usr/bin/env node
// Lightweight static server with gzip + Cache-Control for accurate Lighthouse runs.
// Also exposes POST /api/chat which proxies the visitor concierge widget to Anthropic.
//
// This file is GENERIC and identical across every client demo. Do NOT customize it per
// client — per-client setup lives in two sibling files (both optional), loaded from this
// directory at startup:
//   • concierge-prompt.md  — the concierge system prompt (plain Markdown). Required for chat.
//   • concierge.json       — { "label", "model", "maxTokens", "port", "fallbackReply" } (all optional).
// With no concierge-prompt.md the server still serves static files; /api/chat returns 503.
//
// Usage: node serve.js [port]
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Load ANTHROPIC_API_KEY from .env if present (no dotenv dep — keep template zero-install).
(function loadDotenv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* ignore */ }
})();

const ROOT = __dirname;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ---- Per-client concierge config (concierge-prompt.md + concierge.json, both in this dir) ----
const CONCIERGE = (function loadConcierge() {
  const cfg = {
    label: 'demo',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 400,
    port: 8765,
    fallbackReply: "I'm not sure how to help with that — could you tell me a bit more about what you're looking for?",
    systemPrompt: null,
  };
  try {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'concierge.json'), 'utf8'));
    for (const k of ['label', 'model', 'fallbackReply']) {
      if (typeof json[k] === 'string' && json[k].trim()) cfg[k] = json[k].trim();
    }
    if (Number.isFinite(json.maxTokens)) cfg.maxTokens = json.maxTokens;
    if (Number.isFinite(json.port)) cfg.port = json.port;
  } catch { /* no concierge.json — use defaults */ }
  try {
    const prompt = fs.readFileSync(path.join(__dirname, 'concierge-prompt.md'), 'utf8').trim();
    if (prompt) cfg.systemPrompt = prompt;
  } catch { /* no concierge-prompt.md — chat stays disabled */ }
  return cfg;
})();

const chatEnabled = () => Boolean(CONCIERGE.systemPrompt && process.env.ANTHROPIC_API_KEY);

// Port resolution: CLI arg (`node serve.js 9000`) wins, else concierge.json "port", else 8765.
const PORT = parseInt(process.argv[2], 10) || CONCIERGE.port;

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
  '.mp4':  'video/mp4',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);

// Per-IP token-bucket so a single visitor can't burn the API key.
const RATE = { capacity: 12, refillPerMs: 12 / (60 * 1000) }; // 12 messages/minute
const buckets = new Map();
function rateLimitOk(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: RATE.capacity, ts: now };
  b.tokens = Math.min(RATE.capacity, b.tokens + (now - b.ts) * RATE.refillPerMs);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(ip, b); return false; }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

function readJsonBody(req, max = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const m of input.slice(-20)) {
    if (!m || typeof m !== 'object') continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof m.content === 'string' ? m.content : '';
    const trimmed = content.trim().slice(0, 2000);
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  // Anthropic requires the first message to be a user turn.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

function callAnthropic(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CONCIERGE.model,
      max_tokens: CONCIERGE.maxTokens,
      system: CONCIERGE.systemPrompt,
      messages,
    });
    const req = https.request(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`anthropic ${res.statusCode}: ${raw.slice(0, 400)}`));
          return;
        }
        try {
          const data = JSON.parse(raw);
          const text = (data.content || [])
            .filter((p) => p && p.type === 'text')
            .map((p) => p.text)
            .join('\n')
            .trim();
          resolve(text || CONCIERGE.fallbackReply);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleChat(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  if (!rateLimitOk(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many messages. Please slow down.' }));
    return;
  }
  if (!CONCIERGE.systemPrompt) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Chat is not configured. Add a concierge-prompt.md file alongside serve.js.' }));
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Chat is not configured. Add ANTHROPIC_API_KEY to a .env file alongside serve.js.' }));
    return;
  }
  let body;
  try { body = await readJsonBody(req); }
  catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request body.' }));
    return;
  }
  const messages = sanitizeMessages(body.messages);
  if (!messages.length) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No message provided.' }));
    return;
  }
  try {
    const reply = await callAnthropic(messages);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ reply }));
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'The concierge is unavailable right now. Please try again or book a consult above.' }));
  }
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') { handleChat(req, res); return; }

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
  console.log(`${CONCIERGE.label} · http://localhost:${PORT}/`);
  if (!chatEnabled()) {
    const why = !CONCIERGE.systemPrompt ? 'add concierge-prompt.md' : 'add ANTHROPIC_API_KEY to .env';
    console.log(`  (concierge chat disabled — ${why} to enable)`);
  }
});
