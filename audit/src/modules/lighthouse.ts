import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Issue, ModuleResult, Severity } from '../types.js';
import { sortIssues } from '../utils/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_PATH = path.join(__dirname, 'lighthouse-worker.mjs');

interface LighthouseRun {
  formFactor: 'mobile' | 'desktop';
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  failedAudits: { id: string; title: string; description: string; score: number | null; displayValue?: string }[];
}

function runLighthouse(url: string, formFactor: 'mobile' | 'desktop'): Promise<LighthouseRun> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [WORKER_PATH, url, formFactor], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Lighthouse worker timed out (${formFactor})`));
    }, 180_000);
    child.on('close', () => {
      clearTimeout(timer);
      const marker = '__LH_RESULT__:';
      const idx = stdout.lastIndexOf(marker);
      if (idx === -1) {
        reject(new Error(`Lighthouse worker produced no result. stderr: ${stderr.slice(-400)}`));
        return;
      }
      const jsonLine = stdout.slice(idx + marker.length).trim().split('\n')[0];
      try {
        const parsed = JSON.parse(jsonLine);
        if (!parsed.ok) reject(new Error(parsed.error || 'unknown'));
        else resolve(parsed.run as LighthouseRun);
      } catch (e: any) {
        reject(new Error(`Could not parse worker output: ${e.message}`));
      }
    });
  });
}

function severityForScore(score: number): Severity {
  if (score < 0.5) return 'high';
  if (score < 0.75) return 'medium';
  return 'low';
}

export async function runLighthouseModule(url: string, rawDir: string): Promise<ModuleResult<{ mobile: LighthouseRun; desktop: LighthouseRun }>> {
  const start = Date.now();
  try {
    // Run sequentially — two simultaneous Chromes on the same machine is flaky.
    const mobile = await runLighthouse(url, 'mobile');
    const desktop = await runLighthouse(url, 'desktop');

    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'lighthouse-mobile.json'), JSON.stringify(mobile, null, 2));
    fs.writeFileSync(path.join(rawDir, 'lighthouse-desktop.json'), JSON.stringify(desktop, null, 2));

    const issues: Issue[] = [];
    const seen = new Set<string>();

    for (const run of [mobile, desktop]) {
      for (const audit of run.failedAudits) {
        const key = `${run.formFactor}:${audit.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          severity: severityForScore(audit.score ?? 1),
          title: `${run.formFactor === 'mobile' ? '📱' : '🖥'} ${audit.title}`,
          description: audit.description || '',
          quickFix: audit.displayValue ? `Current: ${audit.displayValue}` : undefined,
          evidence: audit.id,
        });
      }
    }

    const overallScore = Math.round(
      (mobile.scores.performance +
        mobile.scores.accessibility +
        mobile.scores.bestPractices +
        mobile.scores.seo +
        desktop.scores.performance +
        desktop.scores.accessibility +
        desktop.scores.bestPractices +
        desktop.scores.seo) /
        8
    );

    return {
      id: 'lighthouse',
      label: 'Lighthouse',
      status: 'ok',
      score: overallScore,
      summary: `Mobile perf ${mobile.scores.performance}, desktop perf ${desktop.scores.performance}. ${issues.length} audit(s) below 90.`,
      issues: sortIssues(issues),
      evidence: { mobile, desktop },
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'lighthouse',
      label: 'Lighthouse',
      status: 'error',
      score: null,
      summary: 'Lighthouse run failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  }
}
