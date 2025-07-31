import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        root: 'packages/client',
        test: { environment: 'jsdom', setupFiles: './setupTests.ts', }
      },
      {
        root: 'packages/server',
      },
      {
        root: 'packages/shared',
      }
    ]
  }
});
