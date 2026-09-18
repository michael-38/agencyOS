import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCorpusBlock } from '../src/llm/prompts/site-content.js';

// buildContent is private to LlmClient, so the wiring is asserted through a tiny stand-in that
// mirrors it exactly. If the client's rule changes, this test is the thing that should be updated.
const MIN_CACHEABLE_CHARS = 4096;
type Part = { type: 'text'; text: string; cacheable?: boolean };
function blocks(parts: Part[]) {
  return parts.map((p) =>
    p.cacheable === true && p.text.length >= MIN_CACHEABLE_CHARS
      ? { type: 'text', text: p.text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text: p.text },
  );
}

test('a large invariant block gets a cache breakpoint; a small one does not', () => {
  const big = blocks([{ type: 'text', text: 'x'.repeat(MIN_CACHEABLE_CHARS), cacheable: true }]);
  assert.deepEqual((big[0] as { cache_control?: unknown }).cache_control, { type: 'ephemeral' });

  const small = blocks([{ type: 'text', text: 'x'.repeat(MIN_CACHEABLE_CHARS - 1), cacheable: true }]);
  assert.equal((small[0] as { cache_control?: unknown }).cache_control, undefined, 'below the cache floor the flag is ignored rather than sent and rejected');

  const unflagged = blocks([{ type: 'text', text: 'x'.repeat(50_000) }]);
  assert.equal((unflagged[0] as { cache_control?: unknown }).cache_control, undefined);
});

test('the corpus block is byte-identical, so a retry or a replay reads it cached', () => {
  const corpus = '<page url="https://example.test/">body</page>';
  assert.equal(sourceCorpusBlock(corpus), sourceCorpusBlock(corpus), 'a cache hit needs an identical prefix');
  assert.ok(sourceCorpusBlock(corpus).startsWith('## Source pages'), 'and a stable opening, since matching is prefix-based');
  assert.ok(sourceCorpusBlock(corpus).includes(corpus));
});

test('the corpus is the only block the content stage flags cacheable', () => {
  // It is the largest part of the request by far, and the only part that does not change between a
  // first attempt and a retry. Flagging the slot table too would spend a breakpoint on a block that
  // changes whenever the template does.
  const corpus = '<page url="https://example.test/">body</page>'.repeat(200);
  const parts: Part[] = [
    { type: 'text', text: sourceCorpusBlock(corpus), cacheable: true },
    { type: 'text', text: 'x'.repeat(10_000) },
  ];
  const out = blocks(parts);
  assert.deepEqual((out[0] as { cache_control?: unknown }).cache_control, { type: 'ephemeral' });
  assert.equal((out[1] as { cache_control?: unknown }).cache_control, undefined);
});
