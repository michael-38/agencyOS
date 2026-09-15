// Progress/event emitter: writes run.log, prints human lines to stderr, or JSON lines to stdout (--json-progress).
import fs from 'node:fs';
import path from 'node:path';

export type StepStatus = 'start' | 'done' | 'skip' | 'error';
export interface ProgressEvent {
  event: 'step' | 'log' | 'done' | 'error' | 'meta';
  ts: string;
  step?: number;
  name?: string;
  status?: StepStatus;
  message?: string;
  data?: unknown;
}

export class Progress {
  private logPath: string | null = null;

  constructor(
    runDir: string | null,
    private readonly json: boolean,
    private readonly verbose: boolean,
    private readonly quiet = false,
  ) {
    if (runDir) {
      fs.mkdirSync(runDir, { recursive: true });
      this.logPath = path.join(runDir, 'run.log');
    }
  }

  private emit(ev: ProgressEvent, human: string, level: 'info' | 'debug' = 'info'): void {
    if (this.logPath) fs.appendFileSync(this.logPath, `${ev.ts} ${human}\n`);
    if (this.json) {
      process.stdout.write(`${JSON.stringify(ev)}\n`);
      return;
    }
    if (this.quiet) return;
    if (level === 'debug' && !this.verbose) return;
    process.stderr.write(`${human}\n`);
  }

  step(step: number, name: string, status: StepStatus, message?: string, data?: unknown): void {
    const ts = new Date().toISOString();
    const tag = { start: '▶', done: '✓', skip: '–', error: '✗' }[status];
    this.emit({ event: 'step', ts, step, name, status, message, data }, `${tag} step ${step} ${name}${message ? ` — ${message}` : ''}`);
  }

  log(message: string, data?: unknown): void {
    this.emit({ event: 'log', ts: new Date().toISOString(), message, data }, `  ${message}`, 'debug');
  }

  info(message: string, data?: unknown): void {
    this.emit({ event: 'log', ts: new Date().toISOString(), message, data }, `  ${message}`);
  }

  meta(data: unknown): void {
    this.emit({ event: 'meta', ts: new Date().toISOString(), data }, `  meta ${JSON.stringify(data)}`, 'debug');
  }

  done(data?: unknown): void {
    this.emit({ event: 'done', ts: new Date().toISOString(), data }, `✓ done${data ? ` ${JSON.stringify(data)}` : ''}`);
  }

  error(message: string, data?: unknown): void {
    this.emit({ event: 'error', ts: new Date().toISOString(), message, data }, `✗ ${message}`);
  }
}
