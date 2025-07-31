import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
plugins: [tsconfigPaths()],
  test: {
    name: 'server',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  }
});
