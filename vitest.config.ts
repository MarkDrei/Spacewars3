import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const baseInclude = ['src/**/*.test.ts', 'src/**/*.test.tsx']
const baseExclude: string[] = []
const jsdomInclude = [
  'src/__tests__/components/**/*.test.ts',
  'src/__tests__/components/**/*.test.tsx',
  'src/__tests__/hooks/**/*.test.ts',
  'src/__tests__/hooks/**/*.test.tsx',
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
          exclude: [...baseExclude, 'src/__tests__/components/**', 'src/__tests__/hooks/**'],
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
      // Use 'db' as default for dev container, 'localhost' for local development
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'db',
      POSTGRES_PORT: process.env.POSTGRES_PORT || '5432',
      POSTGRES_DB: process.env.POSTGRES_TEST_DB || 'spacewars_test',
      POSTGRES_USER: process.env.POSTGRES_USER || 'spacewars',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'spacewars',
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
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './src/shared/src'),
    },
  },
})
