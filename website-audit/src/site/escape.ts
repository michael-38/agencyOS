// Shared escaping helpers for generated markup and XML.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function escapeXml(s: string): string {
  return escapeHtml(s);
}

/** Collapse whitespace and trim — for attribute values and meta content. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
