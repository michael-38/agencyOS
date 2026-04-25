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
  CHECK_SVG_FEATHER,
  CITY_PIN_SMALL,
} from './shared.js';

export function populatePlumbingTemplate(
  rawHtml: string,
  data: ExtractedBusinessData,
  copy: RewrittenCopy,
): string {
  const $ = cheerio.load(rawHtml);

  populateMeta($, copy);
  populateHero($, copy);
  // Plumbing emergency banner is structural — no dedicated text to replace
  populateProblemCards($, copy, data);
  populateDifferentiators($, copy, '.why-card');
  populateReviewCards($, copy, 'phosphor', '.review-quote');
  populateBookingForm($, copy, data);
  populatePricingTable($, copy, data);
  populateSteps($, copy, '.step-card');
  populateServiceAreaSection($, copy, data);
  populateFinalCta($, copy);
  populateFooterSection($, data, copy);

  return applyGlobalReplacements($, 'plumbing', data);
}

// ---------------------------------------------------------------------------
// Plumbing-specific section populators
// ---------------------------------------------------------------------------

function populateHero($: CheerioDoc, copy: RewrittenCopy): void {
  const hero = $('.hero');
  if (!hero.length) return;

  $('#hero-heading').text(copy.heroHeadline);
  hero.find('.hero-sub').text(copy.heroSubheadline);
}

function populateProblemCards($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const services = copy.services;
  if (!services.length) return;

  const telHref = toTelHref(data.phoneRaw || data.phone);

  $('.problem-card').each((i, el) => {
    if (i >= services.length) return;
    const $card = $(el);
    $card.find('h3').text(services[i].title);
    $card.find('p').text(services[i].description);

    // Set/remove emergency class
    if (services[i].isEmergency) {
      $card.addClass('is-emergency');
    } else {
      $card.removeClass('is-emergency');
    }

    const link = $card.find('.problem-card-link');
    if (link.length) {
      const svg = link.find('svg');
      const svgHtml = svg.length ? $.html(svg) : '';
      link.html(escapeHtml(services[i].ctaText) + ' ' + svgHtml);

      if (services[i].isEmergency) {
        link.attr('href', `tel:${telHref}`);
      } else {
        link.attr('href', '#booking');
      }
    }
  });
}

function populateBookingForm($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const heading = $('#booking-heading');
  if (heading.length) heading.text(copy.bookingHeadline);

  // Subtext
  const subP = $('.booking-sub');
  if (subP.length) subP.text(copy.bookingSubtext);

  // Checklist
  if (copy.bookingBullets.length) {
    const checkList = $('.booking-expect');
    if (checkList.length) {
      checkList.empty();
      copy.bookingBullets.forEach((bullet) => {
        checkList.append(`<li>\n                ${CHECK_SVG_FEATHER}\n                ${escapeHtml(bullet)}\n              </li>`);
      });
    }
  }

  // Submit button
  const submitBtn = $('.booking-form-container .form-submit');
  if (submitBtn.length) {
    submitBtn.html(escapeHtml(copy.submitButtonText) + ' &rarr;');
  }

  // Select options
  updateServiceSelect($, '#form-problem', data.services);
}

function populatePricingTable($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  // Use copy pricing table if available, otherwise fall back to data
  const pricingRows = copy.pricingTable?.length ? copy.pricingTable : data.pricingTable;

  if (pricingRows.length) {
    if (copy.pricingHeadline) {
      $('#pricing-heading').text(copy.pricingHeadline);
    }

    const tbody = $('.pricing-table tbody');
    if (tbody.length) {
      tbody.empty();
      pricingRows.forEach((row) => {
        tbody.append(`<tr>
                <td>${escapeHtml(row.service)}</td>
                <td>${escapeHtml(row.price)}</td>
              </tr>`);
      });
    }
  }

  if (copy.pricingDisclaimer) {
    const disclaimer = $('.pricing-disclaimer');
    if (disclaimer.length) disclaimer.text(copy.pricingDisclaimer);
  }

  if (copy.pricingWhyText) {
    const whyText = $('.pricing-why');
    if (whyText.length) whyText.text(copy.pricingWhyText);
  }
}

function populateServiceAreaSection($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const heading = $('#area-heading');
  if (heading.length) heading.text(copy.serviceAreaHeadline);
  rebuildCityList($, '.area-section .cities-list', data.serviceAreas, CITY_PIN_SMALL);
}

function populateFinalCta($: CheerioDoc, copy: RewrittenCopy): void {
  $('#final-cta-heading').text(copy.finalCtaHeadline);
  $('.final-cta-sub').text(copy.finalCtaSubheadline);
}

function populateFooterSection($: CheerioDoc, data: ExtractedBusinessData, copy: RewrittenCopy): void {
  const address = data.address;
  const addressStr = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
  const cityStateStr = [address.city, address.state].filter(Boolean).join(', ');

  const footerBrand = $('.footer-brand');
  if (footerBrand.length) {
    const descP = footerBrand.find('p').first();
    if (descP.length) descP.text(copy.footerDescription);

    // License
    if (data.licenseNumber) {
      const licenseEl = footerBrand.find('.footer-license');
      if (licenseEl.length) {
        const svg = licenseEl.find('svg');
        const svgHtml = svg.length ? $.html(svg) : '';
        licenseEl.html(svgHtml + '\n            License #' + escapeHtml(data.licenseNumber));
      }
    }
  }

  // Email
  if (data.email) {
    const emailItem = $('.footer-column .footer-contact-item').filter(function () {
      return $(this).text().includes('@');
    });
    if (emailItem.length) emailItem.text(data.email);
  }

  // Address
  const addressItem = $('.footer-column .footer-contact-item').filter(function () {
    return $(this).find('svg').length > 0 && !$(this).text().includes('@');
  });
  if (addressItem.length) {
    const svg = addressItem.find('svg');
    const svgHtml = svg.length ? $.html(svg) : '';
    addressItem.html(svgHtml + '\n            ' + escapeHtml(address.street ? addressStr : cityStateStr));
  }

  // Copyright
  updateCopyright($, '.footer-bottom p', data.companyName, data.licenseNumber, 'Licensed, Bonded &amp; Insured.');
}
