import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { ClinicInfo, Issue, ModuleResult } from '../types.js';
import { sortIssues } from '../utils/scoring.js';
import { MODELS } from '../utils/models.js';
import { CostTracker } from '../utils/cost.js';

type Provider = 'claude' | 'perplexity' | 'openai';

interface ProviderAnswer {
  provider: Provider;
  answer: string;
  citations: string[];
  mentionsClinic: boolean;
  citesWebsite: boolean;
  error?: string;
}

interface QuestionRound {
  question: string;
  answers: ProviderAnswer[];
}

interface Evidence {
  rounds: QuestionRound[];
  providers: Provider[];
}

function buildLocation(clinic: ClinicInfo): string | null {
  if (!clinic.city) return null;
  return clinic.state ? `${clinic.city}, ${clinic.state}` : clinic.city;
}

// Each question is tagged with a model tier:
//   - 'judgment' → Sonnet 4.6 (comparative / recommendation questions where ranking matters)
//   - 'recognition' → Haiku 4.5 (does the model recognize the entity at all? — low-judgment recall)
//
// claude.ai's free tier serves Haiku and paid serves Sonnet, so using both is
// actually closer to "what real users see" than running everything on one tier.
type QuestionTier = 'judgment' | 'recognition';
interface QuestionSpec { text: string; tier: QuestionTier; }

function buildQuestions(clinic: ClinicInfo, location: string): QuestionSpec[] {
  const top = clinic.services[0] || 'botox';
  const second = clinic.services[1] || 'lip filler';
  return [
    // Comparative landscape — judgment matters → Sonnet.
    { text: `What are the best med spas in ${location}?`, tier: 'judgment' },
    { text: `Where can I get ${top.toLowerCase()} in ${location}?`, tier: 'judgment' },
    { text: `Recommend a top-rated provider for ${second.toLowerCase()} in ${location}.`, tier: 'judgment' },
    // Entity recognition — does Claude know the clinic? → Haiku.
    { text: `Tell me about ${clinic.name}, a med spa in ${location}.`, tier: 'recognition' },
    { text: `What services does ${clinic.name} in ${location} offer?`, tier: 'recognition' },
    { text: `Who are the practitioners at ${clinic.name} in ${location}?`, tier: 'recognition' },
  ];
}

function detectMention(text: string, clinic: ClinicInfo): { mentionsClinic: boolean; citesWebsite: boolean } {
  const lower = text.toLowerCase();
  const nameTokens = clinic.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const mentionsClinic = nameTokens.length > 0 && nameTokens.every((t) => lower.includes(t));
  const citesWebsite = lower.includes(clinic.domain.toLowerCase());
  return { mentionsClinic, citesWebsite };
}

async function askClaude(
  question: string,
  clinic: ClinicInfo,
  model: string,
  costTracker?: CostTracker
): Promise<ProviderAnswer> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { provider: 'claude', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: 'no key' };
  const client = new Anthropic({ apiKey, maxRetries: 8 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 } as any],
      messages: [{ role: 'user', content: question }],
    });
    costTracker?.add('llm-discoverability', model, response.usage as any);
    let answer = '';
    const citations: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        answer += block.text;
        const citationsField = (block as any).citations;
        if (Array.isArray(citationsField)) {
          for (const c of citationsField) if (c.url) citations.push(c.url);
        }
      }
    }
    const det = detectMention(answer + ' ' + citations.join(' '), clinic);
    return { provider: 'claude', answer: answer.trim(), citations, ...det };
  } catch (err: any) {
    return { provider: 'claude', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: err.message };
  }
}

