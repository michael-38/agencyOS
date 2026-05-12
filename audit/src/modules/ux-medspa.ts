import { chromium } from 'playwright';
import { Issue, ModuleResult } from '../types.js';
import { scoreFromIssues, sortIssues } from '../utils/scoring.js';

const CHAT_PROVIDERS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Intercom', patterns: [/intercom\.io/i, /window\.Intercom/i, /intercomSettings/i] },
  { name: 'Drift', patterns: [/drift\.com/i, /window\.drift/i] },
  { name: 'Tawk.to', patterns: [/tawk\.to/i, /Tawk_API/i] },
  { name: 'Crisp', patterns: [/crisp\.chat/i, /\$crisp/i] },
  { name: 'Tidio', patterns: [/tidio\.co/i, /tidioChatApi/i] },
  { name: 'HubSpot Chat', patterns: [/hs-scripts\.com/i, /HubSpotConversations/i] },
  { name: 'Zendesk Chat', patterns: [/zopim\.com/i, /zE\(['"]webWidget/i, /static\.zdassets\.com/i] },
  { name: 'LiveChat', patterns: [/livechatinc\.com/i, /__lc/i] },
  { name: 'Podium', patterns: [/podium\.com\/widget/i, /Podium/i] },
  { name: 'Birdeye', patterns: [/birdeye\.com/i] },
  { name: 'Hyperworkflow', patterns: [/HyperworkflowChat/i, /hyperworkflow-chat/i] },
];

interface UxEvidence {
  hasTelLink: boolean;
  telHref: string | null;
  telVisibleAboveFold: boolean;
  hasBookCta: boolean;
  bookCtaText: string | null;
  bookCtaAboveFold: boolean;
  bookCtaCount: number;
  hasStickyMobileCta: boolean;
  hasContactForm: boolean;
  contactFormFieldCount: number;
  liveChatProviders: string[];
  hasPhoneInHeader: boolean;
  mobileAvgTapTargetWarn: boolean;
}

export async function runUxMedspaModule(url: string): Promise<ModuleResult<UxEvidence>> {
  const start = Date.now();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const html = await page.content();

    const ev: UxEvidence = await page.evaluate(() => {
      const data: any = {};
      const FOLD = 844;
      const tel = Array.from(document.querySelectorAll('a[href^="tel:"]')) as HTMLAnchorElement[];
      data.hasTelLink = tel.length > 0;
      data.telHref = tel[0]?.href || null;
      data.telVisibleAboveFold = tel.some((a) => {
        const r = a.getBoundingClientRect();
        return r.top >= 0 && r.top < FOLD && r.width > 0 && r.height > 0;
      });

      const bookRegex = /book|consult|schedule|appointment|reserve/i;
      const bookCandidates = Array.from(document.querySelectorAll('a, button')) as HTMLElement[];
      const bookEls = bookCandidates.filter((el) => bookRegex.test((el.innerText || '').trim()) && el.offsetParent !== null);
      data.hasBookCta = bookEls.length > 0;
      data.bookCtaText = bookEls[0] ? bookEls[0].innerText.trim().slice(0, 60) : null;
      data.bookCtaAboveFold = bookEls.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < FOLD;
      });
      data.bookCtaCount = bookEls.length;

      const stickyEls = Array.from(document.querySelectorAll('*')).filter((el) => {
        const s = window.getComputedStyle(el as HTMLElement);
        return (s.position === 'fixed' || s.position === 'sticky') && (el as HTMLElement).offsetHeight < 200;
      }) as HTMLElement[];
      const stickyHasCta = stickyEls.some((el) => {
        const txt = (el.innerText || '').toLowerCase();
        return /book|call|consult|schedule|tel/.test(txt);
      });
      data.hasStickyMobileCta = stickyHasCta;

      const forms = Array.from(document.querySelectorAll('form')) as HTMLFormElement[];
      const contactForms = forms.filter((f) => {
        const txt = ((f.innerText || '') + ' ' + (f.getAttribute('action') || '')).toLowerCase();
        return /contact|consult|book|appointment|message|inquiry/.test(txt);
      });
      data.hasContactForm = contactForms.length > 0;
      data.contactFormFieldCount = contactForms[0]
        ? contactForms[0].querySelectorAll('input:not([type=hidden]), select, textarea').length
        : 0;

      const headerSel = ['header', 'nav', '[role="banner"]'];
      let phoneInHeader = false;
      for (const sel of headerSel) {
        const h = document.querySelector(sel);
        if (h && h.querySelector('a[href^="tel:"]')) {
          phoneInHeader = true;
          break;
        }
      }
      data.hasPhoneInHeader = phoneInHeader;
      return data;
    });

    const liveChatProviders: string[] = [];
    for (const p of CHAT_PROVIDERS) {
      if (p.patterns.some((re) => re.test(html))) liveChatProviders.push(p.name);
    }
    ev.liveChatProviders = liveChatProviders;
    ev.mobileAvgTapTargetWarn = false;

    const issues: Issue[] = [];
    if (!ev.hasTelLink) {
      issues.push({
        severity: 'critical',
        title: 'No click-to-call (tel:) link anywhere on the page',
        description: 'Mobile users cannot tap to dial. Highest-intent visitors lose a frictionless conversion path.',
        quickFix: 'Add <a href="tel:+1XXXXXXXXXX">Call (xxx) xxx-xxxx</a> in the header and as a sticky mobile button.',
      });
    } else if (!ev.telVisibleAboveFold) {
      issues.push({
        severity: 'high',
        title: 'Phone link present but not above the fold on mobile',
        description: 'Calls require scrolling first.',
        quickFix: 'Move the tel: link into the mobile header so it appears in the first 844px.',
      });
    }
    if (!ev.hasPhoneInHeader) {
      issues.push({
        severity: 'medium',
        title: 'No phone number in the site header',
        description: 'A persistent header phone is the easiest call-to-action for med spas.',
        quickFix: 'Add a tel: link in the header on every page, styled prominently.',
      });
    }

    if (!ev.hasBookCta) {
      issues.push({
        severity: 'critical',
        title: 'No "Book consultation" call-to-action detected',
        description: 'Visitors at peak intent have nowhere obvious to convert.',
        quickFix: 'Add a primary CTA button in the header: "Book a Consultation". Repeat it after every services section.',
      });
    } else if (!ev.bookCtaAboveFold) {
      issues.push({
        severity: 'high',
        title: 'Book-consultation CTA exists but is below the fold',
        description: 'Users must scroll to find the conversion action.',
        quickFix: 'Place the primary CTA in the header so it is visible without scrolling.',
      });
    } else if (ev.bookCtaCount === 1) {
      issues.push({
        severity: 'low',
        title: 'Only one "Book" CTA on the page',
        description: 'Long pages should repeat the conversion action.',
        quickFix: 'Repeat the booking CTA after each services / before-after / testimonial section.',
      });
    }

    if (!ev.hasStickyMobileCta) {
      issues.push({
        severity: 'high',
        title: 'No sticky mobile CTA bar',
        description: 'A persistent "Call / Book" bar at the bottom of mobile screens dramatically lifts conversion for service businesses.',
        quickFix: 'Add a position:fixed bottom bar with two buttons: Call and Book.',
      });
    }

    if (liveChatProviders.length === 0) {
      issues.push({
        severity: 'high',
        title: 'No live chat widget detected',
        description: 'Med spa buyers want to ask "how much?" / "does it hurt?" / "do you have availability Saturday?" before committing. Live chat at peak intent converts.',
        quickFix: 'Install Podium, Birdeye, or Tidio. SMS-back chat widgets convert best for local service businesses.',
      });
    } else {
      issues.push({
        severity: 'info',
        title: `Live chat present: ${liveChatProviders.join(', ')}`,
        description: 'Confirm responses are timely; abandoned chats hurt more than no chat.',
      });
    }

    if (!ev.hasContactForm) {
      issues.push({
        severity: 'medium',
        title: 'No contact / consultation form detected',
        description: 'Some visitors will not call or chat — a form is the asynchronous fallback.',
        quickFix: 'Add a short consultation request form (name, phone, treatment of interest).',
      });
    } else if (ev.contactFormFieldCount > 7) {
      issues.push({
        severity: 'medium',
        title: `Consultation form has ${ev.contactFormFieldCount} fields — too long`,
        description: 'Each extra field cuts completion rate.',
        quickFix: 'Reduce to 3–5 fields: name, phone, email, treatment of interest, preferred time.',
      });
    }

    return {
      id: 'ux-medspa',
      label: 'UX (med spa)',
      status: 'ok',
      score: scoreFromIssues(issues.filter((i) => i.severity !== 'info')),
      summary: `Tel: ${ev.hasTelLink ? '✓' : '✗'} · Book CTA: ${ev.hasBookCta ? '✓' : '✗'} · Sticky: ${ev.hasStickyMobileCta ? '✓' : '✗'} · Live chat: ${liveChatProviders[0] || 'none'}`,
      issues: sortIssues(issues),
      evidence: ev,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      id: 'ux-medspa',
      label: 'UX (med spa)',
      status: 'error',
      score: null,
      summary: 'UX checks failed.',
      issues: [],
      errorMessage: err.message,
      durationMs: Date.now() - start,
    };
  } finally {
    await browser.close();
  }
}
