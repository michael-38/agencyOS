// Deterministic facts extraction: what v2 must preserve verbatim. Generic across industries.
import { $of, jsonldOf, PageContext } from './registry.js';
import { headingTexts, snippet, telHrefs, typesOf, visibleText } from './html.js';

export interface Facts {
  business_name: string | null;
  phones: string[];
  emails: string[];
  address: Record<string, unknown> | string | null;
  hours: unknown | null;
  services: string[];
  sources: Record<string, string>;
}

// Organization-like JSON-LD types: generic schema.org families plus the data-driven subtype list from detectors.yaml.
const ORG_FAMILY = /business|organization|organisation|service|store|company|corporation/i;
const isOrgType = (t: string, subtypes: string[]): boolean => ORG_FAMILY.test(t) || subtypes.some((s) => s.toLowerCase() === t.toLowerCase());

export function extractFacts(ctx: PageContext, navText?: string[]): Facts {
  const $ = $of(ctx);
  const ld = jsonldOf(ctx);
  const sources: Record<string, string> = {};

  const org = ld.objects.find((o) => typesOf(o).some((t) => isOrgType(t, ctx.detectors.schema_org_local_business_subtypes)) && typeof o['name'] === 'string');
  let business_name: string | null = null;
  if (org) {
    business_name = String(org['name']);
    sources.business_name = 'jsonld';
  } else {
    const og = ($('meta[property="og:site_name"]').attr('content') || '').trim();
    if (og) {
      business_name = og;
      sources.business_name = 'og:site_name';
    } else {
      const title = ($('title').first().text() || '').trim();
      if (title) {
        business_name = title.split(/\s[|\-–—]\s/)[0].trim();
        sources.business_name = 'title';
      }
    }
  }

  const phones = new Set<string>();
  for (const href of telHrefs($)) phones.add(href.replace(/^tel:\/*/i, '').trim());
  if (org && typeof org['telephone'] === 'string') phones.add(String(org['telephone']).trim());
  if (!phones.size && ctx.detectors.phoneRe) {
    const text = visibleText($);
    const re = new RegExp(ctx.detectors.phoneRe.source, 'gi');
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text)) && n < 3) {
      phones.add(m[0].trim());
      n++;
    }
  }
  if (phones.size) sources.phones = telHrefs($).length ? 'tel-links' : org ? 'jsonld' : 'regex';

  // mailto: only. A regex over visible text picks up obfuscated and third-party addresses, and a
  // wrong contact address on a rebuilt page is worse than no contact address.
  const emails = new Set<string>();
  /** mailto: hrefs are percent-encoded in the wild, and `%20name@host` is not an address. */
  const cleanEmail = (raw: string): string | null => {
    let v = raw.replace(/^mailto:/i, '').split('?')[0];
    try {
      v = decodeURIComponent(v);
    } catch {
      // A malformed escape sequence means this is not an address worth keeping.
      return null;
    }
    v = v.trim().toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v) ? v : null;
  };
  $('a[href^="mailto:"]').each((_, el) => {
    const addr = cleanEmail($(el).attr('href') ?? '');
    if (addr) emails.add(addr);
  });
  if (org && typeof org['email'] === 'string') {
    const addr = cleanEmail(String(org['email']));
    if (addr) emails.add(addr);
  }
  if (emails.size) sources.emails = $('a[href^="mailto:"]').length ? 'mailto-links' : 'jsonld';

  let address: Facts['address'] = null;
  const ldAddr = ld.objects.find((o) => 'address' in o);
  if (ldAddr) {
    address = ldAddr['address'] as Facts['address'];
    sources.address = 'jsonld';
  } else {
    const el = $('address').first().text().replace(/\s+/g, ' ').trim();
    if (el) {
      address = el;
      sources.address = 'address-element';
    } else if (ctx.detectors.addressRe) {
      const m = ctx.detectors.addressRe.exec(visibleText($));
      if (m) {
        address = m[0];
        sources.address = 'regex';
      }
    }
  }

  let hours: unknown = null;
  const ldHours = ld.objects.find((o) => 'openingHours' in o || 'openingHoursSpecification' in o);
  if (ldHours) {
    hours = ldHours['openingHours'] ?? ldHours['openingHoursSpecification'];
    sources.hours = 'jsonld';
  } else if (ctx.detectors.hoursRe) {
    const m = ctx.detectors.hoursRe.exec(visibleText($));
    if (m) {
      hours = m[0];
      sources.hours = 'regex';
    }
  }

  // Services are swept out of the nav and the headings, which means page chrome arrives with them.
  // That matters beyond the report: validate.ts treats facts.services as things the source site
  // says, so "Skip to content" in this array widens what generated copy is allowed to claim.
  const services = new Map<string, string>();
  const NOISE = /^(home|about( us)?|contact( us)?|blog|faqs?|login|menu|search|gallery|reviews?|testimonials?|careers?|apply|portfolio|news)$/i;
  const PHONEISH = /\d{3}[\s.-]?\d{4}|call|email|book|schedule|quote|estimate/i;
  const chrome = new Set((ctx.detectors.nav_chrome ?? []).map((c) => c.trim().toLowerCase()));
  const isChrome = (raw: string): boolean => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,:;!?]+$/, '');
    if (chrome.has(t)) return true;
    if (t.startsWith('skip to')) return true;
    // A shouted multi-word string is a button, not a service name.
    if (/\s/.test(raw.trim()) && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return true;
    // Six words or more is a heading or a sentence, not the name of a thing being sold.
    if (t.split(' ').length >= 6) return true;
    return false;
  };
  const add = (raw: string) => {
    const t = raw.trim();
    if (t.length < 3 || NOISE.test(t) || PHONEISH.test(t) || isChrome(t)) return;
    // Case-insensitive dedupe, keeping the first spelling seen.
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    if (!services.has(key)) services.set(key, t);
  };
  for (const t of navText ?? []) if (t.length <= 40) add(t);
  for (const h of headingTexts($, 'h2, h3')) if (h.length <= 60) add(snippet(h, 60));
  if (services.size) sources.services = 'nav+headings';

  return {
    business_name,
    phones: [...phones].slice(0, 5),
    emails: [...emails].slice(0, 3),
    address,
    hours,
    services: [...services.values()].slice(0, 25),
    sources,
  };
}
