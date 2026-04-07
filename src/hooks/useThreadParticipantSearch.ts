/**
 * Thread Participant Search Hook
 * 
 * Provides specialized functionality for searching threads by participant,
 * per RFC 8621 Thread/query filter options.
 */

import { useCallback, useMemo } from 'react';
import { useThreadQuery, type UseThreadQueryOptions } from './jmap/useJMAPQueries';
import type { ThreadFilter, ThreadFilterCondition, ThreadFilterOperator } from '../types/jmap';

/**
 * Options for thread participant search
 */
export interface ThreadParticipantSearchOptions {
  /** Find threads containing emails from this sender */
  from?: string;
  /** Find threads containing emails to this recipient */
  to?: string;
  /** Find threads containing emails with this subject */
  subject?: string;
  /** Find threads containing emails with attachments */
  hasAttachment?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Additional filter conditions */
  additionalFilters?: ThreadFilter[];
}

/**
 * Build a ThreadFilter from participant search options
 */
export function buildThreadParticipantFilter(
  options: ThreadParticipantSearchOptions
): ThreadFilter | undefined {
  const conditions: (ThreadFilterCondition | ThreadFilterOperator)[] = [];

  if (options.from) {
    conditions.push({ from: options.from });
  }

  if (options.to) {
    conditions.push({ to: options.to });
  }

  if (options.subject) {
    conditions.push({ subject: options.subject });
  }

  if (options.hasAttachment !== undefined) {
    conditions.push({ hasAttachment: options.hasAttachment });
  }

  if (options.additionalFilters?.length) {
    conditions.push(...options.additionalFilters);
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { allOf: conditions };
}

/**
 * Hook for searching threads by participant
 * 
 * @example
 * // Find threads with specific sender
 * const { data: threads } = useThreadParticipantSearch({
 *   from: 'john@example.com',
 *   limit: 50
 * });
 * 
 * @example
 * // Find threads where user is involved with specific subject
 * const { data: threads } = useThreadParticipantSearch({
 *   to: 'me@example.com',
 *   subject: 'Project Update',
 *   hasAttachment: true
 * });
 * 
 * @example
 * // Find threads with multiple participants
 * const { data: threads } = useThreadParticipantSearch({
 *   from: 'boss@example.com',
 *   to: 'team@example.com'
 * });
 */
export function useThreadParticipantSearch(options: ThreadParticipantSearchOptions = {}) {
  const filter = useMemo(() => buildThreadParticipantFilter(options), [
    options.from,
    options.to,
    options.subject,
    options.hasAttachment,
    options.additionalFilters,
  ]);

  const queryOptions: UseThreadQueryOptions = useMemo(() => ({
    filter,
    limit: options.limit,
  }), [filter, options.limit]);

  return useThreadQuery(queryOptions);
}

/**
 * Hook for finding threads involving the current user
 */
export function useThreadsInvolvingUser(userEmail: string, limit = 50) {
  return useThreadParticipantSearch({
    to: userEmail,
    limit,
  });
}

/**
 * Hook for finding threads with specific sender
 */
export function useThreadsFromSender(senderEmail: string, limit = 50) {
  return useThreadParticipantSearch({
    from: senderEmail,
    limit,
  });
}

/**
 * Hook for finding threads with attachments from specific sender
 */
export function useThreadsWithAttachmentsFrom(senderEmail: string, limit = 50) {
  return useThreadParticipantSearch({
    from: senderEmail,
    hasAttachment: true,
    limit,
  });
}

/**
 * Create a callback for building thread participant filters
 * Useful when you need to build filters dynamically
 */
export function useThreadParticipantFilterBuilder() {
  return useCallback(
    (options: ThreadParticipantSearchOptions): ThreadFilter | undefined => {
      return buildThreadParticipantFilter(options);
    },
    []
  );
}
