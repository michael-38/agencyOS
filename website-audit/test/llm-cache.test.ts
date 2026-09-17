import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCorpusBlock } from '../src/llm/prompts/site-plan.js';
import { designContractBlock } from '../src/llm/prompts/site-render.js';

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

test('the corpus block is byte-identical for every call in the plan stage', () => {
  const corpus = '<page url="https://example.test/">body</page>';
  assert.equal(sourceCorpusBlock(corpus), sourceCorpusBlock(corpus), 'a cache hit needs an identical prefix');
  assert.ok(sourceCorpusBlock(corpus).startsWith('## Source pages'), 'and a stable opening, since matching is prefix-based');
  assert.ok(sourceCorpusBlock(corpus).includes(corpus));
});

test('the design contract block is byte-identical for every page in the render stage', () => {
  const md = '# Contract\n\n.btn — the button';
  assert.equal(designContractBlock(md), designContractBlock(md));
  assert.ok(designContractBlock(md).startsWith('## The class contract'));
  assert.ok(designContractBlock(md).includes(md));
});
