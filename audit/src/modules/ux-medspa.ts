import { chromium, Browser } from 'playwright';
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

interface PageProbe {
  url: string;
  label: string;
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
}

interface UxEvidence {
  pages: PageProbe[];
  // Aggregated booleans — if ANY probed page has the feature, it's true
  hasTelLink: boolean;
  telVisibleAboveFold: boolean;
  hasBookCta: boolean;
  bookCtaText: string | null;
  bookCtaAboveFold: boolean;
  hasStickyMobileCta: boolean;
  hasContactForm: boolean;
  contactFormFieldCount: number;
  liveChatProviders: string[];
  hasPhoneInHeader: boolean;
}

async function probePage(browser: Browser, url: string, label: string): Promise<PageProbe | null> {
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

    const data: any = await page.evaluate(() => {
      const FOLD = 844;
      const tel = Array.from(document.querySelectorAll('a[href^="tel:"]')) as HTMLAnchorElement[];
      const bookRegex = /book|consult|schedule|appointment|reserve/i;
      const bookCandidates = Array.from(document.querySelectorAll('a, button')) as HTMLElement[];
      const bookEls = bookCandidates.filter((el) => bookRegex.test((el.innerText || '').trim()) && el.offsetParent !== null);

      const stickyEls = Array.from(document.querySelectorAll('*')).filter((el) => {
        const s = window.getComputedStyle(el as HTMLElement);
        return (s.position === 'fixed' || s.position === 'sticky') && (el as HTMLElement).offsetHeight < 200;
      }) as HTMLElement[];
      const stickyHasCta = stickyEls.some((el) => /book|call|consult|schedule|tel/.test((el.innerText || '').toLowerCase()));

      const forms = Array.from(document.querySelectorAll('form')) as HTMLFormElement[];
      const contactForms = forms.filter((f) => {
        const txt = ((f.innerText || '') + ' ' + (f.getAttribute('action') || '')).toLowerCase();
        return /contact|consult|book|appointment|message|inquiry/.test(txt);
      });

      let phoneInHeader = false;
      for (const sel of ['header', 'nav', '[role="banner"]']) {
        const h = document.querySelector(sel);
        if (h && h.querySelector('a[href^="tel:"]')) {
          phoneInHeader = true;
          break;
        }
      }

      return {
        hasTelLink: tel.length > 0,
        telHref: tel[0]?.href || null,
        telVisibleAboveFold: tel.some((a) => {
          const r = a.getBoundingClientRect();
          return r.top >= 0 && r.top < FOLD && r.width > 0 && r.height > 0;
        }),
        hasBookCta: bookEls.length > 0,
        bookCtaText: bookEls[0] ? bookEls[0].innerText.trim().slice(0, 60) : null,
        bookCtaAboveFold: bookEls.some((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.top < FOLD;
        }),
        bookCtaCount: bookEls.length,
        hasStickyMobileCta: stickyHasCta,
        hasContactForm: contactForms.length > 0,
        contactFormFieldCount: contactForms[0]
          ? contactForms[0].querySelectorAll('input:not([type=hidden]), select, textarea').length
          : 0,
        hasPhoneInHeader: phoneInHeader,
      };
    });

    const liveChatProviders: string[] = [];
    for (const p of CHAT_PROVIDERS) {
      if (p.patterns.some((re) => re.test(html))) liveChatProviders.push(p.name);
    }

    await ctx.close();
    return { url, label, liveChatProviders, ...data };
  } catch {
    return null;
  }
}

export interface UxTargets {
  home: string;
  booking?: string;
  contact?: string;
}

