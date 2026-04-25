import * as cheerio from 'cheerio';
import { ExtractedBusinessData, RewrittenCopy } from '../types.js';
import {
  CheerioDoc,
  toTelHref,
  populateMeta,
  populateReviewCards,
  populateSteps,
  populateDifferentiators,
  rebuildCityList,
  updateCopyright,
  updateServiceSelect,
  applyGlobalReplacements,
  escapeHtml,
  CHECK_SVG_SIMPLE,
  CITY_PIN_SIMPLE,
} from './shared.js';

export function populateRoofingTemplate(
  rawHtml: string,
  data: ExtractedBusinessData,
  copy: RewrittenCopy,
): string {
  const $ = cheerio.load(rawHtml);

  populateMeta($, copy);
  populateHero($, copy, data);
  populateStormBanner($, copy);
  populateServices($, copy, data);
  populateDifferentiators($, copy, '.why-us-item');
  populateReviewCards($, copy, 'simple', '.review-text');
  populateBookingForm($, copy, data);
  populateGallery($, copy);
  populateSteps($, copy, '.process-step');
  populateServiceAreaSection($, copy, data);
  populateFinalCta($, copy);
  populateFooterSection($, data, copy);
  populateJsonLd($, data);

  return applyGlobalReplacements($, 'roofing', data);
}

// ---------------------------------------------------------------------------
// Roofing-specific section populators
// ---------------------------------------------------------------------------

function populateHero($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const hero = $('.hero');
  if (!hero.length) return;

  hero.find('h1').text(copy.heroHeadline);
  hero.find('.hero-sub').text(copy.heroSubheadline);

  const ctaBtn = hero.find('.hero-ctas .btn-primary');
  if (ctaBtn.length) {
    ctaBtn.html(escapeHtml(copy.heroPrimaryCta) + ' &rarr;');
  }
}

function populateStormBanner($: CheerioDoc, copy: RewrittenCopy): void {
  const banner = $('.storm-banner');
  if (!banner.length) return;
  banner.find('.storm-banner-text').text(copy.emergencyBannerText);
}

function populateServices($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const services = copy.services;
  if (!services.length) return;

  const telHref = toTelHref(data.phoneRaw || data.phone);

  $('.service-card').each((i, el) => {
    if (i >= services.length) return;
    const $card = $(el);
    $card.find('h3').text(services[i].title);
    $card.find('p').text(services[i].description);

    const link = $card.find('.service-card-link');
    if (link.length) {
      link.text(services[i].ctaText + ' \u2192');
      if (services[i].isEmergency) {
        link.attr('href', `tel:${telHref}`);
      }
    }
  });
}

function populateBookingForm($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const heading = $('#booking-heading');
  if (heading.length) heading.text(copy.bookingHeadline);

  // Subtext
  const copySection = $('.booking-copy');
  if (copySection.length) {
    const subP = copySection.find('p').first();
    if (subP.length) subP.text(copy.bookingSubtext);
  }

  // Checklist
  if (copy.bookingBullets.length) {
    const checkList = $('.booking-checklist');
    if (checkList.length) {
      checkList.empty();
      copy.bookingBullets.forEach((bullet) => {
        checkList.append(`<li>\n                ${CHECK_SVG_SIMPLE}\n                ${escapeHtml(bullet)}\n              </li>`);
      });
    }
  }

  // Submit button
  const submitBtn = $('.booking-form .form-submit');
  if (submitBtn.length) {
    submitBtn.html(escapeHtml(copy.submitButtonText) + ' &rarr;');
  }

  // Select options
  updateServiceSelect($, '#service', data.services);
}

function populateGallery($: CheerioDoc, copy: RewrittenCopy): void {
  if (!copy.galleryCaptions?.length) return;
  const captions = $('.gallery-caption');
  captions.each((i, el) => {
    if (i < copy.galleryCaptions!.length) {
      $(el).text(copy.galleryCaptions![i]);
    }
  });
}

function populateServiceAreaSection($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const heading = $('#service-area-heading');
  if (heading.length) heading.text(copy.serviceAreaHeadline);
  rebuildCityList($, '.cities-list', data.serviceAreas, CITY_PIN_SIMPLE);
}

function populateFinalCta($: CheerioDoc, copy: RewrittenCopy): void {
  $('#final-cta-heading').text(copy.finalCtaHeadline);
  $('.final-cta-sub').text(copy.finalCtaSubheadline);
}

function populateFooterSection($: CheerioDoc, data: ExtractedBusinessData, copy: RewrittenCopy): void {
  const address = data.address;
  const addressStr = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
  const cityStateStr = [address.city, address.state].filter(Boolean).join(', ');

  const footerCompany = $('.footer-company');
  if (footerCompany.length) {
    const descP = footerCompany.find('p').first();
    if (descP.length) descP.text(copy.footerDescription);

    // Address
    const contactItems = footerCompany.find('.footer-contact-item');
    if (contactItems.length >= 1) {
      const locationSpan = contactItems.eq(0).find('span');
      if (locationSpan.length) locationSpan.text(address.street ? addressStr : cityStateStr);
    }

    // Email
    if (data.email && contactItems.length >= 3) {
      const emailLink = contactItems.eq(2).find('a[href^="mailto:"]');
      if (emailLink.length) {
        emailLink.attr('href', `mailto:${data.email}`);
        emailLink.text(data.email);
      }
    }

    // License
    if (data.licenseNumber) {
      const licenseEl = footerCompany.find('.text-small');
      if (licenseEl.length) licenseEl.text(`License #${data.licenseNumber}`);
    }
  }

  // Footer cities
  const footerCities = $('.footer-cities-list');
  if (footerCities.length && data.serviceAreas.length) {
    footerCities.empty();
    data.serviceAreas.forEach((city) => footerCities.append(`<li>${escapeHtml(city)}</li>`));
  }

  // Copyright
  updateCopyright($, '.footer-bottom p', data.companyName, data.licenseNumber, 'All Rights Reserved. Licensed &amp; Insured.');
}

function populateJsonLd($: CheerioDoc, data: ExtractedBusinessData): void {
  const jsonLdScript = $('script[type="application/ld+json"]');
  if (!jsonLdScript.length) return;

  try {
    const schema = JSON.parse(jsonLdScript.html() || '{}');
    schema.name = data.companyName;
    schema.telephone = toTelHref(data.phoneRaw || data.phone);

    if (schema.address) {
      schema.address.addressLocality = data.address.city;
      schema.address.addressRegion = data.address.state;
      if (data.address.street) schema.address.streetAddress = data.address.street;
      if (data.address.zip) schema.address.postalCode = data.address.zip;
    }

    if (data.serviceAreas.length) schema.areaServed = data.serviceAreas;

    if (data.googleRating !== null && schema.aggregateRating) {
      schema.aggregateRating.ratingValue = String(data.googleRating);
    }
    if (data.googleReviewCount !== null && schema.aggregateRating) {
      schema.aggregateRating.reviewCount = String(data.googleReviewCount);
    }

    if (data.services.length && schema.hasOfferCatalog) {
      schema.hasOfferCatalog.itemListElement = data.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name },
      }));
    }

    jsonLdScript.html(JSON.stringify(schema, null, 2));
  } catch {
    // Skip silently
  }
}
