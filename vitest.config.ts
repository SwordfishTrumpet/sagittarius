import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { cpus } from 'os'

const cpuCount = cpus().length

export default defineConfig({
  plugins: [react()],
  test: {
    // Use multiple threads for parallel execution
    pool: 'threads',
    maxWorkers: Math.min(8, cpuCount),
    // Globals for testing library
    globals: true,
    // Environment setup
    environment: 'jsdom',
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    // Faster teardown - don't wait for hanging handles
    teardownTimeout: 5000,
    // Hook timeout for long-running operations
    hookTimeout: 10000,
    // Test timeout
    testTimeout: 10000,
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

    // Clear mocks between tests automatically
    clearMocks: true,
    // Restore mocks after each test
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})