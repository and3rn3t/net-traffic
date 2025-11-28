/**
 * E2E Test Fixtures
 * Custom fixtures for Playwright tests
 */

import { test as base } from '@playwright/test';

/**
 * Extended test context with custom fixtures
 */
export const test = base.extend({
  // Add custom fixtures here if needed
  // Example:
  // authenticatedPage: async ({ page }, use) => {
  //   // Setup authenticated session
  //   await use(page);
  // },
});

export { expect } from '@playwright/test';
