// UI server tests: node:test + node:assert/strict, localhost only. The two CLI spawns (dry run, and a
// deliberately keyless run) hit no network: the pipeline throws on the blank FIRECRAWL_API_KEY before
// it creates anything or calls out.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createServer, hostFromUrl, timestampSlug, RUN_ID_RE } from './server.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..');

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

/** Raw http.request so the path is sent verbatim (fetch/URL would normalise `..` away). */
function request(port: number, method: string, p: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: p,
        headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) } : {}), ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const json = (r: Reply): unknown => JSON.parse(r.text);

test('ui server', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'website-audit-ui-'));
  const runsDir = path.join(tmp, 'runs');
  fs.mkdirSync(runsDir);
  // Sentinel sibling of runs/: must never be served through /runs/.
  const sentinel = 'SENTINEL_DO_NOT_SERVE_9f2c';
  fs.writeFileSync(path.join(tmp, '.env'), `SECRET=${sentinel}\n`);

  // A finished run on disk (no child process involved).
  const diskHost = 'example.com';
  const diskTs = '2026-01-01T00-00-00Z';
  const diskDir = path.join(runsDir, diskHost, diskTs);
  fs.mkdirSync(path.join(diskDir, 'raw', 'pages', 'home', 'mobile.tiles'), { recursive: true });
  const fakeReport = {
    input_url: 'example.com',
    home_url: 'https://example.com/',
    industry: { slug: 'generic', confidence: 1, source: 'override' },
    items: [],
    summary: { pass: 0, partial: 0, fail: 0, top_gaps: [], verdict: 'n/a', partial_audit: false, skipped: { modules: [], item_ids: [] } },
    pages: [],
    run_meta: { timestamps: { started: '2026-01-01T00:00:00.000Z', finished: '2026-01-01T00:01:00.000Z' }, modules: { classify: false }, credits_used: 2, anthropic_usd: 0.05, run_dir: diskDir },
  };
  fs.writeFileSync(path.join(diskDir, 'report.json'), JSON.stringify(fakeReport));
  fs.writeFileSync(path.join(diskDir, 'report.md'), '# fake\n');
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  fs.writeFileSync(path.join(diskDir, 'raw', 'pages', 'home', 'mobile.fold.png'), pngBytes);

  const server = createServer({
    repoRoot,
    packageRoot,
    runsDir,
    // Blank keys: the keyless run below must fail before any network call.
    childEnv: { ...process.env, FIRECRAWL_API_KEY: '', ANTHROPIC_API_KEY: '' },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await t.test('helpers', () => {
    assert.equal(hostFromUrl('Example.com/path'), 'example.com');
    assert.equal(hostFromUrl('https://WWW.Example.com:8443/x'), 'www.example.com');
    assert.equal(hostFromUrl(''), null);
    assert.match(timestampSlug(new Date('2026-09-14T15:04:22.123Z')), /^2026-09-14T15-04-22Z$/);
    assert.ok(RUN_ID_RE.test('example.com/2026-09-14T15-04-22Z'));
    assert.ok(!RUN_ID_RE.test('not-valid'));
    assert.ok(!RUN_ID_RE.test('../x/2026'));
  });

  await t.test('GET / serves the page', async () => {
    const r = await request(port, 'GET', '/');
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-type']), /text\/html/);
    assert.match(r.text, /<title>Website audit<\/title>/);
  });

  await t.test('GET /api/industries includes generic', async () => {
    const r = await request(port, 'GET', '/api/industries');
    assert.equal(r.status, 200);
    const list = json(r) as { slug: string; display_name: string }[];
    assert.ok(Array.isArray(list));
    assert.ok(list.some((i) => i.slug === 'generic'));
    for (const i of list) {
      assert.equal(typeof i.slug, 'string');
      assert.equal(typeof i.display_name, 'string');
    }
  });

  await t.test('GET /api/modules returns 9 modules, lighthouse not built', async () => {
    const r = await request(port, 'GET', '/api/modules');
    assert.equal(r.status, 200);
    const mods = json(r) as { id: string; built: boolean; label: string; cost: string; default: boolean }[];
    assert.equal(mods.length, 9);
    const lh = mods.find((m) => m.id === 'lighthouse');
    assert.ok(lh);
    assert.equal(lh.built, false);
    assert.ok(mods.find((m) => m.id === 'classify')?.built);
  });

  await t.test('GET /api/runs lists the on-disk run', async () => {
    const r = await request(port, 'GET', '/api/runs');
    assert.equal(r.status, 200);
    const runs = json(r) as Record<string, unknown>[];
    assert.ok(Array.isArray(runs));
    const entry = runs.find((x) => x.id === `${diskHost}/${diskTs}`);
    assert.ok(entry, 'on-disk run is listed');
    assert.equal(entry.host, diskHost);
    assert.equal(entry.timestamp, diskTs);
    assert.equal(entry.status, 'done');
    assert.equal(entry.verdict, 'n/a');
    assert.equal(entry.industry, 'generic');
    assert.equal(entry.credits_used, 2);
    assert.equal(entry.anthropic_usd, 0.05);
    assert.equal(entry.input_url, 'example.com');
    assert.deepEqual(entry.modules, { classify: false });
  });

  await t.test('GET /api/runs/:id/report returns report.json', async () => {
    const r = await request(port, 'GET', `/api/runs/${diskHost}/${diskTs}/report`);
    assert.equal(r.status, 200);
    assert.equal(r.headers['x-audit-status'], 'done');
    assert.deepEqual(json(r), fakeReport);

    const missing = await request(port, 'GET', `/api/runs/nope.example/2026-01-01T00-00-00Z/report`);
    assert.equal(missing.status, 404);
    assert.equal((json(missing) as { status: string }).status, 'error');
  });

  await t.test('GET /api/runs/:id/events for a finished on-disk run ends with event: done', async () => {
    const r = await request(port, 'GET', `/api/runs/${diskHost}/${diskTs}/events`);
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-type']), /text\/event-stream/);
    assert.match(r.text, /^event: done$/m);
  });

  await t.test('invalid run ids are rejected', async () => {
    const a = await request(port, 'GET', '/api/runs/not-valid/events');
    assert.ok(a.status === 400 || a.status === 404, `got ${a.status}`);
    const b = await request(port, 'GET', '/api/runs/not-valid/report');
    assert.ok(b.status === 400 || b.status === 404, `got ${b.status}`);
    const c = await request(port, 'GET', '/api/runs/UPPER.com/2026-01-01T00-00-00Z/events');
    assert.equal(c.status, 400);
  });

  await t.test('GET /runs/<path> serves run files with content types', async () => {
    const png = await request(port, 'GET', `/runs/${diskHost}/${diskTs}/raw/pages/home/mobile.fold.png`);
    assert.equal(png.status, 200);
    assert.equal(png.headers['content-type'], 'image/png');
    assert.equal(png.text.length, pngBytes.length);

    const md = await request(port, 'GET', `/runs/${diskHost}/${diskTs}/report.md`);
    assert.equal(md.status, 200);
    assert.match(String(md.headers['content-type']), /text\/markdown/);
    assert.equal(md.text, '# fake\n');

    const dir = await request(port, 'GET', `/runs/${diskHost}/${diskTs}`);
    assert.equal(dir.status, 404, 'directories are not listed');

    const nope = await request(port, 'GET', `/runs/${diskHost}/${diskTs}/missing.png`);
    assert.equal(nope.status, 404);
  });

  await t.test('GET /runs path traversal is blocked', async () => {
    const attempts = ['/runs/../.env', '/runs/%2e%2e/.env', '/runs/%2E%2E%2F.env', '/runs/example.com/../../.env', `/runs//${tmp}/.env`, `/runs/${tmp}/.env`, '/runs/..%5c.env'];
    for (const p of attempts) {
      const r = await request(port, 'GET', p);
      assert.ok(r.status === 403 || r.status === 404, `${p} → ${r.status}`);
      assert.ok(!r.text.includes(sentinel), `${p} leaked the sentinel`);
      assert.ok(!r.text.includes('SECRET='), `${p} leaked a file body`);
    }
  });

  await t.test('unknown routes are 404 JSON', async () => {
    const r = await request(port, 'GET', '/nope');
    assert.equal(r.status, 404);
    assert.equal((json(r) as { error: string }).error, 'not found');
    const bad = await request(port, 'GET', '/api/audit');
    assert.equal(bad.status, 404);
  });

  await t.test('POST /api/audit validates the body', async () => {
    const noUrl = await request(port, 'POST', '/api/audit', { industry: 'auto' });
    assert.equal(noUrl.status, 400);
    assert.match((json(noUrl) as { error: string }).error, /url/);

    const badMod = await request(port, 'POST', '/api/audit', { url: 'example.com', modules: { nope: true }, dry_run: true });
    assert.equal(badMod.status, 400);
    assert.match((json(badMod) as { error: string }).error, /unknown module/);

    const unbuilt = await request(port, 'POST', '/api/audit', { url: 'example.com', modules: { lighthouse: true }, dry_run: true });
    assert.equal(unbuilt.status, 400);
    assert.match((json(unbuilt) as { error: string }).error, /not built/);

    const noIndustry = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'auto', modules: { classify: false }, dry_run: true });
    assert.equal(noIndustry.status, 400);
    assert.match((json(noIndustry) as { error: string }).error, /classify/);

    const badIndustry = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'unicorns', dry_run: true });
    assert.equal(badIndustry.status, 400);
    assert.match((json(badIndustry) as { error: string }).error, /unknown industry/);

    const badCache = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'generic', from_cache: 'example.com/2000-01-01T00-00-00Z', dry_run: true });
    assert.equal(badCache.status, 400);
    assert.match((json(badCache) as { error: string }).error, /cache run/);

    const notJson = await request(port, 'POST', '/api/audit', undefined, { 'content-type': 'application/json' });
    // Empty body parses as {} → url missing → 400.
    assert.equal(notJson.status, 400);
  });

  await t.test('POST /api/audit dry_run runs the real CLI (no network)', async () => {
    const r = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'landscaping', modules: { judgment: false, subpath: false }, dry_run: true });
    assert.equal(r.status, 200, r.text);
    const d = json(r) as { url: string; industry: string; modules: Record<string, boolean>; items: { id: string; check: string }[]; models: { judgment: string } };
    assert.equal(d.url, 'example.com');
    assert.equal(d.industry, 'landscaping');
    assert.equal(d.modules.judgment, false);
    assert.equal(d.modules.subpath, false);
    assert.equal(d.modules.classify, true);
    assert.ok(Array.isArray(d.items) && d.items.length > 0, 'items is a non-empty array');
    assert.ok(d.items.every((it) => it.check === 'deterministic'), 'judgment items are filtered out when judgment is off');
    assert.equal(d.models.judgment, 'claude-opus-5');
  });

  await t.test('POST /api/audit dry_run honours judge_model, tiles and exclude_items', async () => {
    const r = await request(port, 'POST', '/api/audit', {
      url: 'example.com',
      industry: 'generic',
      judge_model: 'claude-sonnet-5',
      tiles: 6,
      exclude_items: ['tel-link-above-fold'],
      dry_run: true,
    });
    assert.equal(r.status, 200, r.text);
    const d = json(r) as { models: { judgment: string }; exclude_items: string[]; items: { id: string }[] };
    assert.equal(d.models.judgment, 'claude-sonnet-5');
    assert.deepEqual(d.exclude_items, ['tel-link-above-fold']);
    assert.ok(!d.items.some((it) => it.id === 'tel-link-above-fold'));
  });

  await t.test('POST /api/audit starts a run, 409 while running, SSE ends with event: error when the CLI fails', async () => {
    // The child has a blank FIRECRAWL_API_KEY, so it exits 1 before creating anything or calling out.
    const start = await request(port, 'POST', '/api/audit', { url: 'audit-ui-test.invalid', industry: 'generic', modules: { classify: false, judgment: false, subpath: false, desktop: false } });
    assert.equal(start.status, 200, start.text);
    const { run_id, run_dir } = json(start) as { run_id: string; run_dir: string };
    assert.match(run_id, RUN_ID_RE);
    assert.ok(run_id.startsWith('audit-ui-test.invalid/'));
    assert.equal(run_dir, path.join(runsDir, ...run_id.split('/')));
    assert.ok(fs.existsSync(run_dir), 'run dir is created up front');

    const second = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'generic' });
    assert.equal(second.status, 409);
    assert.match((json(second) as { error: string }).error, /already running/);

    const listed = json(await request(port, 'GET', '/api/runs')) as { id: string; status: string }[];
    assert.equal(listed.find((x) => x.id === run_id)?.status, 'running');

    const notYet = await request(port, 'GET', `/api/runs/${run_id}/report`);
    assert.equal(notYet.status, 404);
    assert.equal((json(notYet) as { status: string }).status, 'running');

    // The events stream stays open until the child exits, then ends with the terminal event.
    const events = await request(port, 'GET', `/api/runs/${run_id}/events`);
    assert.equal(events.status, 200);
    assert.match(String(events.headers['content-type']), /text\/event-stream/);
    assert.match(events.text, /^event: error$/m);
    const errLine = events.text.split('\n').find((l) => l.startsWith('data: {"run_id"'));
    assert.ok(errLine, 'terminal error frame carries JSON');
    const err = JSON.parse(errLine.slice('data: '.length)) as { code: number | null; message: string; stderr: string };
    assert.notEqual(err.code, 0);
    assert.match(err.stderr + err.message, /FIRECRAWL_API_KEY/);
    assert.ok(!fs.existsSync(path.join(run_dir, 'raw')), 'no scrape happened');

    // A reconnecting client gets the terminal frame again.
    const again = await request(port, 'GET', `/api/runs/${run_id}/events`, undefined, { 'last-event-id': '0' });
    assert.equal(again.status, 200);
    assert.match(again.text, /^event: error$/m);

    const after = json(await request(port, 'GET', '/api/runs')) as { id: string; status: string; error: string | null }[];
    const mine = after.find((x) => x.id === run_id);
    assert.equal(mine?.status, 'error');
    assert.match(mine?.error ?? '', /FIRECRAWL_API_KEY/);

    const report = await request(port, 'GET', `/api/runs/${run_id}/report`);
    assert.equal(report.status, 404);
    assert.equal((json(report) as { status: string }).status, 'error');

    // The slot is free again: a dry run still works and a new run would be accepted (we don't start one).
    const dry = await request(port, 'POST', '/api/audit', { url: 'example.com', industry: 'generic', dry_run: true });
    assert.equal(dry.status, 200);
  });
});
