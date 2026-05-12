// Med spa pages put hours/address/phone/financing in the footer, but raw markdown
// can run 30–60K chars. A head-only slice drops exactly the data the rubric modules
// most need. This takes the head + tail so both hero and footer reach Claude, capped
// to a predictable token budget.
const HEAD_DEFAULT = 12_000;
const TAIL_DEFAULT = 6_000;
const SEPARATOR = '\n\n[…content omitted…]\n\n';

export function headTail(text: string, head = HEAD_DEFAULT, tail = TAIL_DEFAULT): string {
  if (!text) return '';
  if (text.length <= head + tail) return text;
  return text.slice(0, head) + SEPARATOR + text.slice(-tail);
}
