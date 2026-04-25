import { BusinessType } from '../types.js';

export function buildExtractPrompt(
  markdown: string,
  businessType: BusinessType,
  extractedPhones: string[],
  extractedEmails: string[],
  sourceUrl: string
): string {
  // Truncate to ~20K chars
  const content = markdown.slice(0, 20000);

  return `You are a data extraction expert. Extract all structured business data from this ${businessType} contractor's website content.

IMPORTANT RULES:
- Only extract information that is explicitly stated or clearly implied on the website.
- Do NOT invent or fabricate reviews, phone numbers, license numbers, pricing, or any other data.
- If a field cannot be determined from the content, set it to null.
- For phone numbers, we detected these from the HTML: ${extractedPhones.join(', ') || 'none found'}
- For emails, we detected these from the HTML: ${extractedEmails.join(', ') || 'none found'}
- The source URL is: ${sourceUrl}

<website_content>
${content}
</website_content>

Extract all available data into the structured format. For services, extract all distinct services offered. For reviews, extract actual customer reviews found on the site (do NOT make up reviews). For service areas, list all cities/areas mentioned.

${businessType === 'plumbing' ? 'For plumbing businesses: also extract any pricing information shown on the site, and mark emergency services (burst pipes, sewer backup, gas leaks) with isEmergency: true.' : ''}
${businessType === 'hvac' ? 'For HVAC businesses: also extract maintenance plan details, brands serviced, and financing information if available.' : ''}
${businessType === 'roofing' ? 'For roofing businesses: also extract warranty information, insurance claim assistance details, and manufacturer certifications.' : ''}`;
}

export const extractToolSchema = {
  name: 'extract_business_data',
  description: 'Extract structured business data from website content',
  input_schema: {
    type: 'object' as const,
    properties: {
      companyName: { type: 'string' as const, description: 'Business name' },
      phone: { type: 'string' as const, description: 'Phone formatted as (555) 123-4567' },
      phoneRaw: { type: 'string' as const, description: 'Phone as +15551234567' },
      email: { type: ['string', 'null'] as const, description: 'Email address' },
      address: {
        type: 'object' as const,
        properties: {
          street: { type: ['string', 'null'] as const },
          city: { type: 'string' as const },
          state: { type: 'string' as const },
          zip: { type: ['string', 'null'] as const },
        },
        required: ['city', 'state'],
      },
      websiteUrl: { type: 'string' as const },
      businessType: { type: 'string' as const, enum: ['roofing', 'hvac', 'plumbing'] },
      yearsInBusiness: { type: ['number', 'null'] as const },
      licenseNumber: { type: ['string', 'null'] as const },
      certifications: { type: 'array' as const, items: { type: 'string' as const } },
      hours: { type: 'string' as const, description: 'Business hours, e.g. Mon-Sat 7am-7pm' },
      is24x7Emergency: { type: 'boolean' as const },
      services: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            description: { type: 'string' as const },
            isEmergency: { type: 'boolean' as const },
          },
          required: ['name', 'description', 'isEmergency'],
        },
      },
      reviews: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            text: { type: 'string' as const },
            authorName: { type: 'string' as const },
            authorLocation: { type: ['string', 'null'] as const },
            rating: { type: 'number' as const },
            source: { type: ['string', 'null'] as const },
            techName: { type: ['string', 'null'] as const },
          },
          required: ['text', 'authorName', 'rating'],
        },
      },
      googleRating: { type: ['number', 'null'] as const },
      googleReviewCount: { type: ['number', 'null'] as const },
      serviceAreas: { type: 'array' as const, items: { type: 'string' as const } },
      primaryCity: { type: 'string' as const },
      region: { type: ['string', 'null'] as const },
      ownerName: { type: ['string', 'null'] as const },
      teamSize: { type: ['string', 'null'] as const },
      warrantyInfo: { type: ['string', 'null'] as const },
      insuranceClaimHelp: { type: 'boolean' as const },
      brandsServiced: { type: 'array' as const, items: { type: 'string' as const } },
      maintenancePlan: {
        type: ['object', 'null'] as const,
        properties: {
          name: { type: 'string' as const },
          price: { type: 'string' as const },
          features: { type: 'array' as const, items: { type: 'string' as const } },
        },
      },
      financingAvailable: { type: 'boolean' as const },
      responseTime: { type: ['string', 'null'] as const },
      pricingTable: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            service: { type: 'string' as const },
            price: { type: 'string' as const },
          },
          required: ['service', 'price'],
        },
      },
      heroImageUrl: { type: ['string', 'null'] as const },
      logoUrl: { type: ['string', 'null'] as const },
      galleryImageUrls: { type: 'array' as const, items: { type: 'string' as const } },
    },
    required: [
      'companyName', 'phone', 'phoneRaw', 'websiteUrl', 'businessType',
      'certifications', 'hours', 'is24x7Emergency', 'services', 'reviews',
      'serviceAreas', 'primaryCity', 'insuranceClaimHelp', 'brandsServiced',
      'financingAvailable', 'pricingTable', 'galleryImageUrls',
    ],
  },
};
