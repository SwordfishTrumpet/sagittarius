/**
 * Email List Benchmark Tests
 * 
 * Tests the email list performance benchmarks with smaller datasets
 * for faster test execution.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTestEmails,
  benchmarkEmailFiltering,
  benchmarkEmailSorting,
  benchmarkThreadGrouping,
  benchmarkEmailSearch,
} from '../emailList.benchmark';

describe('emailList.benchmark', () => {
  describe('generateTestEmails', () => {
    it('generates correct number of emails', () => {
      const emails = generateTestEmails(100);
      expect(emails).toHaveLength(100);
    });

    it('generates emails with required fields', () => {
      const emails = generateTestEmails(10);
      const email = emails[0];

      expect(email.id).toBeDefined();
      expect(email.blobId).toBeDefined();
      expect(email.threadId).toBeDefined();
      expect(email.mailboxIds).toBeDefined();
      expect(email.keywords).toBeDefined();
      expect(email.size).toBeGreaterThan(0);
      expect(email.receivedAt).toBeDefined();
      expect(email.preview).toBeDefined();
      expect(email.subject).toBeDefined();
      expect(email.from).toBeDefined();
    });

    it('groups emails into threads (3 per thread)', () => {
      const emails = generateTestEmails(12);
      const threadIds = new Set(emails.map(e => e.threadId));
      // 12 emails / 3 per thread = 4 threads
      expect(threadIds.size).toBe(4);
    });

    it('assigns sequential email IDs', () => {
      const emails = generateTestEmails(5);
      expect(emails[0].id).toContain('0');
      expect(emails[4].id).toContain('4');
    });

    it('sets dates in descending order', () => {
      const emails = generateTestEmails(5);
      const dates = emails.map(e => new Date(e.receivedAt).getTime());

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThan(dates[i]);
      }
    });
  });

  describe('benchmarkEmailFiltering', () => {
    it('runs filtering benchmark successfully', async () => {
      const result = await benchmarkEmailFiltering(100);

      expect(result.name).toContain('Filter');
      expect(result.iterations).toBe(100);
      expect(result.avgMs).toBeGreaterThan(0);
      expect(result.opsPerSecond).toBeGreaterThan(0);
    });

    it('filters unread emails in benchmark', async () => {
      const result = await benchmarkEmailFiltering(50);

      // Should complete quickly with small dataset
      expect(result.avgMs).toBeLessThan(50);
      expect(result.durationMs).toBeLessThan(1000);
    });
  });

  describe('benchmarkEmailSorting', () => {
    it('runs sorting benchmark successfully', async () => {
      const result = await benchmarkEmailSorting(100);

      expect(result.name).toContain('Sort');
      expect(result.avgMs).toBeGreaterThan(0);
    });
  });

  describe('benchmarkThreadGrouping', () => {
    it('runs thread grouping benchmark successfully', async () => {
      const result = await benchmarkThreadGrouping(100);

      expect(result.name).toContain('Group');
      expect(result.avgMs).toBeGreaterThan(0);
    });
  });

  describe('benchmarkEmailSearch', () => {
    it('runs search benchmark successfully', async () => {
      const result = await benchmarkEmailSearch(100);

      expect(result.name).toContain('Search');
      expect(result.avgMs).toBeGreaterThan(0);
    });
  });
});
