/**
 * JMAP Query Performance Benchmarks
 * 
 * Tests performance of JMAP data transformation and query building operations.
 */

import { runBenchmark, formatBenchmarkResult, assertPerformance, type BenchmarkResult } from './benchmarkRunner';
import type { Email, Thread, Mailbox, EmailFilter } from '../../types/jmap';
import { generateTestEmails } from './emailList.benchmark';

/**
 * Generate test threads from emails
 */
function generateTestThreads(emails: Email[]): Thread[] {
  const threadMap = new Map<string, string[]>();

  for (const email of emails) {
    const ids = threadMap.get(email.threadId) || [];
    ids.push(email.id);
    threadMap.set(email.threadId, ids);
  }

  return Array.from(threadMap.entries()).map(([id, emailIds]) => ({
    id,
    emailIds,
  }));
}

/**
 * Generate test mailboxes
 */
function generateTestMailboxes(count: number): Mailbox[] {
  const roles: Array<Mailbox['role']> = ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam', null];

  return Array.from({ length: count }, (_, i) => ({
    id: `mailbox-${i}`,
    name: `Mailbox ${i}`,
    parentId: i > 0 && i % 3 === 0 ? `mailbox-${Math.floor(i / 3) - 1}` : null,
    role: roles[i % roles.length],
    sortOrder: i,
    totalEmails: Math.floor(Math.random() * 1000),
    unreadEmails: Math.floor(Math.random() * 100),
    totalThreads: Math.floor(Math.random() * 500),
    unreadThreads: Math.floor(Math.random() * 50),
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true,
    },
    isSubscribed: true,
  }));
}

/**
 * Benchmark: Build JMAP Email/query filter
 */
export async function benchmarkFilterBuilding(iterations = 10000): Promise<BenchmarkResult> {
  const searchTerm = 'test query';
  const mailboxId = 'mailbox-123';

  return runBenchmark(
    `Build Email/query filter (${iterations.toLocaleString()} times)`,
    () => {
      const filter: EmailFilter = {
        allOf: [
          { inMailbox: mailboxId },
          {
            anyOf: [
              { from: searchTerm },
              { to: searchTerm },
              { subject: searchTerm },
              { text: searchTerm },
            ],
          },
        ],
      };
      return void filter;
    },
    { iterations }
  );
}

/**
 * Benchmark: Transform JMAP response to app format
 */
export async function benchmarkResponseTransform(emailCount = 10000): Promise<BenchmarkResult> {
  const rawResponse = {
    accountId: 'account-1',
    state: 'state-1',
    list: generateTestEmails(emailCount),
    notFound: [],
  };

  return runBenchmark(
    `Transform JMAP response (${emailCount.toLocaleString()} emails)`,
    () => {
      const transformed = rawResponse.list.map(email => ({
        ...email,
        isUnread: !email.keywords.$seen,
        isFlagged: !!email.keywords.$flagged,
      }));
      return void transformed;
    },
    { iterations: 50 }
  );
}

/**
 * Benchmark: Thread lookup by email ID
 */
export async function benchmarkThreadLookup(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const threads = generateTestThreads(emails);
  const lookupEmailId = emails[Math.floor(emails.length / 2)].id;

  return runBenchmark(
    `Thread lookup by email ID (${emailCount.toLocaleString()} emails)`,
    () => {
      const thread = threads.find(t => t.emailIds.includes(lookupEmailId));
      return void thread;
    },
    { iterations: 1000 }
  );
}

/**
 * Benchmark: Build mailbox hierarchy tree
 */
