import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl, normalizeInput, normalizeMap, normalizeUrl, pathSlugs, sameSite, stripSiteHost, urlsEqual } from '../src/urls.js';

test('normalizeInput adds https, keeps an explicit scheme, lowercases the host, drops the fragment', () => {
  const a = normalizeInput('  Example.com/services  ');
  assert.equal(a.url.toString(), 'https://example.com/services');
  assert.equal(a.schemeAdded, true);
  const b = normalizeInput('HTTP://Example.com/#frag');
  assert.equal(b.url.protocol, 'http:');
  assert.equal(b.url.hostname, 'example.com');
  assert.equal(b.url.hash, '');
  assert.equal(b.schemeAdded, false);
  assert.throws(() => normalizeInput('ftp://example.com'), /Unsupported URL scheme/);
});

test('normalizeUrl canonical form', () => {
  assert.equal(normalizeUrl('https://Example.com:443/a//b/index.html?x=1#y'), 'https://example.com/a/b');
  assert.equal(normalizeUrl('http://example.com:80/path/'), 'http://example.com/path');
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com/a%20b'), 'https://example.com/a%20b');
  assert.equal(normalizeUrl('mailto:hi@example.com'), null);
  assert.equal(normalizeUrl('not a url'), null);
});

test('stripSiteHost / sameSite treat www. and m. as the same site', () => {
  assert.equal(stripSiteHost('WWW.Example.com'), 'example.com');
  assert.equal(stripSiteHost('m.example.com'), 'example.com');
  assert.equal(sameSite('www.example.com', 'm.example.com'), true);
  assert.equal(sameSite('example.com', 'blog.example.com'), false);
});

test('classifyUrl buckets', () => {
  const o = 'www.example.com';
  assert.deepEqual(classifyUrl('https://example.com/about', o), { kind: 'same_origin' });
  assert.deepEqual(classifyUrl('https://blog.example.com/post', o), { kind: 'subdomain' });
  assert.deepEqual(classifyUrl('https://mail.example.com/', o), { kind: 'dropped', reason: 'junk-subdomain' });
  assert.deepEqual(classifyUrl('https://other.com/', o), { kind: 'dropped', reason: 'external' });
  assert.deepEqual(classifyUrl('https://www.example.com/wp-content/x.png', o), { kind: 'dropped', reason: 'asset' });
  assert.deepEqual(classifyUrl('https://www.example.com/brochure.pdf', o), { kind: 'dropped', reason: 'asset' });
  assert.deepEqual(classifyUrl('https://www.example.com/wp-json/v2', o), { kind: 'dropped', reason: 'noise' });
  assert.deepEqual(classifyUrl('https://www.example.com/tag/lawn', o), { kind: 'dropped', reason: 'noise' });
  assert.deepEqual(classifyUrl('https://www.example.com/blog/page/2', o), { kind: 'dropped', reason: 'pagination' });
  assert.deepEqual(classifyUrl('https://www.example.com/privacy-policy', o), { kind: 'dropped', reason: 'legal' });
  assert.deepEqual(classifyUrl('https://www.example.com/legal/terms', o), { kind: 'dropped', reason: 'legal' });
  assert.deepEqual(classifyUrl('https://www.example.com/services/patios', o), { kind: 'same_origin' });
});

test('normalizeMap dedupes, folds host variants, prefers https, keeps the shortest spelling, sorts, drops with reasons', () => {
  const origin = 'https://www.example.com';
  const links = [
    { url: 'https://www.example.com/', title: 'Home' },
    { url: 'http://www.example.com/' },
    { url: 'https://example.com/services/', title: 'Services' },
    { url: 'https://www.example.com/services?utm=1', description: 'All services' },
    { url: 'https://www.example.com/services/lawn-care' },
    { url: 'https://m.example.com/about' },
    { url: 'https://blog.example.com/post-1', title: 'Post' },
    { url: 'https://www.example.com/privacy-policy' },
    { url: 'https://www.example.com/img/a.jpg' },
    { url: 'https://other.com/' },
    { url: 'garbage' },
  ];
  const m = normalizeMap(links, origin);
  assert.equal(m.total_input, 11);
  assert.deepEqual(
    m.same_origin.map((l) => l.url),
    ['https://www.example.com/', 'https://www.example.com/about', 'https://www.example.com/services', 'https://www.example.com/services/lawn-care'],
  );
  const services = m.same_origin.find((l) => l.url === 'https://www.example.com/services')!;
  assert.equal(services.original, 'https://example.com/services/');
  assert.equal(services.title, 'Services');
  assert.equal(services.description, 'All services');
  assert.equal(services.depth, 1);
  assert.deepEqual(m.subdomain.map((l) => l.url), ['https://blog.example.com/post-1']);
  assert.deepEqual(
    m.dropped.map((d) => d.reason).sort(),
    ['asset', 'external', 'legal', 'unparsable'],
  );
  assert.ok(Math.abs(m.subdomain_share - 1 / 11) < 1e-9);
});

test('pathSlugs and urlsEqual', () => {
  assert.deepEqual(pathSlugs(['https://www.example.com/services/lawn-care', 'https://blog.example.com/'], 10), ['example.com: services lawn-care', 'blog.example.com: /']);
  assert.equal(pathSlugs(['a', 'b', 'c'].map((s) => `https://x.com/${s}`), 2).length, 2);
  assert.equal(urlsEqual('https://example.com/gallery/', 'https://www.example.com/gallery'), true);
  assert.equal(urlsEqual('https://m.example.com/gallery', 'https://example.com/gallery?x=1'), true);
  assert.equal(urlsEqual('https://example.com/gallery', 'https://example.com/projects'), false);
  assert.equal(urlsEqual('nope', 'https://example.com/'), false);
});
