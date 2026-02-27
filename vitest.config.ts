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
          setupFiles: [], // No database setup for unit tests
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
            'src/__tests__/api/**/*.test.ts',
            'src/__tests__/cache/**/*.test.ts',
            'src/__tests__/balance/**/*.test.ts',
            'src/__tests__/admin/**/*.test.ts',
            'src/__tests__/lib/**/*.test.ts',
            'src/__tests__/helpers/**/*.test.ts',
            'src/__tests__/renderers/**/*.test.ts',
            'src/__tests__/services/**/*.test.ts',
            'src/__tests__/shared/**/*.test.ts',
          ],
          exclude: [],
          setupFiles: ['./src/__tests__/setup.ts'], // Database setup for integration tests
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: [
            'src/__tests__/ui/**/*.test.ts',
            'src/__tests__/ui/**/*.test.tsx',
            'src/__tests__/components/**/*.test.ts',
            'src/__tests__/components/**/*.test.tsx',
            'src/__tests__/hooks/**/*.test.ts',
            'src/__tests__/hooks/**/*.test.tsx',
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
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './src/shared/src'),
    },
  },
})
