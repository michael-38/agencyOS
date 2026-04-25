import { execSync } from 'child_process';
import { log } from './utils/logger.js';
import { slugify } from './utils/phone.js';

export type DeployTarget = 'surge' | 'netlify' | 'none';

export async function deploy(
  outputDir: string,
  companyName: string,
  target: DeployTarget
): Promise<string | null> {
  if (target === 'none') {
    log.info('Skipping deployment (--dry-run)');
    return null;
  }

  const subdomain = slugify(companyName);

  switch (target) {
    case 'surge':
      return deploySurge(outputDir, subdomain);
    case 'netlify':
      return deployNetlify(outputDir);
    default:
      throw new Error(`Unknown deploy target: ${target}`);
  }
}

function deploySurge(outputDir: string, subdomain: string): string {
  const domain = `${subdomain}.surge.sh`;

  // Check if surge is available
  try {
    execSync('npx surge --version', { stdio: 'ignore' });
  } catch {
    log.info('Installing surge...');
    execSync('npm install -g surge', { stdio: 'inherit' });
  }

  log.info(`Deploying to ${domain}...`);

  try {
    execSync(`npx surge ${outputDir} ${domain}`, {
      stdio: 'inherit',
      timeout: 60000,
    });

    const url = `https://${domain}`;
    log.success(`Deployed: ${url}`);
    return url;
  } catch (err: any) {
    const msg = String(err.message || err.stderr || '').toLowerCase();
    // Only retry with a different subdomain if the domain is taken
    if (msg.includes('already in use') || msg.includes('not authorized') || msg.includes('taken')) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const fallbackDomain = `${subdomain}-${suffix}.surge.sh`;

      log.warn(`${domain} is taken, trying ${fallbackDomain}...`);

      execSync(`npx surge ${outputDir} ${fallbackDomain}`, {
        stdio: 'inherit',
        timeout: 60000,
      });

      const url = `https://${fallbackDomain}`;
      log.success(`Deployed: ${url}`);
      return url;
    }

    throw new Error(`Surge deployment failed: ${err.message}`);
  }
}

function deployNetlify(outputDir: string): string {
  // Check if netlify-cli is available
  try {
    execSync('npx netlify --version', { stdio: 'ignore' });
  } catch {
    log.info('Installing netlify-cli...');
    execSync('npm install -g netlify-cli', { stdio: 'inherit' });
  }

  log.info('Deploying to Netlify...');

  const result = execSync(`npx netlify deploy --dir=${outputDir} --prod --json`, {
    encoding: 'utf-8',
    timeout: 60000,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error(`Netlify returned invalid JSON: ${result.slice(0, 200)}`);
  }
  const url = parsed.deploy_url || parsed.url;
  if (!url) {
    throw new Error(`Netlify deploy succeeded but returned no URL: ${JSON.stringify(parsed)}`);
  }

  log.success(`Deployed: ${url}`);
  return url;
}
