/**
 * Filter Builder
 * Converts SearchFilter objects to JMAP RFC 8621 Email/query filters
 */

import { SearchFilter } from '../types/search';
import type { EmailFilter, EmailFilterCondition } from '../types/jmap';

/**
 * Build a JMAP-compliant Email/query filter from SearchFilter
 * Handles special cases like "from:me", date ranges, and keywords
 */
export function buildJMAPFilter(
  filter: SearchFilter,
  userEmail?: string
): EmailFilter {
  const jmapFilter: EmailFilterCondition = {};

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

  // Keyword-based boolean filters — RFC 8621 §4.4.1: hasKeyword is a single
  // String, so when multiple keywords are active we must wrap them in allOf.
  const keywordConditions: string[] = [];
  if (filter.isFlagged === true) keywordConditions.push('$flagged');
  if (filter.isDraft === true) keywordConditions.push('$draft');
  if (filter.isAnswered === true) keywordConditions.push('$answered');

  const keywordConditionsForExtra: string[] = [];
  if (keywordConditions.length === 1) {
    jmapFilter.hasKeyword = keywordConditions[0];
  } else if (keywordConditions.length > 1) {
    keywordConditionsForExtra.push(...keywordConditions);
  }

  // Collect extra conditions that need allOf wrapping (header filters + overflow keywords)
  const extraConditions: EmailFilterCondition[] = [];

  if (keywordConditionsForExtra.length > 0) {
    extraConditions.push(...keywordConditionsForExtra.map((kw) => ({ hasKeyword: kw })));
  }

  // Header filters — RFC 8621 §4.4.1: FilterCondition "header" is String[]
  // Each header filter needs its own condition (multiple headers don't fit in one)
  if (filter.headerFilters && filter.headerFilters.length > 0) {
    for (const hf of filter.headerFilters) {
      const header: string[] = [hf.headerName];
      if (hf.value) header.push(hf.value);
      extraConditions.push({ header });
    }
  }

  if (extraConditions.length === 0) return jmapFilter;
  if (Object.keys(jmapFilter).length === 0) {
    return extraConditions.length === 1 ? extraConditions[0] : { allOf: extraConditions };
  }
  return { allOf: [jmapFilter, ...extraConditions] };
}

/**
 * Merge multiple filters with AND logic (all conditions must match)
 * This is useful for combining mailbox filters with advanced search filters
 */
export function mergeFiltersAND(
  ...filters: EmailFilter[]
): EmailFilter {
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
  ...filters: EmailFilter[]
): EmailFilter {
  const validFilters = filters.filter((f) => Object.keys(f).length > 0);

  if (validFilters.length === 0) return {};
  if (validFilters.length === 1) return validFilters[0];

  return {
    anyOf: validFilters,
  };
}

/**
 * Negate a filter (NOT logic) — RFC 8620 §5.5 FilterOperator
 * Returns { not: filter } structure per RFC 8620 §5.5
 */
export function negateFilter(filter: EmailFilter): EmailFilter {
  return {
    not: filter,
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
    filter.isAnswered === true ||
    (filter.headerFilters !== undefined && filter.headerFilters.length > 0)
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

  // NOTE: There is no standard "$sent" keyword in RFC 8621 §4.1.1.
  // To filter sent emails, use inMailbox with the Sent mailbox ID instead.
  // Kept as inMailboxWithRole for convenience — callers should resolve the
  // role to a concrete mailbox ID before passing to Email/query.
  sent: (sentMailboxId: string) => ({
    inMailbox: sentMailboxId,
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
