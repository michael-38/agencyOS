export type BusinessType = 'roofing' | 'hvac' | 'plumbing';

export interface ClassificationResult {
  type: BusinessType;
  confidence: number;
  reasoning: string;
}

export interface ExtractedBusinessData {
  companyName: string;
  phone: string;
  phoneRaw: string;
  email: string | null;
  address: {
    street: string | null;
    city: string;
    state: string;
    zip: string | null;
  };
  websiteUrl: string;
  businessType: BusinessType;
  yearsInBusiness: number | null;
  licenseNumber: string | null;
  certifications: string[];
  hours: string;
  is24x7Emergency: boolean;
  services: Array<{
    name: string;
    description: string;
    isEmergency: boolean;
  }>;
  reviews: Array<{
    text: string;
    authorName: string;
    authorLocation: string | null;
    rating: number;
    source: string | null;
    techName: string | null;
  }>;
  googleRating: number | null;
  googleReviewCount: number | null;
  serviceAreas: string[];
  primaryCity: string;
  region: string | null;
  ownerName: string | null;
  teamSize: string | null;
  warrantyInfo: string | null;
  insuranceClaimHelp: boolean;
  brandsServiced: string[];
  maintenancePlan: {
    name: string;
    price: string;
    features: string[];
  } | null;
  financingAvailable: boolean;
  responseTime: string | null;
  pricingTable: Array<{ service: string; price: string }>;
  heroImageUrl: string | null;
  logoUrl: string | null;
  galleryImageUrls: string[];
}

export interface RewrittenCopy {
  titleTag: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  emergencyBannerText: string;
  services: Array<{
    title: string;
    description: string;
    ctaText: string;
    isEmergency: boolean;
  }>;
  whyChooseUsHeadline: string;
  differentiators: Array<{
    heading: string;
    oneLiner: string;
  }>;
  reviewsSectionHeadline: string;
  reviews: Array<{
    text: string;
    authorName: string;
    authorLocation: string;
    rating: number;
    techName: string | null;
    isEmergency: boolean;
  }>;
  bookingHeadline: string;
  bookingSubtext: string;
  bookingBullets: string[];
  submitButtonText: string;
  processSteps: Array<{
    title: string;
    description: string;
  }>;
  serviceAreaHeadline: string;
  finalCtaHeadline: string;
  finalCtaSubheadline: string;
  footerDescription: string;
  // HVAC-specific
  seasonalOfferHeadline: string | null;
  seasonalOfferDescription: string | null;
  seasonalOfferFinePrint: string | null;
  maintenancePlanName: string | null;
  maintenancePlanPrice: string | null;
  maintenancePlanFeatures: string[] | null;
  financingHeadline: string | null;
  financingBullets: string[] | null;
  // Roofing-specific
  galleryHeadline: string | null;
  galleryCaptions: string[] | null;
  // Plumbing-specific
  pricingHeadline: string | null;
  pricingDisclaimer: string | null;
  pricingWhyText: string | null;
  pricingTable: Array<{ service: string; price: string }> | null;
}

export interface ScrapedPage {
  url: string;
  markdown: string;
  html: string;
  title: string;
  description: string;
}

export interface ScrapeResult {
  url: string;
  pages: ScrapedPage[];
  combinedMarkdown: string;
  combinedHtml: string;
  extractedPhones: string[];
  extractedEmails: string[];
}

export interface PipelineInput {
  url: string;
  typeOverride?: BusinessType;
  phoneOverride?: string;
}

export interface PipelineResult {
  originalUrl: string;
  companyName: string;
  businessType: BusinessType | 'unknown';
  liveUrl: string | null;
  outputPath: string;
  status: 'success' | 'failed';
  error?: string;
  duration: number;
}

export interface BatchResult {
  results: PipelineResult[];
  totalTime: number;
  successCount: number;
  failCount: number;
  outputCsvPath: string;
}

export interface CLIOptions {
  type?: BusinessType;
  phone?: string;
  deploy: string;
  dryRun: boolean;
  output: string;
  verbose: boolean;
  batch?: string;
  concurrency: number;
}
