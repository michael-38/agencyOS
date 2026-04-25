import * as cheerio from 'cheerio';
import { BusinessType, ExtractedBusinessData, RewrittenCopy } from '../types.js';

export type CheerioDoc = cheerio.CheerioAPI;

// ---------------------------------------------------------------------------
// Placeholder constants per template
// ---------------------------------------------------------------------------

export const PLACEHOLDERS: Record<BusinessType, {
  companyName: string;
  phone: string;
  phoneRaw: string;
  primaryCity: string;
}> = {
  roofing: {
    companyName: 'Summit Roofing Co.',
    phone: '(555) 123-4567',
    phoneRaw: '+15551234567',
    primaryCity: 'Austin',
  },
  hvac: {
    companyName: 'Evergreen Climate Solutions',
    phone: '(555) 987-6543',
    phoneRaw: '+15559876543',
    primaryCity: 'Denver',
  },
  plumbing: {
    companyName: 'FlowRight Plumbing',
    phone: '(555) 246-8135',
    phoneRaw: '+15552468135',
    primaryCity: 'Phoenix',
  },
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Escape a string for safe HTML interpolation. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Build a tel: URI from a phone string. */
export function toTelHref(phone: string): string {
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  return '+' + (digits.startsWith('1') ? digits : '1' + digits);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Generate star SVGs for a given rating. */
export function generateStarsSvg(rating: number, style: 'simple' | 'phosphor'): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const svg = style === 'simple'
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,91l59.46-5.15,23.21-55.36a16.4,16.4,0,0,1,30.5,0l23.21,55.36L226.92,91A16.46,16.46,0,0,1,234.29,114.85Z"/></svg>';

  let html = '';
  for (let i = 0; i < fullStars; i++) {
    html += svg + '\n              ';
  }
  if (hasHalf) html += svg + '\n              ';
  return html.trim();
}

/** Phosphor checkmark SVG. */
export const CHECK_SVG_PHOSPHOR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>';

/** Simple checkmark SVG. */
export const CHECK_SVG_SIMPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>';

/** Feather-style checkmark SVG. */
export const CHECK_SVG_FEATHER = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

// ---------------------------------------------------------------------------
// Location pin SVGs
// ---------------------------------------------------------------------------

export const CITY_PIN_SIMPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

export const CITY_PIN_PHOSPHOR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.36,134.55a8,8,0,0,0,9.28,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>';

export const CITY_PIN_SMALL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

// ---------------------------------------------------------------------------
// Shared population functions
// ---------------------------------------------------------------------------

/** Update meta title and description. */
export function populateMeta($: CheerioDoc, copy: RewrittenCopy): void {
  $('title').text(copy.titleTag);
  $('meta[name="description"]').attr('content', copy.metaDescription);
}

/** Replace review card content. Works across all three templates. */
export function populateReviewCards(
  $: CheerioDoc,
  copy: RewrittenCopy,
  starStyle: 'simple' | 'phosphor',
  quoteSelector: string,
): void {
  const reviews = copy.reviews;
  if (!reviews.length) return;

  const cards = $('.review-card');
  cards.each((i, el) => {
    if (i >= reviews.length) return;
    const $card = $(el);
    const review = reviews[i];

    // Stars
    const starsEl = $card.find('.review-stars');
    if (starsEl.length) {
      starsEl.attr('aria-label', `${review.rating} out of 5 stars`);
      starsEl.html(generateStarsSvg(review.rating, starStyle));
    }

    // Quote
    const quote = $card.find(quoteSelector);
    if (quote.length) quote.text(`"${review.text}"`);

    // Author
    const authorLocation = review.authorLocation ? `, ${escapeHtml(review.authorLocation)}` : '';
    const author = $card.find('.review-author');
    if (author.length) author.html(`&mdash; ${escapeHtml(review.authorName)}${authorLocation}`);
  });
}

/** Replace process/how-it-works step content. */
export function populateSteps(
  $: CheerioDoc,
  copy: RewrittenCopy,
  stepSelector: string,
): void {
  const steps = copy.processSteps;
  if (!steps.length) return;

  $(stepSelector).each((i, el) => {
    if (i >= steps.length) return;
    const $step = $(el);
    $step.find('h3').text(steps[i].title);
    $step.find('p').text(steps[i].description);
  });
}

/** Replace "Why Choose Us" items. */
export function populateDifferentiators(
  $: CheerioDoc,
  copy: RewrittenCopy,
  itemSelector: string,
): void {
  const diffs = copy.differentiators;
  if (!diffs.length) return;

  $(itemSelector).each((i, el) => {
    if (i >= diffs.length) return;
    const $item = $(el);
    const heading = $item.find('h4').length ? $item.find('h4') : $item.find('h3');
    if (heading.length) heading.text(diffs[i].heading);
    const desc = $item.find('p');
    if (desc.length) desc.text(diffs[i].oneLiner);
  });
}

/** Rebuild a city list from service areas. */
export function rebuildCityList(
  $: CheerioDoc,
  listSelector: string,
  areas: string[],
  pinSvg: string,
  wrapTag: 'li' | 'div' = 'li',
  wrapClass?: string,
): void {
  if (!areas.length) return;
  const list = $(listSelector);
  if (!list.length) return;

  list.empty();
  areas.forEach((city) => {
    const cls = wrapClass ? ` class="${wrapClass}"` : '';
    list.append(`<${wrapTag}${cls}>\n                ${pinSvg}\n                ${escapeHtml(city)}\n              </${wrapTag}>`);
  });
}

/** Update footer copyright with current year. */
export function updateCopyright(
  $: CheerioDoc,
  selector: string,
  companyName: string,
  licenseNumber: string | null,
  suffix: string,
): void {
  const el = $(selector);
  if (!el.length) return;
  const license = licenseNumber ? ` License #${escapeHtml(licenseNumber)}.` : '';
  el.html(`&copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. ${suffix}${license}`);
}

/** Update select dropdown options from services list. */
export function updateServiceSelect(
  $: CheerioDoc,
  selectSelector: string,
  services: Array<{ name: string }>,
): void {
  if (!services.length) return;
  const selectEl = $(selectSelector);
  if (!selectEl.length) return;

  const placeholder = selectEl.find('option').first();
  selectEl.empty();
  if (placeholder.length) selectEl.append(placeholder);

  services.forEach((service) => {
    const value = service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    selectEl.append(`<option value="${escapeHtml(value)}">${escapeHtml(service.name)}</option>`);
  });
  selectEl.append('<option value="other">Other</option>');
}

// ---------------------------------------------------------------------------
// Global string replacements (phone, company name, city)
// ---------------------------------------------------------------------------

export function applyGlobalReplacements(
  $: CheerioDoc,
  templateType: BusinessType,
  data: ExtractedBusinessData,
): string {
  const ph = PLACEHOLDERS[templateType];
  const telHref = toTelHref(data.phoneRaw || data.phone);

  // Update all tel: and sms: hrefs via Cheerio
  $('a[href^="tel:"]').each((_, el) => { $(el).attr('href', `tel:${telHref}`); });
  $('a[href^="sms:"]').each((_, el) => { $(el).attr('href', `sms:${telHref}`); });

  // Serialize and do string-level replacements
  let html = $.html();
  html = html.split(ph.phone).join(data.phone);
  html = html.split(ph.phoneRaw).join(telHref);
  html = html.split(ph.companyName).join(data.companyName);

  // City replacement with word boundaries
  const cityRegex = new RegExp(`\\b${escapeRegex(ph.primaryCity)}\\b`, 'g');
  html = html.replace(cityRegex, data.primaryCity);

  return html;
}
