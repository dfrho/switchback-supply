import { defineConfig } from 'vitest/config';

// Unit tests for the assistant's server code (Node environment, no browser).
export default defineConfig({
  test: {
    root: import.meta.dirname,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
