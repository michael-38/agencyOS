import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { AuditReport, BatchEntry, ModuleId } from '../types.js';
import { scoreBand } from '../utils/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// when running via tsx, __dirname is .../audit/src/reporter
const TEMPLATE_DIR = path.join(__dirname, 'template');

export async function renderReport(report: AuditReport, outputDir: string): Promise<string> {
  const dashboardPath = path.join(TEMPLATE_DIR, 'dashboard.ejs');
  const stylesPath = path.join(TEMPLATE_DIR, 'styles.css');
  const clientPath = path.join(TEMPLATE_DIR, 'client.js');

  const styles = fs.readFileSync(stylesPath, 'utf-8');
  const clientJs = fs.readFileSync(clientPath, 'utf-8');

  const screenshots = fs.existsSync(path.join(outputDir, 'raw', 'screenshot-mobile.png'));

  const html = await ejs.renderFile(
    dashboardPath,
    {
      report,
      clinic: report.clinic,
      styles,
      clientJs,
      scoreBand,
      screenshots,
    },
    { async: true }
  );

  const reportPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

export async function renderIndex(entries: BatchEntry[], outputPath: string): Promise<void> {
  const sorted = [...entries].sort((a, b) => {
    if (a.status === 'failed' && b.status !== 'failed') return 1;
    if (b.status === 'failed' && a.status !== 'failed') return -1;
    return (a.overallScore ?? 0) - (b.overallScore ?? 0);
  });

  const moduleIds: ModuleId[] = [
    'lighthouse',
    'seo-onpage',
    'seo-ranking',
    'llm-copy-aeo',
    'llm-discoverability',
    'copy-conversion',
    'design-review',
    'ux-medspa',
  ];

  const rows = sorted
    .map((e) => {
      if (e.status === 'failed') {
        return `<tr class="failed"><td>${escapeHtml(e.input.url)}</td><td colspan="${
          moduleIds.length + 2
        }">FAILED — ${escapeHtml(e.errorMessage || '')}</td></tr>`;
      }
      const cells = moduleIds
        .map((id) => {
          const s = e.moduleScores?.[id];
          const band = scoreBand(s ?? null);
          const v = s === null || s === undefined ? '—' : s;
          return `<td class="kw-rank ${band === 'good' ? 'good' : band === 'warn' ? 'warn' : band === 'bad' ? 'bad' : ''}">${v}</td>`;
        })
        .join('');
      const relPath = path.relative(path.dirname(outputPath), e.reportPath || '') || '#';
      const overallBand = scoreBand(e.overallScore ?? null);
      return `<tr>
        <td><strong>${escapeHtml(e.clinic?.name || e.input.url)}</strong><br><a href="${escapeHtml(e.input.url)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--muted);">${escapeHtml(e.input.url)}</a></td>
        <td class="kw-rank ${overallBand === 'good' ? 'good' : overallBand === 'warn' ? 'warn' : 'bad'}"><strong>${e.overallScore}</strong></td>
        ${cells}
        <td><a href="${escapeHtml(relPath)}">Open</a></td>
      </tr>`;
    })
    .join('\n');

  const stylesPath = path.join(TEMPLATE_DIR, 'styles.css');
  const styles = fs.readFileSync(stylesPath, 'utf-8');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Audit batch · ${entries.length} clinics</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${styles}</style>
</head>
<body>
<header class="report-header"><div class="container">
<div class="eyebrow">Batch audit · ${new Date().toLocaleString()}</div>
<h1>Prospect <em>scoreboard</em></h1>
<div class="meta">${entries.length} clinics · sorted lowest score first (worst-quality, easiest to win)</div>
</div></header>
<main><div class="container">
<table class="kw-table">
  <thead><tr>
    <th>Clinic</th>
    <th>Overall</th>
    ${moduleIds.map((id) => `<th>${id.replace(/-/g, ' ')}</th>`).join('')}
    <th></th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</div></main>
</body></html>`;

  fs.writeFileSync(outputPath, html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}
