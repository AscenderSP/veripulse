// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — content sanitizer for user-submitted text
//  Dependency-free (no DOMPurify). We render user text as plain text in
//  the UI, so the primary job is to strip HTML tags and escape the result,
//  and to block risky URL schemes in explicit link fields.
// ════════════════════════════════════════════════════════════════════════

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

/** Escape all characters that could change the HTML meaning. */
export function escapeHtml(input: string): string {
  return String(input).replace(/[&<>"'/]/g, (c) => HTML_ENTITIES[c]);
}

/**
 * Strip HTML tags and comments, collapse whitespace, and clip to `maxLen`.
 * Use for story bodies, review text, bounty descriptions, suspension
 * reasons, admin takedown reasons.
 */
export function sanitizeUserText(input: unknown, maxLen = 10_000): string {
  if (typeof input !== 'string') return '';
  const noComments = input.replace(/<!--[\s\S]*?-->/g, '');
  const noTags = noComments.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  const noControls = noTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return noControls.trim().slice(0, maxLen);
}

/** `sanitizeUserText` then `escapeHtml`, for the rare case we interpolate as HTML. */
export function sanitizeAndEscape(input: unknown, maxLen = 10_000): string {
  return escapeHtml(sanitizeUserText(input, maxLen));
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Validate a URL submitted by a user. Returns the normalized URL string
 * when safe, or null when the scheme is blocked (`javascript:`, `data:`,
 * `file:`, …) or parsing fails.
 */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!SAFE_SCHEMES.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Clamp a username to the characters we expect anywhere it is rendered. */
export function sanitizeUsername(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32);
}
