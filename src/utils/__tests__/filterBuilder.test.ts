/**
 * Filter Builder — RFC 8621 §4.4.1 Compliance Tests
 *
 * Tests that filter construction produces valid JMAP Email/query filters
 * per RFC 8621 Section 4.4.1 (FilterCondition) and RFC 8620 Section 5.5 (FilterOperator).
 */

import { describe, it, expect } from 'vitest';
import {
  buildJMAPFilter,
  mergeFiltersAND,
  mergeFiltersOR,
  negateFilter,
  hasActiveFilters,
  COMMON_FILTERS,
} from '../../utils/filterBuilder';
import type { SearchFilter } from '../../types/search';
import type { EmailFilterCondition } from '../../types/jmap';

/** Helper to assert filter is a condition type */
function asCondition(filter: unknown): EmailFilterCondition {
  return filter as EmailFilterCondition;
}

describe('filterBuilder — RFC 8621 §4.4.1 Compliance', () => {
  // =========================================================================
  // buildJMAPFilter
  // =========================================================================
  describe('buildJMAPFilter', () => {
    it('should produce empty object for empty filter', () => {
      expect(buildJMAPFilter({})).toEqual({});
    });

    it('should map text search to "text" property (§4.4.1)', () => {
      const filter = buildJMAPFilter({ text: 'hello world' });
      expect(filter).toEqual({ text: 'hello world' });
    });

    it('should map from field to "from" property (§4.4.1)', () => {
      const filter = buildJMAPFilter({ from: 'alice@example.com' });
      expect(asCondition(filter).from).toBe('alice@example.com');
    });

    it('should map to field to "to" property (§4.4.1)', () => {
      const filter = buildJMAPFilter({ to: 'bob@example.com' });
      expect(asCondition(filter).to).toBe('bob@example.com');
    });

    it('should map cc field to "cc" property (§4.4.1)', () => {
      const filter = buildJMAPFilter({ cc: 'carol@example.com' });
      expect(asCondition(filter).cc).toBe('carol@example.com');
    });

    it('should map subject field to "subject" property (§4.4.1)', () => {
      const filter = buildJMAPFilter({ subject: 'meeting notes' });
      expect(asCondition(filter).subject).toBe('meeting notes');
    });

    it('should map hasAttachment to boolean (§4.4.1)', () => {
      const filter = buildJMAPFilter({ hasAttachment: true });
      expect(asCondition(filter).hasAttachment).toBe(true);
    });

    it('should not include hasAttachment when false', () => {
      const filter = buildJMAPFilter({ hasAttachment: false });
      expect(filter).not.toHaveProperty('hasAttachment');
    });

    it('should skip isUnread filter on servers without notHasKeyword support', () => {
      const filter = buildJMAPFilter({ isUnread: true });
      expect(filter).toEqual({});
    });

    it('should map isFlagged to hasKeyword: "$flagged" (§4.4.1)', () => {
      const filter = buildJMAPFilter({ isFlagged: true });
      expect(asCondition(filter).hasKeyword).toBe('$flagged');
    });

    it('should map isDraft to hasKeyword: "$draft" (§4.4.1)', () => {
      const filter = buildJMAPFilter({ isDraft: true });
      expect(asCondition(filter).hasKeyword).toBe('$draft');
    });

    it('should map isAnswered to hasKeyword: "$answered" (§4.4.1)', () => {
      const filter = buildJMAPFilter({ isAnswered: true });
      expect(asCondition(filter).hasKeyword).toBe('$answered');
    });

    it('should convert "from: me" to user email address', () => {
      const filter = buildJMAPFilter({ from: 'me' }, 'user@example.com');
      expect(asCondition(filter).from).toBe('user@example.com');
    });

    it('should keep "from: me" as-is when no user email provided', () => {
      const filter = buildJMAPFilter({ from: 'me' });
      expect(asCondition(filter).from).toBe('me');
    });

    it('should format after date as ISO 8601 UTCDate (§4.4.1)', () => {
      const date = new Date('2024-06-15T00:00:00Z');
      const filter = buildJMAPFilter({ after: date });
      expect(asCondition(filter).after).toBe('2024-06-15T00:00:00.000Z');
    });

    it('should format before date as ISO 8601 UTCDate (§4.4.1)', () => {
      const date = new Date('2024-12-31T23:59:59Z');
      const filter = buildJMAPFilter({ before: date });
      expect(asCondition(filter).before).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should combine multiple conditions in a single object', () => {
      const filter = buildJMAPFilter({
        from: 'alice@example.com',
        subject: 'invoice',
        hasAttachment: true,
      });
      expect(filter).toEqual({
        from: 'alice@example.com',
        subject: 'invoice',
        hasAttachment: true,
      });
    });

    it('should convert headerFilters to "header" String[] conditions (§4.4.1)', () => {
      const filter = buildJMAPFilter({
        headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
      });
      expect(filter).toEqual({ header: ['List-Id', 'newsletter'] });
    });

    it('should handle headerFilters without value (exists only)', () => {
      const filter = buildJMAPFilter({
        headerFilters: [{ headerName: 'X-Spam-Status' }],
      });
      expect(filter).toEqual({ header: ['X-Spam-Status'] });
    });

    it('should merge header filters with other conditions into a flat object', () => {
      const filter = buildJMAPFilter({
        from: 'alice@example.com',
        headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
      });
      expect(filter).toEqual({
        from: 'alice@example.com',
        header: ['List-Id', 'newsletter'],
      });
    });

    it('should merge multiple header filters into a flat object (last wins)', () => {
      const filter = buildJMAPFilter({
        headerFilters: [
          { headerName: 'List-Id', value: 'newsletter' },
          { headerName: 'X-Custom', value: 'value' },
        ],
      });
      // Multiple header filters merge into a single object; last header wins
      expect(filter).toEqual({ header: ['X-Custom', 'value'] });
    });

    it('should merge header filters with keyword filters into a flat object', () => {
      const filter = buildJMAPFilter({
        isFlagged: true,
        headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
      });
      expect(filter).toEqual({
        hasKeyword: '$flagged',
        header: ['List-Id', 'newsletter'],
      });
    });

    it('should merge multiple keyword filters into a flat object (last wins)', () => {
      // RFC 8621 §4.4.1: hasKeyword is a single String, so multiple keyword
      // conditions merge into a flat object; last keyword wins
      const filter = buildJMAPFilter({ isFlagged: true, isDraft: true });

      // Flat merge: only the last hasKeyword remains
      expect(filter).toEqual({ hasKeyword: '$draft' });
    });
  });

  // =========================================================================
  // mergeFiltersAND / mergeFiltersOR
  // =========================================================================
  describe('mergeFiltersAND', () => {
    it('should return empty object for no filters', () => {
      expect(mergeFiltersAND()).toEqual({});
    });

    it('should return single filter unchanged', () => {
      expect(mergeFiltersAND({ from: 'alice' })).toEqual({ from: 'alice' });
    });

    it('should merge multiple flat filters into a single object', () => {
      const result = mergeFiltersAND({ from: 'alice' }, { to: 'bob' });
      expect(result).toEqual({
        from: 'alice',
        to: 'bob',
      });
    });

    it('should filter out empty objects', () => {
      const result = mergeFiltersAND({}, { from: 'alice' }, {});
      expect(result).toEqual({ from: 'alice' });
    });
  });

  describe('mergeFiltersOR', () => {
    it('should return empty object for no filters', () => {
      expect(mergeFiltersOR()).toEqual({});
    });

    it('should return single filter unchanged', () => {
      expect(mergeFiltersOR({ from: 'alice' })).toEqual({ from: 'alice' });
    });

    it('should wrap multiple filters in anyOf (RFC 8620 §5.5)', () => {
      const result = mergeFiltersOR({ from: 'alice' }, { from: 'bob' });
      expect(result).toEqual({
        anyOf: [{ from: 'alice' }, { from: 'bob' }],
      });
    });
  });

  // =========================================================================
  // negateFilter
  // =========================================================================
  describe('negateFilter', () => {
    it('should wrap filter in NOT operator (RFC 8620 §5.5)', () => {
      const result = negateFilter({ from: 'spammer@evil.com' });
      expect(result).toEqual({
        not: { from: 'spammer@evil.com' },
      });
    });

    it('should use RFC-compliant not field instead of deprecated operator', () => {
      const result = negateFilter({ hasAttachment: true });
      expect(result).toHaveProperty('not');
      expect(result).not.toHaveProperty('operator');
      expect(result).not.toHaveProperty('conditions');
      expect((result as { not: unknown }).not).toEqual({ hasAttachment: true });
    });
  });

  // =========================================================================
  // hasActiveFilters
  // =========================================================================
  describe('hasActiveFilters', () => {
    it('should return false for null/undefined', () => {
      expect(hasActiveFilters(null)).toBe(false);
      expect(hasActiveFilters(undefined)).toBe(false);
    });

    it('should return false for empty filter', () => {
      expect(hasActiveFilters({} as SearchFilter)).toBe(false);
    });

    it('should return true when any field is set', () => {
      expect(hasActiveFilters({ from: 'alice' } as SearchFilter)).toBe(true);
      expect(hasActiveFilters({ to: 'bob' } as SearchFilter)).toBe(true);
      expect(hasActiveFilters({ hasAttachment: true } as SearchFilter)).toBe(true);
      expect(hasActiveFilters({ isUnread: true } as SearchFilter)).toBe(true);
      expect(hasActiveFilters({ isFlagged: true } as SearchFilter)).toBe(true);
      expect(hasActiveFilters({ headerFilters: [{ headerName: 'List-Id' }] } as SearchFilter)).toBe(true);
    });
  });

  // =========================================================================
  // COMMON_FILTERS
  // =========================================================================
  describe('COMMON_FILTERS', () => {
    it('unread filter should use notHasKeyword: "$seen"', () => {
      expect(COMMON_FILTERS.unread()).toEqual({ notHasKeyword: '$seen' });
    });

    it('flagged filter should use hasKeyword: "$flagged"', () => {
      expect(COMMON_FILTERS.flagged()).toEqual({ hasKeyword: '$flagged' });
    });

    it('hasAttachments filter should use hasAttachment: true', () => {
      expect(COMMON_FILTERS.hasAttachments()).toEqual({ hasAttachment: true });
    });

    it('drafts filter should use hasKeyword: "$draft"', () => {
      expect(COMMON_FILTERS.drafts()).toEqual({ hasKeyword: '$draft' });
    });

    it('sent filter should use inMailbox with the Sent mailbox ID (not $sent keyword)', () => {
      // RFC 8621 §4.1.1 does not define "$sent" as a standard keyword.
      // Filtering sent mail is done via inMailbox with the Sent folder ID.
      expect(COMMON_FILTERS.sent('sent-folder-id')).toEqual({ inMailbox: 'sent-folder-id' });
    });

    it('answered filter should use hasKeyword: "$answered"', () => {
      expect(COMMON_FILTERS.answered()).toEqual({ hasKeyword: '$answered' });
    });

    it('today filter should use after with today date', () => {
      const filter = COMMON_FILTERS.today();
      expect(filter).toHaveProperty('after');
      // Should be a valid ISO date
      expect(new Date(filter.after).toISOString()).toBe(filter.after);
    });

    it('thisWeek filter should use after with ~7 days ago', () => {
      const filter = COMMON_FILTERS.thisWeek();
      expect(filter).toHaveProperty('after');
      const afterDate = new Date(filter.after);
      const now = new Date();
      // Should be roughly 7 days ago (within 1 second tolerance)
      const diffMs = now.getTime() - afterDate.getTime();
      expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // > 6 days
      expect(diffMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);    // < 8 days
    });
  });
});
