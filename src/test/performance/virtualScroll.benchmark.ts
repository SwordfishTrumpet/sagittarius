/**
 * Virtual Scroll Performance Benchmarks
 * 
 * Tests performance of virtual scrolling operations for large email lists.
 */

import { runBenchmark, formatBenchmarkResult, assertPerformance, type BenchmarkResult } from './benchmarkRunner';
import { generateTestEmails } from './emailList.benchmark';
import type { Email } from '../../types/jmap';

/**
 * Simulated virtual list item renderer
 */
function renderItem(item: Email): string {
  return `
    <div class="email-item" data-id="${item.id}">
      <span class="subject">${item.subject}</span>
      <span class="from">${item.from?.[0]?.email || 'Unknown'}</span>
    </div>
  `;
}

/**
 * Benchmark: Virtual list window calculation
 */
export async function benchmarkWindowCalculation(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const itemHeight = 64; // px
  const viewportHeight = 600; // px
  const scrollTop = 5000; // px

  return runBenchmark(
    `Virtual list window calc (${emailCount.toLocaleString()} items)`,
    () => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2; // +2 for buffer
      const endIndex = Math.min(startIndex + visibleCount, emails.length);
      const visibleItems = emails.slice(startIndex, endIndex);
      const totalHeight = emails.length * itemHeight;
      const offsetY = startIndex * itemHeight;

      return void { visibleItems, totalHeight, offsetY, startIndex, endIndex };
    },
    { iterations: 1000 }
  );
}

/**
 * Benchmark: Large dataset slicing
 */
export async function benchmarkDatasetSlicing(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const windowSize = 50;

  return runBenchmark(
    `Slice ${emailCount.toLocaleString()} emails (window: ${windowSize})`,
    (ctx, iteration) => {
      const startIndex = (iteration * 10) % (emailCount - windowSize);
      const window = emails.slice(startIndex, startIndex + windowSize);
      return void window;
    },
    { iterations: 200 }
  );
}

/**
 * Benchmark: Item height estimation
 */
export async function benchmarkHeightEstimation(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);

  return runBenchmark(
    `Dynamic height calc (${emailCount.toLocaleString()} items)`,
    () => {
      const heights = emails.map((email, i) => {
        // Simulate dynamic height based on content
        const baseHeight = 64;
        const hasAttachment = email.hasAttachment ? 20 : 0;
        const longSubject = (email.subject?.length || 0) > 50 ? 16 : 0;
        return baseHeight + hasAttachment + longSubject;
      });
      const totalHeight = heights.reduce((a, b) => a + b, 0);
      return void totalHeight;
    },
    { iterations: 100 }
  );
}

/**
 * Benchmark: Scroll position to item index mapping
 */
export async function benchmarkScrollMapping(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const cumulativeHeights: number[] = [];
  let total = 0;

  // Pre-calculate cumulative heights (simulating measured items)
  for (let i = 0; i < emails.length; i++) {
    total += 64; // base height
    cumulativeHeights.push(total);
  }

  return runBenchmark(
    `Scroll position mapping (${emailCount.toLocaleString()} items)`,
    (ctx, iteration) => {
      const scrollTop = (iteration * 100) % total;
      // Binary search for index
      let low = 0;
      let high = cumulativeHeights.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (cumulativeHeights[mid] < scrollTop) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return void low;
    },
    { iterations: 500 }
  );
}

/**
 * Benchmark: Overscan calculation
 */
export async function benchmarkOverscanCalculation(emailCount = 10000): Promise<BenchmarkResult> {
  const emails = generateTestEmails(emailCount);
  const viewportHeight = 600;
  const itemHeight = 64;
  const overscan = 5;

  return runBenchmark(
    `Overscan calc (${emailCount.toLocaleString()} items, overscan: ${overscan})`,
    (ctx, iteration) => {
      const scrollTop = (iteration * 100) % (emails.length * itemHeight);
      const visibleStart = Math.floor(scrollTop / itemHeight);
      const visibleCount = Math.ceil(viewportHeight / itemHeight);

      const startIndex = Math.max(0, visibleStart - overscan);
      const endIndex = Math.min(emails.length, visibleStart + visibleCount + overscan);
      const overscanWindow = emails.slice(startIndex, endIndex);

      return void overscanWindow;
    },
    { iterations: 200 }
  );
}

/**
 * Run all virtual scroll benchmarks
 */
export async function runVirtualScrollBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('\n📜 Virtual Scroll Performance Benchmarks');
  console.log('═'.repeat(60));

  // 10K items
  console.log('\n📦 Testing with 10,000 items:');
  results.push(await benchmarkWindowCalculation(10000));
  results.push(await benchmarkDatasetSlicing(10000));
  results.push(await benchmarkHeightEstimation(10000));
  results.push(await benchmarkScrollMapping(10000));
  results.push(await benchmarkOverscanCalculation(10000));

  // Print results
  console.log('\n📊 Results:');
  results.forEach(r => console.log('\n' + formatBenchmarkResult(r)));

  // Assert requirements
  console.log('\n✅ Performance Requirements:');
  const windowCalc = results.find(r => r.name.includes('window calc'))!;
  const slicing = results.find(r => r.name.includes('Slice'))!;

  console.log(assertPerformance(windowCalc, { maxAvgMs: 0.1 }).message);
  console.log(assertPerformance(slicing, { maxAvgMs: 1 }).message);

  return results;
}
