import * as cheerio from 'cheerio';
import { ExtractedBusinessData, RewrittenCopy } from '../types.js';
import {
  CheerioDoc,
  populateMeta,
  populateReviewCards,
  populateSteps,
  populateDifferentiators,
  rebuildCityList,
  updateCopyright,
  updateServiceSelect,
  applyGlobalReplacements,
  escapeHtml,
  CHECK_SVG_PHOSPHOR,
  CITY_PIN_PHOSPHOR,
} from './shared.js';

export function populateHvacTemplate(
  rawHtml: string,
  data: ExtractedBusinessData,
  copy: RewrittenCopy,
): string {
  const $ = cheerio.load(rawHtml);

  populateMeta($, copy);
  populateHero($, copy);
  populateEmergencyBanner($, copy);
  populateServices($, copy);
  populateSeasonalOffer($, copy);
  populateDifferentiators($, copy, '.why-item');
  populateReviewCards($, copy, 'phosphor', '.review-quote');
  populateBookingForm($, copy, data);
  populateMaintenancePlan($, copy, data);
  populateBrands($, data);
  populateSteps($, copy, '.step-item');
  populateFinancing($, copy, data);
  populateServiceAreaSection($, copy, data);
  populateFinalCta($, copy);
  populateFooterSection($, data, copy);

  return applyGlobalReplacements($, 'hvac', data);
}

// ---------------------------------------------------------------------------
// HVAC-specific section populators
// ---------------------------------------------------------------------------

function populateHero($: CheerioDoc, copy: RewrittenCopy): void {
  const hero = $('.hero');
  if (!hero.length) return;

  $('#hero-headline').text(copy.heroHeadline);
  hero.find('.hero-subheadline').text(copy.heroSubheadline);

  const ctaBtn = hero.find('.hero-ctas .btn-primary');
  if (ctaBtn.length) {
    const svg = ctaBtn.find('svg');
    const svgHtml = svg.length ? $.html(svg) : '';
    ctaBtn.html(escapeHtml(copy.heroPrimaryCta) + ' ' + svgHtml);
  }
}

function populateEmergencyBanner($: CheerioDoc, copy: RewrittenCopy): void {
  const banner = $('.emergency-banner');
  if (!banner.length) return;
  banner.find('p').text(copy.emergencyBannerText);
}

function populateServices($: CheerioDoc, copy: RewrittenCopy): void {
  const services = copy.services;
  if (!services.length) return;

  $('.service-card').each((i, el) => {
    if (i >= services.length) return;
    const $card = $(el);
    $card.find('h3').text(services[i].title);
    $card.find('p').text(services[i].description);

    const link = $card.find('.service-card-link');
    if (link.length) {
      const svg = link.find('svg');
      const svgHtml = svg.length ? $.html(svg) : '';
      link.html(escapeHtml(services[i].ctaText) + '\n              ' + svgHtml);
    }
  });
}

function populateSeasonalOffer($: CheerioDoc, copy: RewrittenCopy): void {
  if (!copy.seasonalOfferHeadline) return;

  const offerCard = $('.offer-card');
  if (!offerCard.length) return;

  $('#offer-headline').text(copy.seasonalOfferHeadline);

  if (copy.seasonalOfferDescription) {
    const offerDesc = offerCard.find('p').not('.offer-fine-print').first();
    if (offerDesc.length) offerDesc.text(copy.seasonalOfferDescription);
  }

  if (copy.seasonalOfferFinePrint) {
    const finePrint = offerCard.find('.offer-fine-print');
    if (finePrint.length) finePrint.text(copy.seasonalOfferFinePrint);
  }
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
    const checkList = $('.expect-list');
    if (checkList.length) {
      checkList.empty();
      copy.bookingBullets.forEach((bullet) => {
        checkList.append(`<li>\n                ${CHECK_SVG_PHOSPHOR}\n                ${escapeHtml(bullet)}\n              </li>`);
      });
    }
  }

  // Submit button
  const submitBtn = $('#service-form .form-submit, .form-container .form-submit');
  if (submitBtn.length) {
    const svg = submitBtn.find('svg');
    const svgHtml = svg.length ? $.html(svg) : '';
    submitBtn.html(escapeHtml(copy.submitButtonText) + ' ' + svgHtml);
  }

  // Select options
  updateServiceSelect($, '#service-type', data.services);
}

