// site:preview — open a generated page in the default browser.
//
// The v2 scaffold-and-hand-fill path (site:scaffold, site:validate) was removed when site:build
// became a template fill: it existed to give an agent a skeleton to type into, and the templates now
// are the skeleton.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function sitePreview(o: { dir: string }): number {
  const file = path.join(o.dir, 'index.html');
  if (!fs.existsSync(file)) {
    process.stderr.write(`${file} not found\n`);
    return 2;
  }
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const r = spawnSync(cmd, [file], { stdio: 'ignore', shell: process.platform === 'win32' });
  process.stdout.write(`opened ${file}\n`);
  return r.status ?? 0;
}
