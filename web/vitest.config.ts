import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit and component tests. End-to-end browser tests live in /tests/e2e (Playwright).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
