import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests
 * Optimized for fast parallel execution with worker management
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Expect timeout (for assertions)
  expect: {
    timeout: 5000,
  },

  // Test execution configuration
  fullyParallel: true, // Run all tests in parallel
  forbidOnly: !!process.env.CI, // Fail CI if test.only is used
  retries: process.env.CI ? 2 : 0, // Retry on CI
  workers: process.env.CI ? 4 : '50%', // Use 4 workers on CI for faster execution, 50% of CPUs locally
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []), // GitHub Actions reporter
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the application - dev server always listens on 5001
    // (forced by vite.config.ts's sparkPlugin({ port: 5001 }), regardless of
    // any --port flag), so this must match webServer.url below
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5001',

    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for cross-browser testing (slower but more comprehensive)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npx vite',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // Increased timeout to 3 minutes
    stdout: 'pipe', // Changed to see output for debugging
    stderr: 'pipe',
    env: {
      // Force mock/local data mode for e2e runs, overriding the repo's .env
      // (which sets VITE_USE_REAL_API=true for manual `npm run dev` against
      // the real Raspberry Pi backend). Running e2e tests against a real,
      // network-dependent backend keeps a WebSocket connection + polling
      // active, which prevents `networkidle` from ever resolving and causes
      // near-total test failures as soon as more than one worker runs
      // (previously masked by always running with --workers=1). Mock mode
      // matches CI (see .github/workflows/*.yml) and is fast + deterministic.
      // NOTE: this only applies when Playwright spawns the server itself -
      // if a dev server is already running on port 5001 (e.g. from `npm run
      // dev`), reuseExistingServer will reuse it as-is, .env and all.
      VITE_USE_REAL_API: 'false',
    },
  },
  // Optional: Start backend server for E2E tests
  // Uncomment if you want to test against real backend
  // {
  //   command: 'cd backend && python main.py',
  //   url: 'http://localhost:8000/api/health',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   stdout: 'ignore',
  //   stderr: 'pipe',
  // },
});
