import { describe, it, expect } from 'vitest';
import {
  parseSearchQuery,
  filterToPills,
  removeFilter,
} from '../searchParser';

describe('searchParser', () => {
  describe('parseSearchQuery', () => {
    it('should parse empty query', () => {
      const result = parseSearchQuery('');
      expect(result.text).toBe('');
      expect(result.filters).toEqual({});
    });

    it('should parse free text query without filters', () => {
      const result = parseSearchQuery('hello world');
      expect(result.text).toBe('hello world');
      expect(result.filters).toEqual({});
    });

    it('should parse from: filter', () => {
      const result = parseSearchQuery('from:alice@example.com');
      expect(result.filters.from).toBe('alice@example.com');
      expect(result.text).toBe('');
    });

    it('should parse from: filter with free text', () => {
      const result = parseSearchQuery('hello from:alice@example.com world');
      expect(result.filters.from).toBe('alice@example.com');
      // Filter removal preserves surrounding whitespace
      expect(result.text).toContain('hello');
      expect(result.text).toContain('world');
    });

    it('should parse to: filter', () => {
      const result = parseSearchQuery('to:bob@example.com');
      expect(result.filters.to).toBe('bob@example.com');
      expect(result.text).toBe('');
    });

    it('should parse cc: filter', () => {
      const result = parseSearchQuery('cc:carol@example.com');
      expect(result.filters.cc).toBe('carol@example.com');
      expect(result.text).toBe('');
    });

    it('should parse subject: filter with single word', () => {
      const result = parseSearchQuery('subject:meeting');
      expect(result.filters.subject).toBe('meeting');
      expect(result.text).toBe('');
    });

    it('should parse subject: filter with quoted phrase', () => {
      const result = parseSearchQuery('subject:"quarterly review"');
      expect(result.filters.subject).toBe('quarterly review');
      expect(result.text).toBe('');
    });

    it('should parse has:attachment filter (case insensitive)', () => {
      const result = parseSearchQuery('HAS:ATTACHMENT');
      expect(result.filters.hasAttachment).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse is:unread filter (case insensitive)', () => {
      const result = parseSearchQuery('Is:Unread');
      expect(result.filters.isUnread).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse is:flagged filter', () => {
      const result = parseSearchQuery('is:flagged');
      expect(result.filters.isFlagged).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse is:draft filter', () => {
      const result = parseSearchQuery('is:draft');
      expect(result.filters.isDraft).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse is:answered filter', () => {
      const result = parseSearchQuery('is:answered');
      expect(result.filters.isAnswered).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse before: date filter', () => {
      const result = parseSearchQuery('before:2024-01-15');
      expect(result.filters.before).toBeInstanceOf(Date);
      expect(result.filters.before?.toISOString()).toBe('2024-01-15T23:59:59.999Z');
      expect(result.text).toBe('');
    });

    it('should parse after: date filter', () => {
      const result = parseSearchQuery('after:2024-01-01');
      expect(result.filters.after).toBeInstanceOf(Date);
      expect(result.filters.after?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(result.text).toBe('');
    });

    it('should parse combined filters', () => {
      const result = parseSearchQuery('from:alice@example.com to:bob@example.com has:attachment');
      expect(result.filters.from).toBe('alice@example.com');
      expect(result.filters.to).toBe('bob@example.com');
      expect(result.filters.hasAttachment).toBe(true);
      expect(result.text).toBe('');
    });

    it('should parse complex query with multiple filters and free text', () => {
      const result = parseSearchQuery('project update from:manager@company.com after:2024-01-01 has:attachment');
      expect(result.text).toBe('project update');
      expect(result.filters.from).toBe('manager@company.com');
      expect(result.filters.after).toBeInstanceOf(Date);
      expect(result.filters.hasAttachment).toBe(true);
    });

    it('should handle duplicate filters (first one wins)', () => {
      const result = parseSearchQuery('from:alice@example.com from:bob@example.com');
      // The first from: filter wins (regex matches first occurrence)
      expect(result.text.trim()).toBe('from:bob@example.com');
      expect(result.filters.from).toBe('alice@example.com');
    });

    it('should handle email addresses with special characters', () => {
      const result = parseSearchQuery('from:user+tag@example.com');
      expect(result.filters.from).toBe('user+tag@example.com');
    });

    it('should handle multiple words in free text', () => {
      const result = parseSearchQuery('urgent meeting tomorrow from:boss@company.com');
      expect(result.text).toBe('urgent meeting tomorrow');
      expect(result.filters.from).toBe('boss@company.com');
    });

    it('should preserve extra whitespace in free text', () => {
      const result = parseSearchQuery('hello   world   from:test@example.com');
      expect(result.text).toBe('hello   world');
    });

    it('should handle invalid date format gracefully (no match)', () => {
      const result = parseSearchQuery('before:invalid-date');
      expect(result.filters.before).toBeUndefined();
      expect(result.text).toBe('before:invalid-date');
    });

    it('should handle partial date format', () => {
      const result = parseSearchQuery('before:2024-01');
      expect(result.filters.before).toBeUndefined();
    });

    it('should parse header:Name (existence check)', () => {
      const result = parseSearchQuery('header:List-Id');
      expect(result.filters.headerFilters).toHaveLength(1);
      expect(result.filters.headerFilters![0].headerName).toBe('List-Id');
      expect(result.filters.headerFilters![0].value).toBeUndefined();
      expect(result.text).toBe('');
    });

    it('should parse header:Name:value (value contains)', () => {
      const result = parseSearchQuery('header:List-Id:newsletter');
      expect(result.filters.headerFilters).toHaveLength(1);
      expect(result.filters.headerFilters![0].headerName).toBe('List-Id');
      expect(result.filters.headerFilters![0].value).toBe('newsletter');
      expect(result.text).toBe('');
    });

    it('should parse header filter with free text', () => {
      const result = parseSearchQuery('hello header:X-Custom:world test');
      expect(result.filters.headerFilters).toHaveLength(1);
      expect(result.filters.headerFilters![0].headerName).toBe('X-Custom');
      expect(result.filters.headerFilters![0].value).toBe('world');
      expect(result.text).toContain('hello');
      expect(result.text).toContain('test');
    });

    it('should parse header filter alongside other filters', () => {
      const result = parseSearchQuery('from:alice@example.com header:List-Id:newsletter has:attachment');
      expect(result.filters.from).toBe('alice@example.com');
      expect(result.filters.headerFilters).toHaveLength(1);
      expect(result.filters.headerFilters![0].headerName).toBe('List-Id');
      expect(result.filters.headerFilters![0].value).toBe('newsletter');
      expect(result.filters.hasAttachment).toBe(true);
    });
  });

  describe('filterToPills', () => {
    it('should convert empty filters to empty pills array', () => {
      const pills = filterToPills({});
      expect(pills).toEqual([]);
    });

    it('should create from pill', () => {
      const pills = filterToPills({ from: 'alice@example.com' });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'from-alice@example.com',
        type: 'from',
        label: 'From: alice@example.com',
        value: 'alice@example.com',
      });
    });

    it('should create to pill', () => {
      const pills = filterToPills({ to: 'bob@example.com' });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'to-bob@example.com',
        type: 'to',
        label: 'To: bob@example.com',
        value: 'bob@example.com',
      });
    });

    it('should create cc pill', () => {
      const pills = filterToPills({ cc: 'carol@example.com' });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'cc-carol@example.com',
        type: 'cc',
        label: 'CC: carol@example.com',
        value: 'carol@example.com',
      });
    });

    it('should create subject pill', () => {
      const pills = filterToPills({ subject: 'meeting' });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'subject-meeting',
        type: 'subject',
        label: 'Subject: meeting',
        value: 'meeting',
      });
    });

    it('should create attachment pill', () => {
      const pills = filterToPills({ hasAttachment: true });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'has-attachment',
        type: 'attachment',
        label: 'Has Attachments',
        value: 'true',
      });
    });

    it('should create unread pill', () => {
      const pills = filterToPills({ isUnread: true });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'is-unread',
        type: 'unread',
        label: 'Unread',
        value: 'true',
      });
    });

    it('should create flagged pill', () => {
      const pills = filterToPills({ isFlagged: true });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'is-flagged',
        type: 'flagged',
        label: 'Flagged',
        value: 'true',
      });
    });

    it('should create draft pill', () => {
      const pills = filterToPills({ isDraft: true });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        id: 'is-draft',
        type: 'draft',
        label: 'Draft',
        value: 'true',
      });
    });

    it('should create date range pill with both dates', () => {
      const after = new Date('2024-01-01');
      const before = new Date('2024-01-31');
      const pills = filterToPills({ after, before });
      expect(pills).toHaveLength(1);
      expect(pills[0].type).toBe('date');
      expect(pills[0].id).toBe('date-range');
      expect(pills[0].label).toContain('Date:');
    });

    it('should create date range pill with only after date', () => {
      const after = new Date('2024-01-01');
      const pills = filterToPills({ after });
      expect(pills).toHaveLength(1);
      expect(pills[0].type).toBe('date');
      expect(pills[0].label).toContain('Date:');
      // After-only shows the after date on the left side
      expect(pills[0].label).toMatch(/2024/);
    });

    it('should create date range pill with only before date', () => {
      const before = new Date('2024-01-31');
      const pills = filterToPills({ before });
      expect(pills).toHaveLength(1);
      expect(pills[0].type).toBe('date');
      expect(pills[0].label).toContain('Date:');
      expect(pills[0].label).toMatch(/Any/);
    });

    it('should create header pill for header:Name (existence)', () => {
      const pills = filterToPills({
        headerFilters: [{ headerName: 'List-Id' }],
      });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        type: 'header',
        label: 'Header: List-Id',
      });
    });

    it('should create header pill for header:Name:value', () => {
      const pills = filterToPills({
        headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
      });
      expect(pills).toHaveLength(1);
      expect(pills[0]).toMatchObject({
        type: 'header',
        label: 'Header: List-Id: newsletter',
      });
    });

    it('should convert multiple filters to pills', () => {
      const pills = filterToPills({
        from: 'alice@example.com',
        hasAttachment: true,
        isUnread: true,
      });
      expect(pills).toHaveLength(3);
      const types = pills.map(p => p.type);
      expect(types).toContain('from');
      expect(types).toContain('attachment');
      expect(types).toContain('unread');
    });
  });

  describe('removeFilter', () => {
    it('should remove from filter', () => {
      const filters = { from: 'alice@example.com', hasAttachment: true };
      const result = removeFilter(filters, 'from');
      expect(result.from).toBeUndefined();
      expect(result.hasAttachment).toBe(true);
    });

    it('should remove to filter', () => {
      const filters = { to: 'bob@example.com', isUnread: true };
      const result = removeFilter(filters, 'to');
      expect(result.to).toBeUndefined();
      expect(result.isUnread).toBe(true);
    });

    it('should remove cc filter', () => {
      const filters = { cc: 'carol@example.com' };
      const result = removeFilter(filters, 'cc');
      expect(result.cc).toBeUndefined();
    });

    it('should remove subject filter', () => {
      const filters = { subject: 'meeting' };
      const result = removeFilter(filters, 'subject');
      expect(result.subject).toBeUndefined();
    });

    it('should set hasAttachment to false when removing attachment filter', () => {
      const filters = { hasAttachment: true };
      const result = removeFilter(filters, 'attachment');
      expect(result.hasAttachment).toBe(false);
    });

    it('should set isUnread to false when removing unread filter', () => {
      const filters = { isUnread: true };
      const result = removeFilter(filters, 'unread');
      expect(result.isUnread).toBe(false);
    });

    it('should set isFlagged to false when removing flagged filter', () => {
      const filters = { isFlagged: true };
      const result = removeFilter(filters, 'flagged');
      expect(result.isFlagged).toBe(false);
    });

    it('should set isDraft to false when removing draft filter', () => {
      const filters = { isDraft: true };
      const result = removeFilter(filters, 'draft');
      expect(result.isDraft).toBe(false);
    });

    it('should remove both before and after when removing date filter', () => {
      const filters = { before: new Date(), after: new Date() };
      const result = removeFilter(filters, 'date');
      expect(result.before).toBeUndefined();
      expect(result.after).toBeUndefined();
    });

    it('should not mutate original filters object', () => {
      const filters = { from: 'alice@example.com', isUnread: true };
      const result = removeFilter(filters, 'from');
      expect(filters.from).toBe('alice@example.com'); // original unchanged
      expect(result.from).toBeUndefined(); // copy is changed
    });

    it('should remove header filter', () => {
      const filters = {
        from: 'alice@example.com',
        headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
      };
      const result = removeFilter(filters, 'header');
      expect(result.from).toBe('alice@example.com');
      expect(result.headerFilters).toBeUndefined();
    });

    it('should return unchanged object for unknown filter type', () => {
      const filters = { from: 'alice@example.com' };
      const result = removeFilter(filters, 'unknown');
      expect(result).toEqual(filters);
    });
  });
});