export async function benchmarkMailboxHierarchy(mailboxCount = 1000): Promise<BenchmarkResult> {
  const mailboxes = generateTestMailboxes(mailboxCount);

  return runBenchmark(
    `Build mailbox hierarchy (${mailboxCount.toLocaleString()} mailboxes)`,
    () => {
      const rootMailboxes: Mailbox[] = [];
      const childrenMap = new Map<string, Mailbox[]>();

      // Group children by parent
      for (const mb of mailboxes) {
        if (mb.parentId) {
          const siblings = childrenMap.get(mb.parentId) || [];
          siblings.push(mb);
          childrenMap.set(mb.parentId, siblings);
        } else {
          rootMailboxes.push(mb);
        }
      }

      // Build tree recursively
      function buildTree(mailbox: Mailbox, depth = 0): unknown {
        const children = childrenMap.get(mailbox.id) || [];
        return {
          ...mailbox,
          depth,
          children: children.map(c => buildTree(c, depth + 1)),
        };
      }

      const tree = rootMailboxes.map(mb => buildTree(mb));
      return void tree;
    },
    { iterations: 100 }
  );
}

/**
 * Benchmark: Query key generation (for TanStack Query)
 */
export async function benchmarkQueryKeyGeneration(iterations = 50000): Promise<BenchmarkResult> {
  const accountId = 'account-1';
  const mailboxId = 'mailbox-123';
  const filter = { hasKeyword: '$flagged' };

  return runBenchmark(
    `Generate query keys (${iterations.toLocaleString()} times)`,
    () => {
      const key = ['emails', accountId, mailboxId, JSON.stringify(filter)];
      return void key;
    },
    { iterations }
  );
}

/**
 * Benchmark: Batch ID chunking (for JMAP /get requests)
 */
export async function benchmarkIdChunking(idCount = 50000, chunkSize = 500): Promise<BenchmarkResult> {
  const ids = Array.from({ length: idCount }, (_, i) => `email-${i}`);

  return runBenchmark(
    `Chunk ${idCount.toLocaleString()} IDs (chunk size: ${chunkSize})`,
    () => {
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      return void chunks;
    },
    { iterations: 100 }
  );
}

/**
 * Benchmark: Email deduplication for incremental sync
 */
export async function benchmarkIncrementalSyncMerge(existingCount = 10000, newCount = 100): Promise<BenchmarkResult> {
  const existing = generateTestEmails(existingCount);
  const newEmails = generateTestEmails(newCount).map((e, i) => ({
    ...e,
    id: `new-email-${i}`,
  }));

  return runBenchmark(
    `Merge sync results (${existingCount.toLocaleString()} existing + ${newCount} new)`,
    () => {
      const existingMap = new Map(existing.map(e => [e.id, e]));

      // Add/update from new results
      for (const email of newEmails) {
        existingMap.set(email.id, email);
      }

      const merged = Array.from(existingMap.values());
      // Sort by date
      merged.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

      return void merged;
    },
    { iterations: 50 }
  );
}

/**
 * Run all JMAP query benchmarks
 */
export async function runJMAPQueryBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('\n🌐 JMAP Query Performance Benchmarks');
  console.log('═'.repeat(60));

  results.push(await benchmarkFilterBuilding(10000));
  results.push(await benchmarkResponseTransform(10000));
  results.push(await benchmarkThreadLookup(10000));
  results.push(await benchmarkMailboxHierarchy(1000));
  results.push(await benchmarkQueryKeyGeneration(50000));
  results.push(await benchmarkIdChunking(50000, 500));
  results.push(await benchmarkIncrementalSyncMerge(10000, 100));

  // Print results
  console.log('\n📊 Results:');
  results.forEach(r => console.log('\n' + formatBenchmarkResult(r)));

  // Assert requirements
  console.log('\n✅ Performance Requirements:');
  const filterBuild = results.find(r => r.name.includes('Build Email'))!;
  const queryKeyGen = results.find(r => r.name.includes('Generate query'))!;
  const idChunking = results.find(r => r.name.includes('Chunk'))!;

  console.log(assertPerformance(filterBuild, { minOpsPerSecond: 100000 }).message);
  console.log(assertPerformance(queryKeyGen, { minOpsPerSecond: 500000 }).message);
  console.log(assertPerformance(idChunking, { maxAvgMs: 5 }).message);

  return results;
}
