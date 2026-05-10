import fs from 'fs';
import path from 'path';
import { renderReport } from '../src/reporter/render.js';
import { AuditReport } from '../src/types.js';

const outputDir = path.resolve('output/_mock');
fs.mkdirSync(path.join(outputDir, 'raw'), { recursive: true });

const report: AuditReport = {
  input: { url: 'https://example-medspa.com' },
  clinic: {
    name: 'Example Aesthetics',
    city: 'Austin',
    state: 'TX',
    phone: '(512) 555-0100',
    services: ['Botox', 'Lip filler', 'Microneedling', 'Laser hair removal'],
    domain: 'example-medspa.com',
    url: 'https://example-medspa.com',
  },
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  overallScore: 58,
  outputDir,
  modules: [
    {
      id: 'lighthouse', label: 'Lighthouse', status: 'ok', score: 64,
      summary: 'Mobile perf 42, desktop perf 82. 7 audits below 90.',
      issues: [
        { severity: 'high', title: '📱 Largest Contentful Paint', description: 'Mobile LCP is 4.2s.', quickFix: 'Compress hero image; serve WebP.' },
        { severity: 'medium', title: '📱 Render-blocking resources', description: 'Two CSS files block first paint.' },
      ],
      evidence: { mobile: { scores: { performance: 42, accessibility: 88, bestPractices: 75, seo: 90 } }, desktop: { scores: { performance: 82, accessibility: 92, bestPractices: 80, seo: 92 } } } as any,
    },
    {
      id: 'seo-onpage', label: 'SEO (on-page)', status: 'ok', score: 70,
      summary: '4 issues. Has JSON-LD; sitemap missing.',
      issues: [
        { severity: 'high', title: 'No structured data (JSON-LD)', description: 'Critical for local search.', quickFix: 'Add MedicalBusiness JSON-LD.' },
      ],
      evidence: {
        title: 'Example Aesthetics — Med Spa in Austin', titleLength: 42,
        metaDescription: 'Austin\'s best...', metaDescriptionLength: 30,
        h1Count: 1, imagesTotal: 12, imagesMissingAlt: 4,
        hasCanonical: true, hasOpenGraph: false, hasTwitterCard: false,
        hasJsonLd: false, jsonLdTypes: [], hasFavicon: true,
        robotsTxtOk: true, sitemapXmlOk: false, htmlLangPresent: true,
      } as any,
    },
    { id: 'seo-ranking', label: 'SEO (Google rank)', status: 'skipped', score: null, summary: 'Skipped — SERPAPI_API_KEY not set.', issues: [], skipReason: 'SERPAPI_API_KEY not set.' },
    { id: 'llm-copy-aeo', label: 'LLM copy / AEO', status: 'ok', score: 55, summary: 'Copy is generic; few declarative facts.', issues: [
      { severity: 'high', title: 'No FAQ section', description: 'LLMs rarely surface this clinic.', quickFix: 'Add 8 Q&A pairs about top services.' }] },
    {
      id: 'llm-discoverability', label: 'LLM discoverability', status: 'ok', score: 18,
      summary: '1/12 answers mention the clinic; 0/12 cite the website.',
      issues: [
        { severity: 'critical', title: 'OPENAI does not recognize Example Aesthetics', description: '0/4 direct questions answered with clinic info.', quickFix: 'Claim Google Business Profile, add MedicalBusiness JSON-LD, list on Yelp/Healthgrades.' },
      ],
      evidence: {
        providers: ['claude', 'perplexity', 'openai'],
        rounds: [
          { question: 'What are the best med spas in Austin?', answers: [
            { provider: 'claude', answer: 'Several reputable med spas in Austin include...', citations: ['https://example-medspa.com', 'https://yelp.com'], mentionsClinic: true, citesWebsite: true },
            { provider: 'perplexity', answer: 'Top med spas in Austin: 1) X, 2) Y, 3) Z', citations: [], mentionsClinic: false, citesWebsite: false },
            { provider: 'openai', answer: 'I\'d recommend looking on Yelp.', citations: [], mentionsClinic: false, citesWebsite: false },
          ] },
          { question: 'Tell me about Example Aesthetics.', answers: [
            { provider: 'claude', answer: 'I cannot find specific information about Example Aesthetics.', citations: [], mentionsClinic: false, citesWebsite: false },
            { provider: 'perplexity', answer: 'Example Aesthetics is...', citations: ['https://yelp.com/biz/example'], mentionsClinic: true, citesWebsite: false },
            { provider: 'openai', answer: 'No info available.', citations: [], mentionsClinic: false, citesWebsite: false },
          ] },
        ],
      } as any,
    },
    {
      id: 'copy-conversion', label: 'Copy & conversion', status: 'ok', score: 62,
      summary: 'Covers services and credentials but missing pricing & financing.',
      issues: [{ severity: 'high', title: 'No pricing transparency', description: 'Not even ranges shown.', quickFix: 'Add a "starting at" price by service.' }],
      evidence: {
        coverage: {
          servicesList: true, pricingTransparency: false, whatToExpect: true, beforeAfterEvidence: false,
          credentials: true, hours: true, locationParking: false, financing: false,
          consultationCta: true, trustReviews: true, objectionHandling: false, faq: false,
        },
      } as any,
    },
    { id: 'design-review', label: 'Design', status: 'ok', score: 72, summary: 'Clean but dated.', issues: [{ severity: 'medium', title: 'Hero stock photo reads as generic', description: '...', quickFix: 'Replace with real practice photo.' }] },
    {
      id: 'ux-medspa', label: 'UX (med spa)', status: 'ok', score: 35,
      summary: 'Tel: ✓ · Book CTA: ✗ · Sticky: ✗ · Live chat: none',
      issues: [
        { severity: 'critical', title: 'No "Book consultation" CTA detected', description: 'Conversion path missing.', quickFix: 'Add primary CTA in header.' },
        { severity: 'high', title: 'No live chat widget', description: 'High-intent buyers cannot ask quick questions.', quickFix: 'Install Podium or Tidio.' },
      ],
      evidence: {
        hasTelLink: true, telHref: 'tel:+15125550100', telVisibleAboveFold: false,
        hasBookCta: false, bookCtaText: null, bookCtaAboveFold: false, bookCtaCount: 0,
        hasStickyMobileCta: false, hasContactForm: true, contactFormFieldCount: 6,
        liveChatProviders: [], hasPhoneInHeader: true, mobileAvgTapTargetWarn: false,
      } as any,
    },
  ],
};

renderReport(report, outputDir).then((p) => {
  console.log('Rendered:', p);
});
