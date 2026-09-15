// Steps 1-2: normalize the input, follow redirects (recording the chain), derive the origin, and decide
// the home page after the root scrape (rules with precedence; every rule that fired is recorded).
import { LIMITS } from '../config.js';
import { loadHtml } from '../checks/html.js';
import { normalizeInput, sameSite } from '../urls.js';
import type { HomeRule } from '../report/schema.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

export interface ResolveResult {
  input_url: string;
  normalized_input: string;
  scheme_added: boolean;
  scheme_downgraded: boolean;
  chain: { url: string; status: number | null }[];
  final_url: string;
  resolved_origin: string;
  node_status: number | null;
  input_host_differs: boolean;
  error: string | null;
}

async function followRedirects(start: string, timeoutMs: number, maxHops = 10): Promise<{ chain: { url: string; status: number | null }[]; final: string; status: number | null }> {
  const chain: { url: string; status: number | null }[] = [];
  let current = start;
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(timeoutMs) });
    chain.push({ url: current, status: res.status });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      try {
        await res.arrayBuffer();
      } catch {
        /* ignore body */
      }
      current = new URL(loc, current).toString();
      continue;
    }
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore body */
    }
    return { chain, final: current, status: res.status };
  }
  return { chain, final: current, status: chain[chain.length - 1]?.status ?? null };
}

export async function resolveInput(input: string, timeoutMs = LIMITS.resolveTimeoutMs): Promise<ResolveResult> {
  const { url, schemeAdded } = normalizeInput(input);
  const inputHost = url.hostname;
  let chain: ResolveResult['chain'] = [];
  let final = url.toString();
  let status: number | null = null;
  let error: string | null = null;
  let downgraded = false;
  try {
    ({ chain, final, status } = await followRedirects(url.toString(), timeoutMs));
  } catch (e) {
    const msg = (e as Error).message;
    if (schemeAdded && url.protocol === 'https:') {
      // https failed at the transport level; try http once.
      const http = new URL(url.toString());
      http.protocol = 'http:';
      try {
        ({ chain, final, status } = await followRedirects(http.toString(), timeoutMs));
        downgraded = true;
      } catch (e2) {
        error = `${msg}; http retry: ${(e2 as Error).message}`;
      }
    } else {
      error = msg;
    }
  }
  const finalUrl = new URL(final);
  return {
    input_url: input,
    normalized_input: url.toString(),
    scheme_added: schemeAdded,
    scheme_downgraded: downgraded,
    chain,
    final_url: finalUrl.toString(),
    resolved_origin: finalUrl.origin,
    node_status: status,
    input_host_differs: !sameSite(inputHost, finalUrl.hostname),
    error,
  };
}

export interface SplashResult {
  isSplash: boolean;
  words: number;
  regionLinks: number;
  hreflang: number;
}

const REGION_LINK = /\b(enter( site)?|choose (your )?(location|region|country|language)|select (your )?(location|region|country|language)|english|español|français|deutsch|united states|canada|uk|europe|australia|international|usa|us site|en|fr|es|de)\b/i;

/** Deterministic splash / region-chooser detection on the root scrape. */
export function detectSplash(rawHtml: string, maxWords = LIMITS.splashMaxWords): SplashResult {
  const $ = loadHtml(rawHtml);
  $('nav, header, footer, script, style, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  let regionLinks = 0;
  $('a').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length <= 40 && REGION_LINK.test(t)) regionLinks++;
  });
  const hreflang = $('link[rel="alternate"][hreflang]').length;
  const isSplash = words < maxWords && (regionLinks >= 2 || (hreflang >= 2 && words < 40));
  return { isSplash, words, regionLinks, hreflang };
}

export interface HomeDecisionInput {
  rootStatus: number | null;
  rootScrapeError: string | null;
  splash: SplashResult | null;
  inputHostDiffers: boolean;
  hasCandidates: boolean;
}

export interface HomeDecision {
  rules_fired: string[];
  needs_chooser: boolean;
  home_rule: HomeRule;
  reason: string;
}

/** Precedence: root-non-2xx > host-mismatch > splash-detected. */
export function decideHome(input: HomeDecisionInput): HomeDecision {
  const fired: string[] = [];
  const rootBad = input.rootScrapeError != null || input.rootStatus == null || input.rootStatus < 200 || input.rootStatus >= 300;
  if (rootBad) fired.push('root-non-2xx');
  if (input.inputHostDiffers) fired.push('host-mismatch');
  if (input.splash?.isSplash) fired.push('splash-detected');
  if (!fired.length) return { rules_fired: [], needs_chooser: false, home_rule: 'root-2xx', reason: 'root responded 2xx and looks like a real page' };
  const rule = fired[0] as HomeRule;
  const reason =
    rule === 'root-non-2xx'
      ? `root returned ${input.rootStatus ?? 'no status'}${input.rootScrapeError ? ` (${input.rootScrapeError})` : ''}`
      : rule === 'host-mismatch'
        ? 'input host differs from the resolved host'
        : `root looks like a splash/region chooser (${input.splash?.words} words, ${input.splash?.regionLinks} region links)`;
  if (!input.hasCandidates) return { rules_fired: fired, needs_chooser: false, home_rule: 'input-page-fallback', reason: `${reason}; no mapped URLs to choose from` };
  return { rules_fired: fired, needs_chooser: true, home_rule: rule, reason };
}
