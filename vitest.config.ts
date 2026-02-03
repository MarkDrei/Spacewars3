import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/server/**'],
    env: {
      NODE_ENV: 'test',
      // Use 'localhost' as default, can be overridden with POSTGRES_HOST env var
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
      POSTGRES_PORT: process.env.POSTGRES_PORT || '5432',
      POSTGRES_DB: process.env.POSTGRES_TEST_DB || 'spacewars_test',
      POSTGRES_USER: process.env.POSTGRES_USER || 'spacewars',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'spacewars',
    },
    // Transaction-based test isolation is implemented but requires refactoring
    // Current issue: Background cache persistence writes happen outside transaction scope
    // causing foreign key violations when transactions rollback
    // 
    // For now, disable file parallelism to ensure sequential execution
    // TODO: Refactor caches to disable background persistence in test mode
    fileParallelism: true,
    // give concrete number of workers or 50% to give half of CPU cores to vitest
    maxWorkers: 16,


    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/**', 'src/__tests__/**', '**/*.d.ts'],
      reportsDirectory: './coverage'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './src/shared/src'),
    },
  },
})
