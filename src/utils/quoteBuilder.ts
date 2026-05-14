/**
 * Quote Builder
 * Generates quoted HTML for reply and forward email composition
 */

import { format } from 'date-fns';
import DOMPurify from 'dompurify';

export interface EmailForQuote {
  from?: { name?: string | null; email: string }[] | null;
  to?: { name?: string | null; email: string }[] | null;
  cc?: { name?: string | null; email: string }[] | null;
  subject?: string;
  receivedAt?: string;
  htmlBody?: { partId?: string; type?: string }[] | null;
  textBody?: { partId?: string; type?: string }[] | null;
  bodyValues?: Record<string, { value: string }> | null;
}

function formatAddress(addr: { name?: string | null; email: string }): string {
  return addr.name ? `${addr.name} &lt;${addr.email}&gt;` : addr.email;
}

function formatAddressList(addrs?: { name?: string | null; email: string }[] | null): string {
  if (!addrs || addrs.length === 0) return '';
  return addrs.map(formatAddress).join(', ');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Extract body HTML from an email object.
 * Prefers HTML body, falls back to plain text wrapped in <pre>.
 */
export function getEmailBodyHtml(email: EmailForQuote): string {
  if (email.htmlBody && email.htmlBody.length > 0) {
    const partId = email.htmlBody[0].partId;
    const html = (partId && email.bodyValues?.[partId]?.value) || '';
    return DOMPurify.sanitize(html);
  }
  if (email.textBody && email.textBody.length > 0) {
    const partId = email.textBody[0].partId;
    const text = (partId && email.bodyValues?.[partId]?.value) || '';
    const escaped = escapeHtml(text);
    return `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${escaped}</pre>`;
  }
  return '';
}

/**
 * Build a quoted reply block (matches Apple Mail style).
 * Returns HTML with attribution line + blockquote.
 */
export function buildReplyQuote(email: EmailForQuote): string {
  const body = getEmailBodyHtml(email);
  if (!body) return '';

  const date = email.receivedAt ? new Date(email.receivedAt) : null;
  // Handle invalid dates gracefully
  const isValidDate = date && !isNaN(date.getTime());
  const dateStr = isValidDate ? format(date, 'MMM d, yyyy') : 'Unknown date';
  const timeStr = isValidDate ? format(date, 'h:mm a') : '';
  const sender = email.from?.[0];
  const senderStr = sender
    ? (sender.name ? `${sender.name} &lt;${sender.email}&gt;` : sender.email)
    : 'Unknown';

  return [
    '<div id="quoted-content" data-sagittarius-quote="1" style="margin-top: 16px;">',
    `  <div style="color: var(--icloud-text-secondary); font-size: 13px; margin-bottom: 8px;">`,
    `    On ${dateStr} at ${timeStr}, ${senderStr} wrote:`,
    `  </div>`,
    `  <blockquote style="margin: 0; padding: 0 0 0 12px; border-left: 2px solid var(--icloud-accent);">`,
    `    ${body}`,
    `  </blockquote>`,
    '</div>',
  ].join('\n');
}

/**
 * Build a forwarded message block (matches Apple Mail style).
 * Returns HTML with full header info + original body.
 */
export function buildForwardQuote(email: EmailForQuote): string {
  const body = getEmailBodyHtml(email);

  const date = email.receivedAt ? new Date(email.receivedAt) : null;
  // Handle invalid dates gracefully
  const isValidDate = date && !isNaN(date.getTime());
  const dateStr = isValidDate ? format(date, 'MMMM d, yyyy') : 'Unknown date';
  const timeStr = isValidDate ? format(date, 'h:mm a') : '';
  const dateTimeStr = isValidDate ? `${dateStr} at ${timeStr}` : dateStr;

  const headers: string[] = [
    `<b>From:</b> ${formatAddressList(email.from)}`,
    `<b>Date:</b> ${dateTimeStr}`,
    `<b>Subject:</b> ${escapeHtml(email.subject || '(No Subject)')}`,
    `<b>To:</b> ${formatAddressList(email.to)}`,
  ];

  if (email.cc && email.cc.length > 0) {
    headers.push(`<b>Cc:</b> ${formatAddressList(email.cc)}`);
  }

  return [
    '<div id="quoted-content" data-sagittarius-quote="1" style="margin-top: 16px;">',
    `  <div style="color: var(--icloud-text-secondary); font-size: 13px; border-top: 1px solid var(--icloud-border); padding-top: 12px; margin-bottom: 8px;">`,
    `    <b>Begin forwarded message:</b><br/>`,
    `    ${headers.join('<br/>')}`,
    `  </div>`,
    `  <div>${body}</div>`,
    '</div>',
  ].join('\n');
}
