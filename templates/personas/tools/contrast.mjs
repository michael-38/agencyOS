#!/usr/bin/env node
// WCAG contrast helper. Two modes:
//   node tools/contrast.mjs "#6b6f72" "#f4f0e8"          → ratio for one pair
//   node tools/contrast.mjs --fix "#6b6f72" "#f4f0e8" 4.5 → nearest same-hue colour that passes
//
// Used while picking the muted/legal text tokens on these pages: every one of them sits on more
// than one surface, so "looks grey enough" is not a test.
const hex = (h) => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [l1, l2] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Walk the foreground toward black or white (whichever helps) until it clears `target`. */
export function fix(fg, bg, target = 4.5) {
  const bgLight = lum(hex(bg)) > 0.4;
  let rgb = hex(fg);
  for (let i = 0; i < 255; i++) {
    if (ratio(toHex(rgb), bg) >= target) break;
    rgb = rgb.map((v) => (bgLight ? v - 1 : v + 1));
  }
  return toHex(rgb);
}

if (process.argv[1] && process.argv[1].endsWith('contrast.mjs')) {
  const args = process.argv.slice(2);
  if (args[0] === '--fix') {
    const [, fg, bg, t] = args;
    const out = fix(fg, bg, Number(t) || 4.5);
    process.stdout.write(`${fg} on ${bg} = ${ratio(fg, bg).toFixed(2)} → ${out} = ${ratio(out, bg).toFixed(2)}\n`);
  } else {
    const [fg, bg] = args;
    process.stdout.write(`${ratio(fg, bg).toFixed(2)}\n`);
  }
}