function populateMaintenancePlan($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const planCard = $('.plan-card');
  if (!planCard.length) return;

  // From copy
  if (copy.maintenancePlanName) {
    const planName = planCard.find('.plan-name');
    if (planName.length) planName.text(copy.maintenancePlanName);
  }

  if (copy.maintenancePlanPrice) {
    const priceAmount = planCard.find('.plan-price-amount');
    if (priceAmount.length) priceAmount.text(copy.maintenancePlanPrice);
  }

  if (copy.maintenancePlanFeatures?.length) {
    const featuresDiv = planCard.find('.plan-features');
    if (featuresDiv.length) {
      featuresDiv.empty();
      copy.maintenancePlanFeatures.forEach((feature) => {
        featuresDiv.append(`<div class="plan-feature">
                ${CHECK_SVG_PHOSPHOR}
                <span>${escapeHtml(feature)}</span>
              </div>`);
      });
    }
  }

  // Fallback from data if copy didn't provide
  if (data.maintenancePlan) {
    if (!copy.maintenancePlanName && data.maintenancePlan.name) {
      const planName = planCard.find('.plan-name');
      if (planName.length) planName.text(data.maintenancePlan.name);
    }
    if (!copy.maintenancePlanPrice && data.maintenancePlan.price) {
      const priceAmount = planCard.find('.plan-price-amount');
      if (priceAmount.length) priceAmount.text(data.maintenancePlan.price);
    }
  }
}

function populateBrands($: CheerioDoc, data: ExtractedBusinessData): void {
  if (!data.brandsServiced.length) return;

  const brandsGrid = $('.brands-grid');
  if (!brandsGrid.length) return;

  brandsGrid.empty();
  data.brandsServiced.forEach((brand, i) => {
    brandsGrid.append(`<div class="brand-box animate-on-scroll stagger-${i + 1}">${escapeHtml(brand)}</div>`);
  });
}

function populateFinancing($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  if (copy.financingHeadline) {
    $('#financing-headline').text(copy.financingHeadline);
  }

  if (copy.financingBullets?.length) {
    const pointsDiv = $('.financing-points');
    if (pointsDiv.length) {
      pointsDiv.empty();
      copy.financingBullets.forEach((bullet) => {
        pointsDiv.append(`<div class="financing-point">
              ${CHECK_SVG_PHOSPHOR}
              <span>${escapeHtml(bullet)}</span>
            </div>`);
      });
    }
  }

  // Hide if not available
  if (!data.financingAvailable) {
    const financingSection = $('.financing');
    if (financingSection.length) financingSection.attr('style', 'display:none');
  }
}

function populateServiceAreaSection($: CheerioDoc, copy: RewrittenCopy, data: ExtractedBusinessData): void {
  const heading = $('#area-headline');
  if (heading.length) heading.text(copy.serviceAreaHeadline);

  const citiesDiv = $('.cities');
  if (citiesDiv.length && data.serviceAreas.length) {
    citiesDiv.empty();
    data.serviceAreas.forEach((city) => {
      citiesDiv.append(`<div class="city-item">\n                ${CITY_PIN_PHOSPHOR}\n                ${escapeHtml(city)}\n              </div>`);
    });
  }
}

function populateFinalCta($: CheerioDoc, copy: RewrittenCopy): void {
  $('#final-headline').text(copy.finalCtaHeadline);
  const section = $('.final-cta');
  if (section.length) {
    const subP = section.find('p').first();
    if (subP.length) subP.text(copy.finalCtaSubheadline);
  }
}

function populateFooterSection($: CheerioDoc, data: ExtractedBusinessData, copy: RewrittenCopy): void {
  const address = data.address;
  const addressStr = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
  const cityStateStr = [address.city, address.state].filter(Boolean).join(', ');

  const footerBrand = $('.footer-brand');
  if (footerBrand.length) {
    footerBrand.find('h3').text(data.companyName);
    const descP = footerBrand.find('p').first();
    if (descP.length) descP.text(copy.footerDescription);

    const contactItems = footerBrand.find('.footer-contact-item');
    if (contactItems.length >= 1) {
      const locationSpan = contactItems.eq(0).find('span');
      if (locationSpan.length) locationSpan.text(address.street ? addressStr : cityStateStr);
    }

    if (data.email && contactItems.length >= 3) {
      const emailLink = contactItems.eq(2).find('a[href^="mailto:"]');
      if (emailLink.length) {
        emailLink.attr('href', `mailto:${data.email}`);
        emailLink.text(data.email);
      }
    }
  }

  updateCopyright($, '.footer-bottom p', data.companyName, data.licenseNumber, 'Licensed &amp; Insured. All Rights Reserved.');
}
