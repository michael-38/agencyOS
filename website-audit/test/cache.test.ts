import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OfflineMissError, RunCache, canonicalJson, sha256 } from '../src/cache.js';
import { tmpDir } from './helpers.js';

test('canonicalJson is key-order independent and drops undefined', () => {
  assert.equal(canonicalJson({ b: 1, a: [3, { z: 1, y: undefined }] }), canonicalJson({ a: [3, { z: 1 }], b: 1 }));
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: 2 }));
  assert.equal(sha256('x'), sha256(Buffer.from('x')));
});

test('cached(): miss calls fn once, identical request (any key order) hits', async () => {
  const dir = tmpDir();
  const cache = new RunCache(dir, null, false);
  let calls = 0;
  const fn = async () => {
    calls++;
    return { value: { ok: true, n: calls } };
  };
  const a = await cache.cached('map', { origin: 'https://x.com', opts: { limit: 100, sitemap: 'include' } }, fn);
  assert.equal(a.hit, false);
  assert.equal(calls, 1);
  const b = await cache.cached('map', { opts: { sitemap: 'include', limit: 100 }, origin: 'https://x.com' }, fn);
  assert.equal(b.hit, true);
  assert.equal(b.source, 'run');
  assert.deepEqual(b.value, { ok: true, n: 1 });
  assert.equal(calls, 1);
  assert.equal(a.key, b.key);
  assert.deepEqual(cache.stats, { hits: 1, misses: 1, sourceHits: 0 });
  assert.ok(fs.existsSync(path.join(dir, 'cache', 'index.json')));
  assert.ok(fs.existsSync(path.join(dir, 'cache', 'map', `${a.key}.json`)));
});

test('registered files are sha256-validated; a changed file invalidates the entry', async () => {
  const dir = tmpDir();
  const cache = new RunCache(dir, null, false);
  const rel = path.join('raw', 'pages', 'k', 'mobile.png');
  fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), 'PNG-1');
  let calls = 0;
  const fn = async () => {
    calls++;
    return { value: { screenshotPath: rel }, files: [rel] };
  };
  await cache.cached('scrape', { url: 'https://x.com/' }, fn);
  assert.equal((await cache.cached('scrape', { url: 'https://x.com/' }, fn)).hit, true);
  fs.writeFileSync(path.join(dir, rel), 'PNG-2');
  const again = await cache.cached('scrape', { url: 'https://x.com/' }, fn);
  assert.equal(again.hit, false);
  assert.equal(calls, 2);
  fs.rmSync(path.join(dir, rel));
  assert.equal(cache.get('scrape', cache.key('scrape', { url: 'https://x.com/' })), null);
});

test('--from-cache: a source-run hit imports the value and its files into the new run', async () => {
  const src = tmpDir('src-');
  const a = new RunCache(src, null, false);
  const rel = path.join('raw', 'pages', 'k', 'mobile.png');
  fs.mkdirSync(path.join(src, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(src, rel), 'PNG');
  await a.cached('scrape', { url: 'https://x.com/' }, async () => ({ value: { screenshotPath: rel }, files: [rel] }));

  const dst = tmpDir('dst-');
  const b = new RunCache(dst, src, false);
  let called = false;
  const r = await b.cached('scrape', { url: 'https://x.com/' }, async () => {
    called = true;
    return { value: { nope: true } };
  });
  assert.equal(called, false);
  assert.equal(r.hit, true);
  assert.equal(r.source, 'source');
  assert.deepEqual(r.value, { screenshotPath: rel });
  assert.equal(fs.readFileSync(path.join(dst, rel), 'utf8'), 'PNG');
  assert.deepEqual(b.stats, { hits: 1, misses: 0, sourceHits: 1 });
  // Now it is a plain run hit in the new dir too.
  const c = new RunCache(dst, null, false);
  assert.equal((await c.cached('scrape', { url: 'https://x.com/' }, async () => ({ value: null }))).source, 'run');
  assert.throws(() => new RunCache(tmpDir(), path.join(src, 'missing'), false), /no cache\/index\.json/);
});

test('--offline turns a miss into OfflineMissError and never calls fn', async () => {
  const dir = tmpDir();
  const cache = new RunCache(dir, null, true);
  let called = false;
  await assert.rejects(
    cache.cached('llm', { step: 'x' }, async () => {
      called = true;
      return { value: 1 };
    }),
    (e: unknown) => e instanceof OfflineMissError && /cache miss for llm/.test((e as Error).message),
  );
  assert.equal(called, false);
});

test('keys differ by kind and by request; put/get round-trip', () => {
  const dir = tmpDir();
  const cache = new RunCache(dir, null, false);
  const k1 = cache.key('map', { a: 1 });
  assert.notEqual(k1, cache.key('scrape', { a: 1 }));
  assert.notEqual(k1, cache.key('map', { a: 2 }));
  cache.put('map', k1, { hello: 'world' });
  assert.deepEqual(cache.get('map', k1)?.value, { hello: 'world' });
  assert.equal(cache.get('scrape', k1), null);
});
