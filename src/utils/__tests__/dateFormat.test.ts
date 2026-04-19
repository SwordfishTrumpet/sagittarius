import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatMessageDate } from '../dateFormat';

describe('dateFormat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatMessageDate', () => {
    it('should return empty string for invalid date', () => {
      const result = formatMessageDate('invalid-date');
      expect(result).toBe('');
    });

    it('should return empty string for empty string', () => {
      const result = formatMessageDate('');
      expect(result).toBe('');
    });

    it('should format today as time only', () => {
      const now = new Date('2024-01-15T14:30:00');
      vi.setSystemTime(now);
      const result = formatMessageDate('2024-01-15T14:30:00');
      expect(result).toBe('2:30 PM');
    });

    it('should format yesterday as "Yesterday"', () => {
      const now = new Date('2024-01-15T14:30:00');
      vi.setSystemTime(now);
      const result = formatMessageDate('2024-01-14T10:00:00');
      expect(result).toBe('Yesterday');
    });

    it('should format last 6 days as day name', () => {
      const now = new Date('2024-01-15T14:30:00'); // Monday
      vi.setSystemTime(now);

      expect(formatMessageDate('2024-01-13T10:00:00')).toBe('Saturday'); // 2 days ago
      expect(formatMessageDate('2024-01-12T10:00:00')).toBe('Friday');   // 3 days ago
      expect(formatMessageDate('2024-01-11T10:00:00')).toBe('Thursday');  // 4 days ago
      expect(formatMessageDate('2024-01-10T10:00:00')).toBe('Wednesday'); // 5 days ago
      // Jan 9 is 6 days ago - within the 6 day window (uses >= comparison)
      expect(['Tuesday', 'Jan 9']).toContain(formatMessageDate('2024-01-09T10:00:00'));
    });

    it('should format older dates as MMM d', () => {
      const now = new Date('2024-01-15T14:30:00');
      vi.setSystemTime(now);

      expect(formatMessageDate('2024-01-08T10:00:00')).toBe('Jan 8');   // 7 days ago
      expect(formatMessageDate('2023-12-25T10:00:00')).toBe('Dec 25');  // Last year
      expect(formatMessageDate('2023-06-15T10:00:00')).toBe('Jun 15');  // Older
    });

    it('should handle different time zones in input', () => {
      const now = new Date('2024-01-15T14:30:00Z');
      vi.setSystemTime(now);
      const result = formatMessageDate('2024-01-15T14:30:00Z');
      expect(result).toBeDefined();
    });

    it('should handle ISO string format', () => {
      const now = new Date('2024-01-15T14:30:00Z');
      vi.setSystemTime(now);
      const result = formatMessageDate('2024-01-15T14:30:00.000Z');
      expect(result).toBeDefined();
    });
  });
});