async function askPerplexity(question: string, clinic: ClinicInfo): Promise<ProviderAnswer> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { provider: 'perplexity', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: 'no key' };
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: question }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Perplexity HTTP ${r.status}`);
    const json: any = await r.json();
    const answer = json.choices?.[0]?.message?.content || '';
    const citations: string[] = json.citations || [];
    const det = detectMention(answer + ' ' + citations.join(' '), clinic);
    return { provider: 'perplexity', answer, citations, ...det };
  } catch (err: any) {
    return { provider: 'perplexity', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: err.message };
  }
}

async function askOpenAI(question: string, clinic: ClinicInfo): Promise<ProviderAnswer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: 'openai', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: 'no key' };
  const client = new OpenAI({ apiKey });
  try {
    const r: any = await client.responses.create({
      model: 'gpt-4o',
      input: question,
      tools: [{ type: 'web_search_preview' } as any],
    });
    let answer = '';
    const citations: string[] = [];
    const output = r.output || [];
    for (const item of output) {
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') {
            answer += c.text || '';
            for (const ann of c.annotations || []) {
              if (ann.url) citations.push(ann.url);
            }
          }
        }
      }
    }
    if (!answer && r.output_text) answer = r.output_text;
    const det = detectMention(answer + ' ' + citations.join(' '), clinic);
    return { provider: 'openai', answer: answer.trim(), citations, ...det };
  } catch (err: any) {
    return { provider: 'openai', answer: '', citations: [], mentionsClinic: false, citesWebsite: false, error: err.message };
  }
}

export async function runLlmDiscoverabilityModule(
  clinic: ClinicInfo,
  rawDir: string,
  costTracker?: CostTracker
): Promise<ModuleResult<Evidence>> {
  const start = Date.now();
  const providers: Provider[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('claude');
  if (process.env.PERPLEXITY_API_KEY) providers.push('perplexity');
  if (process.env.OPENAI_API_KEY) providers.push('openai');

  if (providers.length === 0) {
    return {
      id: 'llm-discoverability',
      label: 'LLM discoverability',
      status: 'skipped',
      score: null,
      summary: 'Skipped — no LLM provider keys set.',
      issues: [],
      skipReason: 'Set ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, or OPENAI_API_KEY.',
      durationMs: Date.now() - start,
    };
  }

  const location = buildLocation(clinic);
  if (!location) {
    return {
      id: 'llm-discoverability',
      label: 'LLM discoverability',
      status: 'skipped',
      score: null,
      summary: 'Skipped — clinic city is unknown, cannot ground LLM questions in a location.',
      issues: [],
      skipReason: 'Provide --city or ensure the site exposes a city so questions can be tied to a real market.',
      durationMs: Date.now() - start,
    };
  }

  const questions = buildQuestions(clinic, location);
  const rounds: QuestionRound[] = [];
  for (const q of questions) {
    const claudeModel = q.tier === 'judgment' ? MODELS.consumer_proxy : MODELS.cheap_extraction;
    const answers = await Promise.all([
      providers.includes('claude') ? askClaude(q.text, clinic, claudeModel, costTracker) : null,
      providers.includes('perplexity') ? askPerplexity(q.text, clinic) : null,
      providers.includes('openai') ? askOpenAI(q.text, clinic) : null,
    ]);
    rounds.push({ question: q.text, answers: answers.filter(Boolean) as ProviderAnswer[] });
  }

  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, 'llm-discoverability.json'), JSON.stringify(rounds, null, 2));

  let mentions = 0;
  let cites = 0;
  let total = 0;
  for (const r of rounds) {
    for (const a of r.answers) {
      if (a.error) continue;
      total += 1;
      if (a.mentionsClinic) mentions += 1;
      if (a.citesWebsite) cites += 1;
    }
  }
  const score = total === 0 ? 0 : Math.round(((mentions / total) * 60) + ((cites / total) * 40));

  const issues: Issue[] = [];
  for (const provider of providers) {
    const answers = rounds.flatMap((r) => r.answers.filter((a) => a.provider === provider));
    const directQuestions = rounds.slice(3).flatMap((r) => r.answers.filter((a) => a.provider === provider));
    const directMentions = directQuestions.filter((a) => a.mentionsClinic).length;
    const directCites = directQuestions.filter((a) => a.citesWebsite).length;

    if (directMentions === 0) {
      issues.push({
        severity: 'critical',
        title: `${provider.toUpperCase()} does not recognize ${clinic.name}`,
        description: `Asked four direct questions about the clinic; ${provider} returned zero accurate mentions.`,
        quickFix: 'Build LLM-citable footprint: claim Google Business Profile, get listed on Yelp/Healthgrades/RealSelf, add MedicalBusiness JSON-LD, publish FAQ pages.',
      });
    } else if (directMentions < directQuestions.length) {
      issues.push({
        severity: 'high',
        title: `${provider.toUpperCase()} only recognizes the clinic ${directMentions}/${directQuestions.length} of the time`,
        description: 'Inconsistent recall when asked direct questions.',
        quickFix: 'Increase entity density: ensure clinic name appears in titles, schema, third-party listings, and is linked from authoritative local sources.',
      });
    }

    if (directCites === 0 && answers.some((a) => !a.error)) {
      issues.push({
        severity: 'high',
        title: `${provider.toUpperCase()} never cites ${clinic.domain}`,
        description: 'The clinic website is not used as a source even when the clinic is named.',
        quickFix: 'Add LLM-friendly content: declarative facts, FAQ schema, services list with prices, sitemap & robots.txt clean.',
      });
    }
  }

  return {
    id: 'llm-discoverability',
    label: 'LLM discoverability',
    status: 'ok',
    score,
    summary: `${mentions}/${total} answers mention the clinic; ${cites}/${total} cite the website. Providers tested: ${providers.join(', ')}.`,
    issues: sortIssues(issues),
    evidence: { rounds, providers },
    durationMs: Date.now() - start,
  };
}
