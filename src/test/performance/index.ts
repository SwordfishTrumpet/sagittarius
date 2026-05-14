/**
 * Performance Benchmark Suite
 * 
 * Main entry point for running all performance benchmarks.
 * 
 * Usage:
 *   npm run benchmark
 * 
 * Or programmatically:
 *   import { runAllBenchmarks } from './test/performance';
 *   const results = await runAllBenchmarks();
 */

import { runEmailListBenchmarks } from './emailList.benchmark';
import { runVirtualScrollBenchmarks } from './virtualScroll.benchmark';
import { runJMAPQueryBenchmarks } from './jmapQueries.benchmark';
import type { BenchmarkResult } from './benchmarkRunner';

export interface BenchmarkSuiteResults {
  emailList: BenchmarkResult[];
  virtualScroll: BenchmarkResult[];
  jmapQueries: BenchmarkResult[];
  summary: {
    totalBenchmarks: number;
    passed: number;
    failed: number;
    totalDurationMs: number;
  };
}

/**
 * Run all performance benchmarks
 */
export async function runAllBenchmarks(): Promise<BenchmarkSuiteResults> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Sagittarius Performance Benchmark Suite               ║');
  console.log('║     Testing with large mailboxes (10K+ emails)            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const startTime = performance.now();

  const [emailList, virtualScroll, jmapQueries] = await Promise.all([
    runEmailListBenchmarks(),
    runVirtualScrollBenchmarks(),
    runJMAPQueryBenchmarks(),
  ]);

  const totalDuration = performance.now() - startTime;

  const allResults = [...emailList, ...virtualScroll, ...jmapQueries];
  const totalBenchmarks = allResults.length;

  // Simple pass/fail based on reasonable thresholds
  const passed = allResults.filter(r => r.avgMs < 1000).length;
  const failed = totalBenchmarks - passed;

  const results: BenchmarkSuiteResults = {
    emailList,
    virtualScroll,
    jmapQueries,
    summary: {
      totalBenchmarks,
      passed,
      failed,
      totalDurationMs: totalDuration,
    },
  };

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📈 BENCHMARK SUITE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total benchmarks: ${totalBenchmarks}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Total time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('═'.repeat(60));

  return results;
}

/**
 * Quick benchmark run for CI/CD
 * Runs a subset of benchmarks for quick validation
 */
export async function runQuickBenchmarks(): Promise<BenchmarkSuiteResults> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Sagittarius Quick Benchmark Suite                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const { benchmarkEmailFiltering, benchmarkEmailSorting, benchmarkThreadGrouping } = await import('./emailList.benchmark');
  const { benchmarkWindowCalculation, benchmarkDatasetSlicing } = await import('./virtualScroll.benchmark');
  const { benchmarkFilterBuilding, benchmarkQueryKeyGeneration } = await import('./jmapQueries.benchmark');

  const startTime = performance.now();

  const emailList = await Promise.all([
    benchmarkEmailFiltering(1000),
    benchmarkEmailSorting(1000),
    benchmarkThreadGrouping(1000),
  ]);

  const virtualScroll = await Promise.all([
    benchmarkWindowCalculation(1000),
    benchmarkDatasetSlicing(1000),
  ]);

  const jmapQueries = await Promise.all([
    benchmarkFilterBuilding(1000),
    benchmarkQueryKeyGeneration(1000),
  ]);

  const totalDuration = performance.now() - startTime;
  const allResults = [...emailList, ...virtualScroll, ...jmapQueries];

  return {
    emailList,
    virtualScroll,
    jmapQueries,
    summary: {
      totalBenchmarks: allResults.length,
      passed: allResults.filter(r => r.avgMs < 100).length,
      failed: allResults.filter(r => r.avgMs >= 100).length,
      totalDurationMs: totalDuration,
    },
  };
}

// Auto-run if executed directly
declare const process: { argv: string[]; exit: (code: number) => void } | undefined
if (import.meta.url === `file://${process?.argv?.[1] ?? ''}`) {
  runAllBenchmarks().then((results) => {
    // Exit with error code if any benchmarks failed
    process?.exit?.(results.summary.failed > 0 ? 1 : 0);
  }).catch((error) => {
    console.error('Benchmark suite failed:', error);
    process?.exit?.(1);
  });
}
