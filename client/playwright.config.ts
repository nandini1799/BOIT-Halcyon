import { defineConfig, devices } from '@playwright/test';

const CLIENT = 'http://localhost:5173';

/**
 * The suite runs against Google Chrome rather than Playwright's bundled
 * Chromium, whose download is blocked on this machine. Chrome is the same
 * engine; if CI has the bundled browser, drop the channel.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: CLIENT,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @halcyon/server dev',
      url: 'http://localhost:4000/api/health',
      cwd: '..',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev',
      url: CLIENT,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
