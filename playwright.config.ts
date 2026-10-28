import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real storefront in Chromium against a local mock of
 * LaunchDarkly's client-side endpoints (tests/mock-launchdarkly/server.mjs).
 * The real LaunchDarkly React SDK runs unmodified; only its endpoints change,
 * the same way a customer would point it at a Relay Proxy.
 *
 * Two targets:
 *   dev         Vite dev server with React StrictMode (catches effect and cleanup bugs)
 *   production  An optimized production build served by vite preview
 */
const MOCK_LD = 'http://localhost:8787';
const appEnv = {
  VITE_LD_CLIENT_SIDE_ID: 'e2e-client-side-id',
  VITE_LD_BASE_URI: MOCK_LD,
  VITE_LD_STREAM_URI: MOCK_LD,
  VITE_LD_EVENTS_URI: MOCK_LD,
};

export default defineConfig({
  testDir: 'tests/e2e',
  // Tests share one mock LaunchDarkly, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'dev',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5180' },
    },
    {
      name: 'production',
      // The full suite runs against dev; the production build runs the release-critical paths.
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5181' },
    },
  ],
  webServer: [
    {
      command: 'node tests/mock-launchdarkly/server.mjs 8787',
      url: `${MOCK_LD}/__mock/state`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 5180 --strictPort',
      cwd: 'web',
      url: 'http://localhost:5180',
      env: appEnv,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 5181 --strictPort',
      cwd: 'web',
      url: 'http://localhost:5181',
      env: appEnv,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
