/**
 * Search Query Parser
 * Parses special search syntax like "from:alice@example.com has:attachment after:2024-01-01"
 */

import { SearchFilter, ParsedQuery } from '../types/search';

const PATTERNS = {
  from: /from:(\S+)/g,
  to: /to:(\S+)/g,
  cc: /cc:(\S+)/g,
  subject: /subject:("([^"]+)"|([^\s]+))/g,
  has_attachment: /has:attachment/g,
  is_unread: /is:unread/g,
  is_flagged: /is:flagged/g,
  is_draft: /is:draft/g,
  is_answered: /is:answered/g,
  before: /before:(\d{4}-\d{2}-\d{2})/g,
  after: /after:(\d{4}-\d{2}-\d{2})/g,
};

/**
 * Parse a search query string with special syntax
 * Examples:
 *  - "from:alice@example.com"
 *  - "to:bob@example.com has:attachment"
 *  - "subject:meeting before:2024-01-01"
 *  - "from:me is:unread"
 *  - "hello world after:2023-01-01" (free text + filter)
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const filters: SearchFilter = {};
  let remaining = query;

  // Extract from: (email or "me")
  const fromMatch = remaining.match(/from:(\S+)/);
  if (fromMatch) {
    filters.from = fromMatch[1];
    remaining = remaining.replace(fromMatch[0], '').trim();
  }

  // Extract to:
  const toMatch = remaining.match(/to:(\S+)/);
  if (toMatch) {
    filters.to = toMatch[1];
    remaining = remaining.replace(toMatch[0], '').trim();
  }

  // Extract cc:
  const ccMatch = remaining.match(/cc:(\S+)/);
  if (ccMatch) {
    filters.cc = ccMatch[1];
    remaining = remaining.replace(ccMatch[0], '').trim();
  }

  // Extract subject: (supports quoted phrases)
  const subjectMatch = remaining.match(/subject:(?:"([^"]+)"|(\S+))/);
  if (subjectMatch) {
    filters.subject = subjectMatch[1] || subjectMatch[2];
    remaining = remaining.replace(subjectMatch[0], '').trim();
  }

  // Extract has:attachment
  if (/has:attachment/i.test(remaining)) {
    filters.hasAttachment = true;
    remaining = remaining.replace(/has:attachment/i, '').trim();
  }

  // Extract is:unread
  if (/is:unread/i.test(remaining)) {
    filters.isUnread = true;
    remaining = remaining.replace(/is:unread/i, '').trim();
  }

  // Extract is:flagged
  if (/is:flagged/i.test(remaining)) {
    filters.isFlagged = true;
    remaining = remaining.replace(/is:flagged/i, '').trim();
  }

  // Extract is:draft
  if (/is:draft/i.test(remaining)) {
    filters.isDraft = true;
    remaining = remaining.replace(/is:draft/i, '').trim();
  }

  // Extract is:answered
  if (/is:answered/i.test(remaining)) {
    filters.isAnswered = true;
    remaining = remaining.replace(/is:answered/i, '').trim();
  }

  // Extract before: (YYYY-MM-DD format)
  const beforeMatch = remaining.match(/before:(\d{4}-\d{2}-\d{2})/);
  if (beforeMatch) {
    filters.before = new Date(beforeMatch[1]);
    remaining = remaining.replace(beforeMatch[0], '').trim();
  }

  // Extract after: (YYYY-MM-DD format)
  const afterMatch = remaining.match(/after:(\d{4}-\d{2}-\d{2})/);
  if (afterMatch) {
    filters.after = new Date(afterMatch[1]);
    remaining = remaining.replace(afterMatch[0], '').trim();
  }

  return {
    text: remaining,
    filters,
  };
}

/**
 * Convert SearchFilter to array of SearchPill for UI display
 */
export function filterToPills(filters: SearchFilter): any[] {
  const pills: any[] = [];

  if (filters.from) {
    pills.push({
      id: `from-${filters.from}`,
      type: 'from',
      label: `From: ${filters.from}`,
      value: filters.from,
    });
  }

  if (filters.to) {
    pills.push({
      id: `to-${filters.to}`,
      type: 'to',
      label: `To: ${filters.to}`,
      value: filters.to,
    });
  }

  if (filters.cc) {
    pills.push({
      id: `cc-${filters.cc}`,
      type: 'cc',
      label: `CC: ${filters.cc}`,
      value: filters.cc,
    });
  }

  if (filters.subject) {
    pills.push({
      id: `subject-${filters.subject}`,
      type: 'subject',
      label: `Subject: ${filters.subject}`,
      value: filters.subject,
    });
  }

  if (filters.hasAttachment) {
    pills.push({
      id: 'has-attachment',
      type: 'attachment',
      label: 'Has Attachments',
      value: 'true',
    });
  }

  if (filters.isUnread) {
    pills.push({
      id: 'is-unread',
      type: 'unread',
      label: 'Unread',
      value: 'true',
    });
  }

  if (filters.isFlagged) {
    pills.push({
      id: 'is-flagged',
      type: 'flagged',
      label: 'Flagged',
      value: 'true',
    });
  }

  if (filters.isDraft) {
    pills.push({
      id: 'is-draft',
      type: 'draft',
      label: 'Draft',
      value: 'true',
    });
  }

  if (filters.before || filters.after) {
    const dateLabel = [
      filters.after ? filters.after.toLocaleDateString() : 'Any',
      filters.before ? filters.before.toLocaleDateString() : 'Today',
    ].join(' - ');

    pills.push({
      id: 'date-range',
      type: 'date',
      label: `Date: ${dateLabel}`,
      value: `${filters.after?.toISOString() || ''}-${filters.before?.toISOString() || ''}`,
    });
  }

  return pills;
}

/**
 * Remove a specific filter from SearchFilter object
 */
export function removeFilter(filters: SearchFilter, filterType: string): SearchFilter {
  const updated = { ...filters };

  switch (filterType) {
    case 'from':
      delete updated.from;
      break;
    case 'to':
      delete updated.to;
      break;
    case 'cc':
      delete updated.cc;
      break;
    case 'subject':
      delete updated.subject;
      break;
    case 'attachment':
      updated.hasAttachment = false;
      break;
    case 'unread':
      updated.isUnread = false;
      break;
    case 'flagged':
      updated.isFlagged = false;
      break;
    case 'draft':
      updated.isDraft = false;
      break;
    case 'date':
      delete updated.before;
      delete updated.after;
      break;
  }

  return updated;
}
