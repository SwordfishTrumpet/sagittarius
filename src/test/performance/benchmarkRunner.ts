/**
 * Performance Benchmark Runner
 * 
 * Provides utilities for measuring performance of critical operations
 * in the Sagittarius email client, especially for large mailboxes (10K+ emails).
 */

export interface BenchmarkResult {
  name: string;
  durationMs: number;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  medianMs: number;
  opsPerSecond: number;
  memoryDeltaMB?: number;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmupIterations?: number;
  measureMemory?: boolean;
  timeoutMs?: number;
}

export interface BenchmarkContext {
  start: () => void;
  end: () => number;
  measure: <T>(fn: () => T) => { result: T; durationMs: number };
}

const DEFAULT_OPTIONS: Required<BenchmarkOptions> = {
  iterations: 100,
  warmupIterations: 10,
  measureMemory: false,
  timeoutMs: 30000,
};

/**
 * Create a benchmark context for manual timing
 */
function createBenchmarkContext(): BenchmarkContext {
  let startTime = 0;

  return {
    start: () => {
      startTime = performance.now();
    },
    end: () => performance.now() - startTime,
    measure: <T>(fn: () => T): { result: T; durationMs: number } => {
      const start = performance.now();
      const result = fn();
      const durationMs = performance.now() - start;
      return { result, durationMs };
    },
  };
}

/**
 * Run a benchmark and collect detailed statistics
 */
export async function runBenchmark(
  name: string,
  fn: (ctx: BenchmarkContext, iteration: number) => void | Promise<void>,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const durations: number[] = [];
  const ctx = createBenchmarkContext();

  // Warmup phase
  for (let i = 0; i < opts.warmupIterations; i++) {
    await fn(ctx, i);
  }

  // Memory baseline
  const memoryBefore = opts.measureMemory && 'memory' in performance
    ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
    : undefined;

  // Benchmark phase
  for (let i = 0; i < opts.iterations; i++) {
    const start = performance.now();
    await fn(ctx, i);
    const duration = performance.now() - start;
    durations.push(duration);
  }

  // Memory after
  const memoryAfter = opts.measureMemory && 'memory' in performance
    ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize
    : undefined;

  // Calculate statistics
  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((a, b) => a + b, 0);
  const minMs = sorted[0];
  const maxMs = sorted[sorted.length - 1];
  const medianMs = sorted[Math.floor(sorted.length / 2)];

  return {
    name,
    durationMs: total,
    iterations: opts.iterations,
    avgMs: total / opts.iterations,
    minMs,
    maxMs,
    medianMs,
    opsPerSecond: 1000 / (total / opts.iterations),
    memoryDeltaMB: memoryBefore !== undefined && memoryAfter !== undefined
      ? (memoryAfter - memoryBefore) / 1024 / 1024
      : undefined,
  };
}

/**
 * Compare multiple implementations
 */
export async function compareBenchmarks(
  benchmarks: { name: string; fn: (ctx: BenchmarkContext) => void | Promise<void> }[],
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const { name, fn } of benchmarks) {
    const result = await runBenchmark(name, fn, options);
    results.push(result);
  }

  return results;
}

/**
 * Format benchmark results for console output
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  const lines = [
    `📊 ${result.name}`,
    `  Duration: ${result.durationMs.toFixed(2)}ms (${result.iterations} iterations)`,
    `  Average: ${result.avgMs.toFixed(3)}ms`,
    `  Median: ${result.medianMs.toFixed(3)}ms`,
    `  Min/Max: ${result.minMs.toFixed(3)}ms / ${result.maxMs.toFixed(3)}ms`,
    `  Ops/sec: ${result.opsPerSecond.toFixed(1)}`,
  ];

  if (result.memoryDeltaMB !== undefined) {
    lines.push(`  Memory Δ: ${result.memoryDeltaMB > 0 ? '+' : ''}${result.memoryDeltaMB.toFixed(2)}MB`);
  }

  return lines.join('\n');
}

/**
 * Format comparison results
 */
export function formatComparison(results: BenchmarkResult[]): string {
  const fastest = results.reduce((a, b) => (a.avgMs < b.avgMs ? a : b));

  const lines = [
    '🏆 Benchmark Comparison',
    '─'.repeat(60),
    ...results.map((r) => {
      const ratio = r.avgMs / fastest.avgMs;
      const indicator = r === fastest ? '✅' : ratio < 2 ? '⚡' : '⏱️';
      return `${indicator} ${r.name.padEnd(30)} ${r.avgMs.toFixed(3).padStart(8)}ms (${ratio.toFixed(2)}x)`;
    }),
    '─'.repeat(60),
    `Winner: ${fastest.name} (${fastest.avgMs.toFixed(3)}ms avg)`,
  ];

  return lines.join('\n');
}

/**
 * Assert performance requirements
 */
export function assertPerformance(
  result: BenchmarkResult,
  requirements: { maxAvgMs?: number; minOpsPerSecond?: number }
): { passed: boolean; message: string } {
  const failures: string[] = [];

  if (requirements.maxAvgMs !== undefined && result.avgMs > requirements.maxAvgMs) {
    failures.push(`Average time ${result.avgMs.toFixed(3)}ms exceeds ${requirements.maxAvgMs}ms`);
  }

  if (requirements.minOpsPerSecond !== undefined && result.opsPerSecond < requirements.minOpsPerSecond) {
    failures.push(`Ops/sec ${result.opsPerSecond.toFixed(1)} below ${requirements.minOpsPerSecond}`);
  }

  if (failures.length === 0) {
    return { passed: true, message: `✅ ${result.name} meets all performance requirements` };
  }

  return { passed: false, message: `❌ ${result.name} failed:\n  ${failures.join('\n  ')}` };
}
