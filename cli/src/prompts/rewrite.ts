import { BusinessType, ExtractedBusinessData } from '../types.js';

const toneGuides: Record<BusinessType, string> = {
  roofing: `TONE: Strong, protective, dependable, straightforward.
HERO FORMULA: "[City]'s [Superlative] Roofing [Company Type]" — emphasize protection, trust, track record.
SERVICES: Frame as service categories (Roof Replacement, Storm Damage Repair, Inspection, Repair).
DIFFERENTIATORS: Focus on licensed/insured, fast response, free estimates, insurance claim help, warranty, reviews.
CTA LANGUAGE: "Get My Free Inspection", "Schedule Inspection", "Protect Your Home".
UNIQUE SECTIONS: Before/after gallery captions (describe the neighborhood + work done). Storm damage messaging.
EMERGENCY: Conditional storm banner. Reference hail, wind, storm damage.`,

  hvac: `TONE: Comfortable, reliable, technically competent, family-safe.
HERO FORMULA: "[City]'s [Superlative] Heating & Air Conditioning [Company Type]" — emphasize comfort, reliability.
SERVICES: AC Repair & Installation, Heating Repair & Installation, Maintenance Plans, Indoor Air Quality.
DIFFERENTIATORS: Same-day service, upfront pricing, all brands serviced, maintenance plans, financing.
CTA LANGUAGE: "Schedule Service Now", "Fix My AC", "Fix My Heating", "Join the Comfort Club".
UNIQUE SECTIONS: Seasonal offer (AC tune-up or furnace check), maintenance plan spotlight, brand logos, financing.
EMERGENCY: Year-round dispatch messaging. Reference no-heat and no-AC emergencies.`,

  plumbing: `TONE: Fast, honest, clean, no-nonsense. Urgency-first.
HERO FORMULA: "[City]'s [Superlative] Plumber" — emphasize speed, trust, fair prices.
SERVICES: Use PROBLEM language, not service categories. "Leaking or Burst Pipes" not "Pipe Repair Services". "Clogged Drains & Sewer Backup" not "Drain Cleaning".
DIFFERENTIATORS: Fast guaranteed response, upfront flat-rate pricing, licensed/bonded/insured, clean work, satisfaction guarantee, camera inspections.
CTA LANGUAGE: "Call Now", "Get Help Now", "Fix My [Problem]". Phone number IS the primary CTA.
UNIQUE SECTIONS: Pricing transparency table with "Starting at" prices. Emergency problem cards.
EMERGENCY: Permanent emergency messaging. Reference burst pipes, sewer backup, overflowing toilets, gas leaks.
Mark services as isEmergency=true: burst pipes, sewer backup, gas leaks, flooding.`,
};

export function buildRewritePrompt(data: ExtractedBusinessData): string {
  const guide = toneGuides[data.businessType];
  const servicesJson = JSON.stringify(data.services, null, 2);
  const reviewsJson = JSON.stringify(data.reviews, null, 2);

  return `You are an expert conversion copywriter for home service businesses. Rewrite and improve the copy for a ${data.businessType} contractor's landing page.

BUSINESS DATA:
- Company: ${data.companyName}
- Phone: ${data.phone}
- City: ${data.primaryCity}, ${data.address?.state || ''}
- Region: ${data.region || data.primaryCity + ' area'}
- Years in business: ${data.yearsInBusiness || 'not specified'}
- License: ${data.licenseNumber || 'not specified'}
- Certifications: ${data.certifications.join(', ') || 'none specified'}
- Hours: ${data.hours}
- 24/7 Emergency: ${data.is24x7Emergency}
- Google Rating: ${data.googleRating || 'not specified'} (${data.googleReviewCount || '?'} reviews)
- Service Areas: ${data.serviceAreas.join(', ')}
- Warranty: ${data.warrantyInfo || 'not specified'}
- Financing: ${data.financingAvailable}
- Response Time: ${data.responseTime || 'not specified'}

EXISTING SERVICES:
${servicesJson}

EXISTING REVIEWS:
${reviewsJson}

${guide}

RULES:
1. Use the ACTUAL business name, city, and phone number throughout — never use placeholders.
2. Follow the tone guide above precisely for this industry.
3. Keep all copy concise — these are landing pages, not blog posts.
4. Headlines should be specific to THIS business, not generic.
5. Every CTA must work for the actual conversion actions (call, form, book).
6. Do NOT invent facts that aren't in the business data.
7. If reviews exist, improve their presentation but keep the substance and author names intact. If no reviews exist, create 3 realistic-sounding reviews that mention the company name and city — mark these clearly.
8. For services: produce exactly the right count for the template (4 for roofing/HVAC, 8 for plumbing).
9. Include the phone number ${data.phone} in hero CTA text.
10. For plumbing: frame services as problems the customer has, not services the company offers.
11. For HVAC: include seasonal offer copy and maintenance plan copy.
12. For roofing: include before/after gallery captions.

Generate all copy fields for the landing page.`;
}

