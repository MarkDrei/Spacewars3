import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const baseInclude = ['src/**/*.test.ts', 'src/**/*.test.tsx']
const baseExclude: string[] = []
const jsdomInclude = [
  'src/__tests__/components/**/*.test.ts',
  'src/__tests__/components/**/*.test.tsx',
  'src/__tests__/hooks/**/*.test.ts',
  'src/__tests__/hooks/**/*.test.tsx',
  'src/__tests__/ui/**/*.test.ts',
  'src/__tests__/ui/**/*.test.tsx',
]

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: baseInclude,
          exclude: [...baseExclude, 'src/__tests__/components/**', 'src/__tests__/hooks/**', 'src/__tests__/ui/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: jsdomInclude,
          exclude: baseExclude,
        },
      },
    ],
    setupFiles: ['./src/__tests__/setup.ts'],
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
