import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { cpus } from 'os'

const cpuCount = cpus().length

export default defineConfig({
  plugins: [react()],
  test: {
    // Thread-based parallel execution for speed
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use multiple threads (not single thread)
        singleThread: false,
        // Let Vitest determine optimal thread count based on CPU cores
        maxThreads: Math.min(4, cpuCount),
        minThreads: 2,
        // Isolate tests in each thread for reliability
        isolate: true,
      },
    },
    // Run test files in parallel
    fileParallelism: true,
    // Globals for testing library
    globals: true,
    // Environment setup
    environment: 'jsdom',
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mock*',
      ],
    },
    // Reporters - use dot reporter in CI for less noise
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})