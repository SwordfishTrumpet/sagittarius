/**
 * Quote Builder
 * Generates quoted HTML for reply and forward email composition
 */

import { format } from 'date-fns';
import DOMPurify from 'dompurify';

interface EmailForQuote {
  from?: { name?: string; email: string }[];
  to?: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  subject?: string;
  receivedAt: string;
  htmlBody?: { partId: string }[];
  textBody?: { partId: string }[];
  bodyValues?: Record<string, { value: string }>;
}

function formatAddress(addr: { name?: string; email: string }): string {
  return addr.name ? `${addr.name} &lt;${addr.email}&gt;` : addr.email;
}

function formatAddressList(addrs?: { name?: string; email: string }[]): string {
  if (!addrs || addrs.length === 0) return '';
  return addrs.map(formatAddress).join(', ');
}

/**
 * Extract body HTML from an email object.
 * Prefers HTML body, falls back to plain text wrapped in <pre>.
 */
function getEmailBodyHtml(email: EmailForQuote): string {
  if (email.htmlBody && email.htmlBody.length > 0) {
    const partId = email.htmlBody[0].partId;
    const html = email.bodyValues?.[partId]?.value || '';
    return DOMPurify.sanitize(html);
  }
  if (email.textBody && email.textBody.length > 0) {
    const partId = email.textBody[0].partId;
    const text = email.bodyValues?.[partId]?.value || '';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre style="font-family: inherit; white-space: pre-wrap;">${escaped}</pre>`;
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

  const date = new Date(email.receivedAt);
  const dateStr = format(date, 'MMM d, yyyy');
  const timeStr = format(date, 'h:mm a');
  const sender = email.from?.[0];
  const senderStr = sender
    ? (sender.name ? `${sender.name} &lt;${sender.email}&gt;` : sender.email)
    : 'Unknown';

  return [
    '<br/><br/>',
    '<div id="quoted-content">',
    `  <div style="color: #8E8E93; font-size: 13px; margin-bottom: 8px;">`,
    `    On ${dateStr} at ${timeStr}, ${senderStr} wrote:`,
    `  </div>`,
    `  <blockquote style="margin: 0; padding: 0 0 0 12px; border-left: 2px solid #007AFF;">`,
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

  const date = new Date(email.receivedAt);
  const dateStr = format(date, 'MMMM d, yyyy');
  const timeStr = format(date, 'h:mm a');

  const headers: string[] = [
    `<b>From:</b> ${formatAddressList(email.from)}`,
    `<b>Date:</b> ${dateStr} at ${timeStr}`,
    `<b>Subject:</b> ${email.subject || '(No Subject)'}`,
    `<b>To:</b> ${formatAddressList(email.to)}`,
  ];

  if (email.cc && email.cc.length > 0) {
    headers.push(`<b>Cc:</b> ${formatAddressList(email.cc)}`);
  }

  return [
    '<br/><br/>',
    '<div id="quoted-content">',
    `  <div style="color: #8E8E93; font-size: 13px; border-top: 1px solid #E5E5E5; padding-top: 12px; margin-bottom: 8px;">`,
    `    <b>Begin forwarded message:</b><br/><br/>`,
    `    ${headers.join('<br/>')}`,
    `  </div>`,
    `  <div>${body}</div>`,
    '</div>',
  ].join('\n');
}
