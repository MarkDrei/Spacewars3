import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'client',
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: './setupTests.ts',
    alias: {
      '@spacewars-ironcore/shared': '../shared/src/index.ts'
    }
  }
});
