/** @type {import('jest').Config} */
export default {
  projects: [
    '<rootDir>/packages/client/jest.config.js',
    '<rootDir>/packages/server/jest.config.js',
    '<rootDir>/packages/shared/jest.config.js'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.{ts,tsx}'
  ],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  verbose: true
};