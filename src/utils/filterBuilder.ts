/**
 * Filter Builder
 * Converts SearchFilter objects to JMAP RFC 8621 Email/query filters
 */

import { SearchFilter } from '../types/search';

/**
 * Build a JMAP-compliant Email/query filter from SearchFilter
 * Handles special cases like "from:me", date ranges, and keywords
 */
export function buildJMAPFilter(
  filter: SearchFilter,
  userEmail?: string
): Record<string, any> {
  const jmapFilter: Record<string, any> = {};

  // Free-text search
  if (filter.text) {
    jmapFilter.text = filter.text;
  }

  // From field — RFC 8621 §4.4.1: FilterCondition "from" is String
  if (filter.from) {
    jmapFilter.from = filter.from === 'me' ? (userEmail ?? filter.from) : filter.from;
  }

  // To field — RFC 8621 §4.4.1: FilterCondition "to" is String
  if (filter.to) {
    jmapFilter.to = filter.to;
  }

  // CC field — RFC 8621 §4.4.1: FilterCondition "cc" is String
  if (filter.cc) {
    jmapFilter.cc = filter.cc;
  }

  // Subject field — RFC 8621 §4.4.1: FilterCondition "subject" is String
  if (filter.subject) {
    jmapFilter.subject = filter.subject;
  }

  // Date range: after (greater than or equal to) — RFC 8621 §4.4.1: UTCDate format
  if (filter.after) {
    jmapFilter.after = filter.after.toISOString();
  }

  // Date range: before (less than or equal to) — RFC 8621 §4.4.1: UTCDate format
  if (filter.before) {
    jmapFilter.before = filter.before.toISOString();
  }

  // Has attachments
  if (filter.hasAttachment === true) {
    jmapFilter.hasAttachment = true;
  }

  // Unread emails: notHasKeyword $seen
  if (filter.isUnread === true) {
    jmapFilter.notHasKeyword = '$seen';
  }

  // Flagged emails: hasKeyword $flagged
  if (filter.isFlagged === true) {
    jmapFilter.hasKeyword = '$flagged';
  }

  // Draft emails: hasKeyword $draft
  if (filter.isDraft === true) {
    jmapFilter.hasKeyword = '$draft';
  }

  // Answered emails: hasKeyword $answered
  if (filter.isAnswered === true) {
    jmapFilter.hasKeyword = '$answered';
  }

  return jmapFilter;
}

/**
 * Merge multiple filters with AND logic (all conditions must match)
 * This is useful for combining mailbox filters with advanced search filters
 */
export function mergeFiltersAND(
  ...filters: Record<string, any>[]
): Record<string, any> {
  // Filter out empty filters
  const validFilters = filters.filter((f) => Object.keys(f).length > 0);

  if (validFilters.length === 0) return {};
  if (validFilters.length === 1) return validFilters[0];

  return {
    allOf: validFilters,
  };
}

/**
 * Merge multiple filters with OR logic (any condition can match)
 */
export function mergeFiltersOR(
  ...filters: Record<string, any>[]
): Record<string, any> {
  const validFilters = filters.filter((f) => Object.keys(f).length > 0);

  if (validFilters.length === 0) return {};
  if (validFilters.length === 1) return validFilters[0];

  return {
    anyOf: validFilters,
  };
}

/**
 * Negate a filter (NOT logic) — RFC 8620 §5.5 FilterOperator
 */
export function negateFilter(filter: Record<string, any>): Record<string, any> {
  return {
    operator: 'NOT',
    conditions: [filter],
  };
}

/**
 * Check if a SearchFilter has any active constraints
 */
export function hasActiveFilters(filter: SearchFilter | null | undefined): boolean {
  if (!filter) return false;

  return (
    !!filter.from ||
    !!filter.to ||
    !!filter.cc ||
    !!filter.subject ||
    !!filter.text ||
    !!filter.before ||
    !!filter.after ||
    filter.hasAttachment === true ||
    filter.isUnread === true ||
    filter.isFlagged === true ||
    filter.isDraft === true ||
    filter.isAnswered === true
  );
}

/**
 * Example JMAP filters for common use cases
 */
export const COMMON_FILTERS = {
  unread: () => ({
    notHasKeyword: '$seen',
  }),

  flagged: () => ({
    hasKeyword: '$flagged',
  }),

  hasAttachments: () => ({
    hasAttachment: true,
  }),

  drafts: () => ({
    hasKeyword: '$draft',
  }),

  sent: () => ({
    hasKeyword: '$sent',
  }),

  answered: () => ({
    hasKeyword: '$answered',
  }),

  today: () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      after: today.toISOString(),
    };
  },

  thisWeek: () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      after: weekAgo.toISOString(),
    };
  },

  thisMonth: () => {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      after: monthAgo.toISOString(),
    };
  },

  older: () => {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      before: monthAgo.toISOString(),
    };
  },
};
