import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  step: (step: number, total: number, msg: string) =>
    console.log(chalk.dim(`[${step}/${total}]`), msg),
  url: (label: string, url: string) =>
    console.log(chalk.green('✓'), label, chalk.cyan.underline(url)),
  divider: () => console.log(chalk.dim('─'.repeat(60))),
  header: (msg: string) => {
    console.log('');
    console.log(chalk.bold.white(msg));
    console.log(chalk.dim('─'.repeat(60)));
  },
  result: (label: string, value: string) =>
    console.log(`  ${chalk.dim(label + ':')} ${value}`),
  module: (id: string, score: number | null, status: string) => {
    const scoreText = score === null ? '—' : String(Math.round(score));
    const color = score === null ? chalk.dim : score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    console.log(`  ${color(scoreText.padStart(3))} ${chalk.bold(id.padEnd(22))} ${chalk.dim(status)}`);
  },
};