export async function runUxMedspaModule(targets: UxTargets): Promise<ModuleResult<UxEvidence>> {
  const start = Date.now();
  const browser = await chromium.launch({ headless: true });
  try {
    const probeJobs: { url: string; label: string }[] = [{ url: targets.home, label: 'home' }];
    if (targets.booking && targets.booking !== targets.home) probeJobs.push({ url: targets.booking, label: 'booking' });
    if (targets.contact && targets.contact !== targets.home && targets.contact !== targets.booking) {
      probeJobs.push({ url: targets.contact, label: 'contact' });
    }

    const probesRaw = await Promise.all(probeJobs.map((j) => probePage(browser, j.url, j.label)));
    const probes = probesRaw.filter((p): p is PageProbe => p !== null);
    if (probes.length === 0) {
      return {
        id: 'ux-medspa',
        label: 'UX (med spa)',
        status: 'error',
        score: null,
        summary: 'All UX probes failed.',
        issues: [],
        errorMessage: 'No pages were reachable for UX probing',
        durationMs: Date.now() - start,
      };
    }

    // Aggregate: any probed page satisfying a check is enough
    const liveChatProvidersAgg = Array.from(new Set(probes.flatMap((p) => p.liveChatProviders)));
    const bookCtaPage = probes.find((p) => p.hasBookCta && p.bookCtaAboveFold) || probes.find((p) => p.hasBookCta);
    const formPage = probes.reduce<PageProbe | null>((best, p) => {
      if (!p.hasContactForm) return best;
      if (!best) return p;
      return p.contactFormFieldCount > best.contactFormFieldCount ? p : best;
    }, null);

    const ev: UxEvidence = {
      pages: probes,
      hasTelLink: probes.some((p) => p.hasTelLink),
      telVisibleAboveFold: probes.some((p) => p.telVisibleAboveFold),
      hasBookCta: probes.some((p) => p.hasBookCta),
      bookCtaText: bookCtaPage?.bookCtaText ?? null,
      bookCtaAboveFold: probes.some((p) => p.bookCtaAboveFold),
      hasStickyMobileCta: probes.some((p) => p.hasStickyMobileCta),
      hasContactForm: !!formPage,
      contactFormFieldCount: formPage?.contactFormFieldCount ?? 0,
      liveChatProviders: liveChatProvidersAgg,
      hasPhoneInHeader: probes.some((p) => p.hasPhoneInHeader),
    };

    const homepageProbe = probes.find((p) => p.label === 'home')!;

    const issues: Issue[] = [];
    if (!ev.hasTelLink) {
      issues.push({
        severity: 'critical',
        title: 'No click-to-call (tel:) link anywhere on the site',
        description: 'Mobile users cannot tap to dial on any of the probed pages.',
        quickFix: 'Add <a href="tel:+1XXXXXXXXXX">Call (xxx) xxx-xxxx</a> in the header and as a sticky mobile button.',
      });
    } else if (!homepageProbe.telVisibleAboveFold) {
      issues.push({
        severity: 'high',
        title: 'Phone link present but not above the fold on the homepage (mobile)',
        description: 'High-intent visitors must scroll first.',
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

    if (!homepageProbe.hasBookCta && ev.hasBookCta) {
      const where = probes.find((p) => p.hasBookCta)?.label;
      issues.push({
        severity: 'high',
        title: `Book-consultation CTA only exists on /${where}, not the homepage`,
        description: 'Visitors landing on the homepage never see the conversion action.',
        quickFix: 'Add a primary "Book a Consultation" CTA to the homepage header.',
      });
    } else if (!ev.hasBookCta) {
      issues.push({
        severity: 'critical',
        title: 'No "Book consultation" call-to-action detected on any probed page',
        description: 'Visitors at peak intent have nowhere obvious to convert.',
        quickFix: 'Add a primary CTA button: "Book a Consultation". Repeat after every services section.',
      });
    } else if (!homepageProbe.bookCtaAboveFold) {
      issues.push({
        severity: 'high',
        title: 'Homepage Book CTA is below the fold',
        description: 'Users must scroll to find the conversion action.',
        quickFix: 'Place the primary CTA in the header so it is visible without scrolling.',
      });
    } else if (homepageProbe.bookCtaCount === 1) {
      issues.push({
        severity: 'low',
        title: 'Only one "Book" CTA on the homepage',
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

    if (liveChatProvidersAgg.length === 0) {
      issues.push({
        severity: 'high',
        title: 'No live chat widget detected on any probed page',
        description: 'Med spa buyers want to ask "how much?" / "does it hurt?" / "do you have availability Saturday?" before committing.',
        quickFix: 'Install Podium, Birdeye, or Tidio. SMS-back chat widgets convert best for local service businesses.',
      });
    } else {
      issues.push({
        severity: 'info',
        title: `Live chat present: ${liveChatProvidersAgg.join(', ')}`,
        description: 'Confirm responses are timely; abandoned chats hurt more than no chat.',
      });
    }

    if (!ev.hasContactForm) {
      issues.push({
        severity: 'medium',
        title: 'No contact / consultation form detected on any probed page',
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
      summary: `Probed ${probes.length} page(s) · Tel: ${ev.hasTelLink ? '✓' : '✗'} · Book CTA: ${ev.hasBookCta ? '✓' : '✗'} · Sticky: ${ev.hasStickyMobileCta ? '✓' : '✗'} · Live chat: ${liveChatProvidersAgg[0] || 'none'}`,
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
