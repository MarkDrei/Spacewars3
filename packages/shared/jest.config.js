/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // Configure ts-jest for CommonJS output in tests
      tsconfig: {
        module: 'commonjs',
        target: 'es2020'
      }
    }]
  },
  // Use the custom resolver to handle .js extensions in source files
  resolver: '<rootDir>/../../jest-resolver.cjs',
  displayName: 'shared'
};
