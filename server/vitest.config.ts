import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./vitest.globalSetup.ts'],
    // The timeout test deliberately waits for the database to cancel a query.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