export const rewriteToolSchema = {
  name: 'generate_landing_page_copy',
  description: 'Generate conversion-optimized copy for a contractor landing page',
  input_schema: {
    type: 'object' as const,
    properties: {
      titleTag: { type: 'string' as const },
      metaDescription: { type: 'string' as const },
      heroHeadline: { type: 'string' as const },
      heroSubheadline: { type: 'string' as const },
      heroPrimaryCta: { type: 'string' as const },
      emergencyBannerText: { type: 'string' as const },
      services: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            description: { type: 'string' as const },
            ctaText: { type: 'string' as const },
            isEmergency: { type: 'boolean' as const },
          },
          required: ['title', 'description', 'ctaText', 'isEmergency'],
        },
      },
      whyChooseUsHeadline: { type: 'string' as const },
      differentiators: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            heading: { type: 'string' as const },
            oneLiner: { type: 'string' as const },
          },
          required: ['heading', 'oneLiner'],
        },
      },
      reviewsSectionHeadline: { type: 'string' as const },
      reviews: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            text: { type: 'string' as const },
            authorName: { type: 'string' as const },
            authorLocation: { type: 'string' as const },
            rating: { type: 'number' as const },
            techName: { type: ['string', 'null'] as const },
            isEmergency: { type: 'boolean' as const },
          },
          required: ['text', 'authorName', 'authorLocation', 'rating', 'isEmergency'],
        },
      },
      bookingHeadline: { type: 'string' as const },
      bookingSubtext: { type: 'string' as const },
      bookingBullets: { type: 'array' as const, items: { type: 'string' as const } },
      submitButtonText: { type: 'string' as const },
      processSteps: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            description: { type: 'string' as const },
          },
          required: ['title', 'description'],
        },
      },
      serviceAreaHeadline: { type: 'string' as const },
      finalCtaHeadline: { type: 'string' as const },
      finalCtaSubheadline: { type: 'string' as const },
      footerDescription: { type: 'string' as const },
      seasonalOfferHeadline: { type: ['string', 'null'] as const },
      seasonalOfferDescription: { type: ['string', 'null'] as const },
      seasonalOfferFinePrint: { type: ['string', 'null'] as const },
      maintenancePlanName: { type: ['string', 'null'] as const },
      maintenancePlanPrice: { type: ['string', 'null'] as const },
      maintenancePlanFeatures: {
        type: ['array', 'null'] as const,
        items: { type: 'string' as const },
      },
      financingHeadline: { type: ['string', 'null'] as const },
      financingBullets: {
        type: ['array', 'null'] as const,
        items: { type: 'string' as const },
      },
      galleryHeadline: { type: ['string', 'null'] as const },
      galleryCaptions: {
        type: ['array', 'null'] as const,
        items: { type: 'string' as const },
      },
      pricingHeadline: { type: ['string', 'null'] as const },
      pricingDisclaimer: { type: ['string', 'null'] as const },
      pricingWhyText: { type: ['string', 'null'] as const },
      pricingTable: {
        type: ['array', 'null'] as const,
        items: {
          type: 'object' as const,
          properties: {
            service: { type: 'string' as const },
            price: { type: 'string' as const },
          },
          required: ['service', 'price'],
        },
      },
    },
    required: [
      'titleTag', 'metaDescription', 'heroHeadline', 'heroSubheadline',
      'heroPrimaryCta', 'emergencyBannerText', 'services',
      'whyChooseUsHeadline', 'differentiators', 'reviewsSectionHeadline',
      'reviews', 'bookingHeadline', 'bookingSubtext', 'bookingBullets',
      'submitButtonText', 'processSteps', 'serviceAreaHeadline',
      'finalCtaHeadline', 'finalCtaSubheadline', 'footerDescription',
    ],
  },
};
