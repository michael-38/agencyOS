/**
 * Extract phone numbers from text/HTML content.
 */
export function extractPhones(text: string): string[] {
  const regex = /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  const phones = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const cleaned = `${match[1]}${match[2]}${match[3]}`;
    phones.add(cleaned);
  }

  return Array.from(phones);
}

/**
 * Extract email addresses from text.
 */
export function extractEmails(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    emails.add(match[0].toLowerCase());
  }

  return Array.from(emails);
}

/**
 * Format a 10-digit phone string as (555) 123-4567.
 */
export function formatPhone(digits: string): string {
  const cleaned = digits.replace(/\D/g, '').slice(-10);
  if (cleaned.length !== 10) return digits;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/**
 * Format a 10-digit phone string as +15551234567 for tel: links.
 */
export function formatPhoneRaw(digits: string): string {
  const cleaned = digits.replace(/\D/g, '').slice(-10);
  return `+1${cleaned}`;
}

/**
 * Create a URL-safe slug from a company name.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');
}
