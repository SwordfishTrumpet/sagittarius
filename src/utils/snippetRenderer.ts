import DOMPurify from 'dompurify';

/**
 * Sanitizes an HTML snippet for safe inline display.
 * Only <mark> tags are allowed (used by JMAP servers to highlight search matches).
 * All attributes are stripped.
 */
export function sanitizeSnippet(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] });
}
