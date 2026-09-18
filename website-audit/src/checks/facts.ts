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
  $('a[href^="mailto:"]').each((_, el) => {
    const addr = ($(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(addr)) emails.add(addr);
  });
  if (org && typeof org['email'] === 'string') {
    const addr = String(org['email']).replace(/^mailto:/i, '').trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(addr)) emails.add(addr);
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

  const services = new Set<string>();
  const NOISE = /^(home|about( us)?|contact( us)?|blog|faqs?|login|menu|search|gallery|reviews?|testimonials?|careers?|apply|portfolio|news)$/i;
  const PHONEISH = /\d{3}[\s.-]?\d{4}|call|email|book|schedule|quote|estimate/i;
  for (const t of navText ?? []) if (t.length >= 3 && t.length <= 40 && !NOISE.test(t) && !PHONEISH.test(t)) services.add(t);
  for (const h of headingTexts($, 'h2, h3')) if (h.length >= 3 && h.length <= 60 && !NOISE.test(h) && !PHONEISH.test(h)) services.add(snippet(h, 60));
  if (services.size) sources.services = 'nav+headings';

  return {
    business_name,
    phones: [...phones].slice(0, 5),
    emails: [...emails].slice(0, 3),
    address,
    hours,
    services: [...services].slice(0, 25),
    sources,
  };
}
