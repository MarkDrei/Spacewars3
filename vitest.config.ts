import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/__tests__/unit/**/*.test.ts',
            'src/__tests__/unit/**/*.test.tsx',
          ],
          exclude: [],
          // No per-file isolation: external packages stay loaded across files (≈4x faster).
          // setup.unit.ts resets project modules per file so vi.mock() and singletons stay per file.
          isolate: false,
          setupFiles: ['./src/__tests__/setup.unit.ts'], // No database setup for unit tests
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'src/__tests__/integration/**/*.test.ts',
            'src/__tests__/integration/**/*.test.tsx',
          ],
          exclude: [],
          // No per-file isolation: modules and the pg pool are shared across files (≈3x faster).
          // Requires every DB write to run inside withTransaction() and singletons to be reset by
          // initializeIntegrationTestServer()/shutdownIntegrationTestServer().
          isolate: false,
          setupFiles: ['./src/__tests__/setup.ts'], // Database setup for integration tests
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: [
            'src/__tests__/ui/**/*.test.ts',
            'src/__tests__/ui/**/*.test.tsx',
          ],
          exclude: [],
          setupFiles: ['./src/__tests__/setup.ui.ts'], // jest-dom matchers for UI tests, no database
        },
      },
    ],
    include: [],
    exclude: [],
    env: {
      NODE_ENV: 'test',
      // DB connection for tests.
      // Each environment sets POSTGRES_TEST_* env vars explicitly:
      //   - devcontainer/Codespace: set in .devcontainer/docker-compose.yml (host=db)
      //   - GitHub Actions:         set in .github/workflows/test.yml (host=localhost)
      //   - local (npm run test:local): docker compose starts db on localhost:5432
      // Fallback chain: POSTGRES_TEST_HOST > POSTGRES_HOST > localhost
      POSTGRES_HOST: process.env.POSTGRES_TEST_HOST || process.env.POSTGRES_HOST || 'localhost',
      POSTGRES_PORT: process.env.POSTGRES_TEST_PORT || process.env.POSTGRES_PORT || '5432',
      POSTGRES_DB: process.env.POSTGRES_TEST_DB || 'spacewars_test',
      POSTGRES_USER: process.env.POSTGRES_TEST_USER || process.env.POSTGRES_USER || 'spacewars',
      POSTGRES_PASSWORD: process.env.POSTGRES_TEST_PASSWORD || process.env.POSTGRES_PASSWORD || 'spacewars',
    },

    // parellelism settings
    fileParallelism: true,
    // give concrete number of workers or '50%' to give half of CPU cores to vitest
    maxWorkers: '300%',

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/**', 'src/__tests__/**', '**/*.d.ts'],
      reportsDirectory: './coverage'
    },

    // Mock CSS and other static assets
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
  // Inline PostCSS config so Vite does not load postcss.config.mjs (string plugin form for Next.js).
  // Tests do not assert on generated CSS, so no PostCSS plugins are needed.
  css: {
    postcss: {},
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '@shared': resolve(import.meta.dirname, './src/shared/src'),
    },
  },
})
