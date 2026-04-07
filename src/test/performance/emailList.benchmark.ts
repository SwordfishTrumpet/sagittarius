/**
 * Email List Performance Benchmarks
 * 
 * Tests rendering and processing performance for large email lists,
 * specifically targeting 10K+ email mailboxes as mentioned in the TODO.
 */

import { runBenchmark, formatBenchmarkResult, assertPerformance, type BenchmarkResult } from './benchmarkRunner';
import type { Email } from '../../types/jmap';

/**
 * Generate a large dataset of test emails
 */
export function generateTestEmails(count: number, mailboxId = 'inbox'): Email[] {
  const emails: Email[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const date = new Date(now - i * 1000 * 60 * 60); // Each email 1 hour apart
    emails.push({
      id: `email-${i.toString().padStart(6, '0')}`,
      blobId: `blob-${i}`,
      threadId: `thread-${Math.floor(i / 3)}`, // 3 emails per thread
      mailboxIds: { [mailboxId]: true },
      keywords: i % 5 === 0 ? { $seen: true } : {}, // 20% read
      size: 1000 + (i % 10000), // Varying sizes
      receivedAt: date.toISOString(),
      hasAttachment: i % 7 === 0, // ~14% have attachments
      preview: `This is preview text for email ${i} with some content that might be truncated...`,
      subject: `Test Subject ${i % 100} - ${i}`, // Some repeated subjects
      from: [{ name: `Sender ${i % 50}`, email: `sender${i % 50}@example.com` }],
      to: [{ name: 'Recipient', email: 'recipient@example.com' }],
      cc: null,
      bcc: null,
      replyTo: null,
    });
  }

  return emails;
}

/**
 * Benchmark: Email list filtering performance
 */
export async function benchmarkEmailFiltering(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);

  return runBenchmark(
    `Filter ${emailCount.toLocaleString()} emails (unread)`,
    () => {
      const unread = emails.filter(e => !e.keywords.$seen);
      return void unread;
    },
    { iterations: 100 }
  );
}

/**
 * Benchmark: Email list sorting performance
 */
export async function benchmarkEmailSorting(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);

  return runBenchmark(
    `Sort ${emailCount.toLocaleString()} emails by date`,
    () => {
      const sorted = [...emails].sort((a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
      return void sorted;
    },
    { iterations: 50 }
  );
}

/**
 * Benchmark: Email list grouping by thread
 */
export async function benchmarkThreadGrouping(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);

  return runBenchmark(
    `Group ${emailCount.toLocaleString()} emails by thread`,
    () => {
      const threadMap = new Map<string, Email[]>();
      for (const email of emails) {
        const existing = threadMap.get(email.threadId) || [];
        existing.push(email);
        threadMap.set(email.threadId, existing);
      }
      return void threadMap;
    },
    { iterations: 50 }
  );
}

/**
 * Benchmark: Search text matching across emails
 */
export async function benchmarkEmailSearch(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const searchTerm = 'Subject 50';

  return runBenchmark(
    `Search ${emailCount.toLocaleString()} emails (text match)`,
    () => {
      const matches = emails.filter(e =>
        e.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.preview?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return void matches;
    },
    { iterations: 100 }
  );
}

/**
 * Benchmark: Email deduplication via blobId
 */
export async function benchmarkEmailDeduplication(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  // Create some duplicates
  const withDuplicates = [...emails];
  for (let i = 0; i < emailCount * 0.1; i++) {
    const dup = { ...emails[i], id: `duplicate-${i}` };
    withDuplicates.push(dup);
  }

  return runBenchmark(
    `Deduplicate ${withDuplicates.length.toLocaleString()} emails`,
    () => {
      const seen = new Set<string>();
      const unique = withDuplicates.filter(e => {
        if (seen.has(e.blobId)) return false;
        seen.add(e.blobId);
        return true;
      });
      return void unique;
    },
    { iterations: 50 }
  );
}

/**
 * Run all email list benchmarks
 */
export async function runEmailListBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('\n📧 Email List Performance Benchmarks');
  console.log('═'.repeat(60));

  // 1K email benchmarks
  console.log('\n📦 Testing with 1,000 emails:');
  results.push(await benchmarkEmailFiltering(1000));
  results.push(await benchmarkEmailSorting(1000));
  results.push(await benchmarkThreadGrouping(1000));

  // 10K email benchmarks (the target from TODO)
  console.log('\n📦 Testing with 10,000 emails:');
  results.push(await benchmarkEmailFiltering(10000));
  results.push(await benchmarkEmailSorting(10000));
  results.push(await benchmarkThreadGrouping(10000));
  results.push(await benchmarkEmailSearch(10000));
  results.push(await benchmarkEmailDeduplication(10000));

  // Print results
  console.log('\n📊 Results:');
  results.forEach(r => console.log('\n' + formatBenchmarkResult(r)));

  // Assert requirements
  console.log('\n✅ Performance Requirements:');
  const filter10k = results.find(r => r.name.includes('Filter 10,000'))!;
  const sort10k = results.find(r => r.name.includes('Sort 10,000'))!;
  const search10k = results.find(r => r.name.includes('Search 10,000'))!;

  console.log(assertPerformance(filter10k, { maxAvgMs: 5 }).message);
  console.log(assertPerformance(sort10k, { maxAvgMs: 20 }).message);
  console.log(assertPerformance(search10k, { maxAvgMs: 10 }).message);

  return results;
}
