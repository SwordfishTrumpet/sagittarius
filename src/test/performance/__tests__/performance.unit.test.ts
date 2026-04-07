/**
 * Performance Benchmark Unit Tests
 * 
 * Tests the benchmark utilities themselves to ensure they work correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runBenchmark,
  compareBenchmarks,
  formatBenchmarkResult,
  formatComparison,
  assertPerformance,
  type BenchmarkResult,
} from '../benchmarkRunner';

describe('benchmarkRunner', () => {
  describe('runBenchmark', () => {
    it('runs a simple benchmark and returns valid results', async () => {
      const result = await runBenchmark(
        'Test benchmark',
        () => {
          // Simple operation
          const arr = [1, 2, 3, 4, 5];
          return void arr.reduce((a, b) => a + b, 0);
        },
        { iterations: 10, warmupIterations: 2 }
      );

      expect(result.name).toBe('Test benchmark');
      expect(result.iterations).toBe(10);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.avgMs).toBeGreaterThan(0);
      expect(result.minMs).toBeGreaterThanOrEqual(0);
      expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
      expect(result.opsPerSecond).toBeGreaterThan(0);
    });

    it('supports async benchmark functions', async () => {
      const result = await runBenchmark(
        'Async benchmark',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        },
        { iterations: 5 }
      );

      expect(result.name).toBe('Async benchmark');
      expect(result.iterations).toBe(5);
      expect(result.avgMs).toBeGreaterThan(0);
    });

    it('provides benchmark context with timing utilities', async () => {
      let manualTiming = 0;

      const result = await runBenchmark(
        'Manual timing benchmark',
        (ctx) => {
          ctx.start();
          // Small delay
          for (let i = 0; i < 1000; i++) {
            Math.random();
          }
          manualTiming = ctx.end();
        },
        { iterations: 5 }
      );

      expect(result.durationMs).toBeGreaterThan(0);
      expect(manualTiming).toBeGreaterThan(0);
    });

    it('provides measure utility in context', async () => {
      let measuredDuration = 0;

      await runBenchmark(
        'Measure utility benchmark',
        (ctx) => {
          const { result, durationMs } = ctx.measure(() => {
            return [1, 2, 3].map(x => x * 2);
          });
          measuredDuration = durationMs;
          expect(result).toEqual([2, 4, 6]);
        },
        { iterations: 5 }
      );

      expect(measuredDuration).toBeGreaterThan(0);
    });

    it('passes iteration number to benchmark function', async () => {
      const iterations: number[] = [];

      await runBenchmark(
        'Iteration tracking',
        (_ctx, iteration) => {
          iterations.push(iteration);
        },
        { iterations: 10, warmupIterations: 0 }
      );

      expect(iterations).toHaveLength(10);
      expect(iterations[0]).toBe(0);
      expect(iterations[9]).toBe(9);
    });
  });

  describe('compareBenchmarks', () => {
    it('compares multiple implementations', async () => {
      const results = await compareBenchmarks(
        [
          {
            name: 'Implementation A',
            fn: () => {
              const arr = Array.from({ length: 100 }, (_, i) => i);
              return void arr.filter(x => x % 2 === 0);
            },
          },
          {
            name: 'Implementation B',
            fn: () => {
              const arr = Array.from({ length: 100 }, (_, i) => i);
              const result: number[] = [];
              for (const x of arr) {
                if (x % 2 === 0) result.push(x);
              }
              return void result;
            },
          },
        ],
        { iterations: 20 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Implementation A');
      expect(results[1].name).toBe('Implementation B');
    });
  });

  describe('formatBenchmarkResult', () => {
    it('formats benchmark results nicely', () => {
      const result: BenchmarkResult = {
        name: 'Test Benchmark',
        durationMs: 1234.56,
        iterations: 100,
        avgMs: 12.35,
        minMs: 10.5,
        maxMs: 15.2,
        medianMs: 12.1,
        opsPerSecond: 81.0,
      };

      const formatted = formatBenchmarkResult(result);

      expect(formatted).toContain('Test Benchmark');
      expect(formatted).toContain('Duration: 1234.56ms (100 iterations)');
      expect(formatted).toContain('Average: 12.350ms');
      expect(formatted).toContain('Ops/sec: 81.0');
    });

    it('includes memory delta when available', () => {
      const result: BenchmarkResult = {
        name: 'Memory Test',
        durationMs: 100,
        iterations: 10,
        avgMs: 10,
        minMs: 5,
        maxMs: 15,
        medianMs: 10,
        opsPerSecond: 100,
        memoryDeltaMB: 1.5,
      };

      const formatted = formatBenchmarkResult(result);

      expect(formatted).toContain('Memory Δ: +1.50MB');
    });

    it('shows negative memory delta correctly', () => {
      const result: BenchmarkResult = {
        name: 'Memory Test',
        durationMs: 100,
        iterations: 10,
        avgMs: 10,
        minMs: 5,
        maxMs: 15,
        medianMs: 10,
        opsPerSecond: 100,
        memoryDeltaMB: -0.5,
      };

      const formatted = formatBenchmarkResult(result);

      expect(formatted).toContain('Memory Δ: -0.50MB');
    });
  });

  describe('formatComparison', () => {
    it('formats comparison with winner highlighted', () => {
      const results: BenchmarkResult[] = [
        {
          name: 'Fast',
          durationMs: 50,
          iterations: 10,
          avgMs: 5,
          minMs: 4,
          maxMs: 6,
          medianMs: 5,
          opsPerSecond: 200,
        },
        {
          name: 'Slow',
          durationMs: 200,
          iterations: 10,
          avgMs: 20,
          minMs: 18,
          maxMs: 22,
          medianMs: 20,
          opsPerSecond: 50,
        },
      ];

      const formatted = formatComparison(results);

      expect(formatted).toContain('🏆 Benchmark Comparison');
      expect(formatted).toContain('✅ Fast');
      expect(formatted).toContain('⏱️ Slow');
      expect(formatted).toContain('Winner: Fast');
    });
  });

  describe('assertPerformance', () => {
    it('passes when all requirements are met', () => {
      const result: BenchmarkResult = {
        name: 'Fast Benchmark',
        durationMs: 50,
        iterations: 10,
        avgMs: 5,
        minMs: 4,
        maxMs: 6,
        medianMs: 5,
        opsPerSecond: 200,
      };

      const assertion = assertPerformance(result, {
        maxAvgMs: 10,
        minOpsPerSecond: 100,
      });

      expect(assertion.passed).toBe(true);
      expect(assertion.message).toContain('✅');
      expect(assertion.message).toContain('meets all performance requirements');
    });

    it('fails when average time exceeds limit', () => {
      const result: BenchmarkResult = {
        name: 'Slow Benchmark',
        durationMs: 200,
        iterations: 10,
        avgMs: 20,
        minMs: 18,
        maxMs: 22,
        medianMs: 20,
        opsPerSecond: 50,
      };

      const assertion = assertPerformance(result, {
        maxAvgMs: 10,
      });

      expect(assertion.passed).toBe(false);
      expect(assertion.message).toContain('❌');
      expect(assertion.message).toContain('exceeds 10ms');
    });

    it('fails when ops/sec is below limit', () => {
      const result: BenchmarkResult = {
        name: 'Slow Benchmark',
        durationMs: 200,
        iterations: 10,
        avgMs: 20,
        minMs: 18,
        maxMs: 22,
        medianMs: 20,
        opsPerSecond: 50,
      };

      const assertion = assertPerformance(result, {
        minOpsPerSecond: 100,
      });

      expect(assertion.passed).toBe(false);
      expect(assertion.message).toContain('❌');
      expect(assertion.message).toContain('below 100');
    });

    it('reports multiple failures', () => {
      const result: BenchmarkResult = {
        name: 'Very Slow Benchmark',
        durationMs: 1000,
        iterations: 10,
        avgMs: 100,
        minMs: 90,
        maxMs: 110,
        medianMs: 100,
        opsPerSecond: 10,
      };

      const assertion = assertPerformance(result, {
        maxAvgMs: 50,
        minOpsPerSecond: 50,
      });

      expect(assertion.passed).toBe(false);
      expect(assertion.message).toContain('exceeds 50ms');
      expect(assertion.message).toContain('below 50');
    });
  });
});
