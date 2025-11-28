/**
 * E2E Test Helper Functions
 * Shared utilities for E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for the application to be ready
 */
export async function waitForAppReady(page: Page) {
  // Wait for the main app container to be visible
  await page.waitForSelector('[data-testid="app"]', { timeout: 10000 }).catch(() => {
    // Fallback: wait for any visible content
    return page.waitForLoadState('networkidle');
  });

  // Wait for initial data to load
  await page.waitForTimeout(1000);
}

/**
 * Navigate to a specific view/tab
 */
export async function navigateToView(
  page: Page,
  viewName: 'dashboard' | 'analytics' | 'devices' | 'threats'
) {
  const viewMap = {
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    devices: 'Devices',
    threats: 'Threats',
  };

  await page.click(`text=${viewMap[viewName]}`);
  await page.waitForTimeout(500); // Wait for view to switch
}

/**
 * Wait for API data to load (check for loading indicator to disappear)
 */
export async function waitForDataLoad(page: Page) {
  // Wait for loading indicators to disappear
  const loadingSelectors = ['[data-testid="loading"]', 'text=Loading...', '[aria-busy="true"]'];

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
    } catch {
      // Selector not found or already hidden, continue
    }
  }

  // Wait a bit more for data to render
  await page.waitForTimeout(500);
}

/**
 * Check if element is visible and has content
 */
export async function expectVisibleWithContent(page: Page, selector: string, minLength = 1) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  const text = await element.textContent();
  expect(text?.length).toBeGreaterThanOrEqual(minLength);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, text?: string, timeout = 5000) {
  const toastSelector = text ? `[role="status"]:has-text("${text}")` : '[role="status"]';

  await page.waitForSelector(toastSelector, { timeout });
}

/**
 * Mock API responses for testing
 */
export async function mockApiResponse(page: Page, url: string, response: any) {
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Check connection status indicator
 */
export async function checkConnectionStatus(
  page: Page,
  expectedStatus: 'connected' | 'disconnected'
) {
  const statusIndicator = page.locator('[data-testid="connection-status"]');
  await expect(statusIndicator).toBeVisible();

  if (expectedStatus === 'connected') {
    await expect(statusIndicator).toHaveClass(/connected|active|online/i);
  } else {
    await expect(statusIndicator).toHaveClass(/disconnected|inactive|offline/i);
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
