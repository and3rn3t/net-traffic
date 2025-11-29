/**
 * E2E Test Helper Functions
 * Shared utilities for E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for the application to be ready
 */
export async function waitForAppReady(page: Page) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Wait for any app content to appear (flexible selectors)
  await Promise.race([
    page.waitForSelector('text=NetInsight', { timeout: 10000 }).catch(() => {}),
    page.waitForSelector('h1', { timeout: 10000 }).catch(() => {}),
    page.waitForSelector('.container', { timeout: 10000 }).catch(() => {}),
    page.waitForTimeout(2000), // Max wait
  ]);

  // Wait for initial data to load
  await page.waitForTimeout(1000);
}

/**
 * Navigate to a specific view/tab
 */
export async function navigateToView(
  page: Page,
  viewName:
    | 'dashboard'
    | 'analytics'
    | 'devices'
    | 'threats'
    | 'insights'
    | 'advanced'
    | 'visualizations'
) {
  // Map view names to their tab values and labels
  const viewMap: Record<string, { value: string; label: string }> = {
    dashboard: { value: 'dashboard', label: 'Dashboard' },
    analytics: { value: 'analytics', label: 'Analytics' },
    devices: { value: 'devices', label: 'Devices' },
    threats: { value: 'threats', label: 'Threats' },
    insights: { value: 'insights', label: 'Insights' },
    advanced: { value: 'advanced', label: 'Advanced' },
    visualizations: { value: 'visualizations', label: 'Visualizations' },
  };

  const view = viewMap[viewName];
  if (!view) {
    throw new Error(`Unknown view name: ${viewName}`);
  }

  // Wait for app to fully load first
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Wait for loading indicator to disappear
  try {
    await page.waitForSelector('text=Connecting to backend...', {
      state: 'hidden',
      timeout: 10000,
    });
  } catch {
    // Loading indicator might not exist, that's fine
  }

  // Wait for the main app structure to be visible (header with NetInsight title)
  await Promise.race([
    page.locator('h1:has-text("NetInsight")').first().waitFor({ state: 'visible', timeout: 15000 }),
    page
      .getByText(/NetInsight/i)
      .first()
      .waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {
    // If neither found, just continue - app might be in a different state
  });
  await page.waitForTimeout(1000);

  // Wait for tabs to be rendered - try to find the tabs container first
  let tabsReady = false;
  const tabsSelectors = ['[data-slot="tabs-list"]', '[data-slot="tabs"]', '[role="tablist"]'];

  for (const selector of tabsSelectors) {
    try {
      const tabsContainer = page.locator(selector).first();
      if (await tabsContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
        tabsReady = true;
        break;
      }
    } catch {
      continue;
    }
  }

  // If tabs container not found, wait a bit more and try again
  if (!tabsReady) {
    await page.waitForTimeout(2000);
  }

  // Try multiple strategies to find and click the tab
  let tabElement = null;

  // Strategy 1: Use role="tab" - Radix UI exposes this (most reliable)
  try {
    tabElement = page.getByRole('tab', { name: new RegExp(view.label, 'i') });
    await tabElement.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    // Strategy 2: Find by data-slot and value attribute
    try {
      tabElement = page.locator(`[data-slot="tabs-trigger"][value="${view.value}"]`).first();
      await tabElement.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      // Strategy 3: Find button with text within tabs list
      try {
        const tabsList = page.locator('[data-slot="tabs-list"]').first();
        tabElement = tabsList.locator(`button:has-text("${view.label}")`).first();
        await tabElement.waitFor({ state: 'visible', timeout: 10000 });
      } catch {
        // Strategy 4: Find any button with the text
        tabElement = page.locator(`button:has-text("${view.label}")`).first();
        await tabElement.waitFor({ state: 'visible', timeout: 10000 });
      }
    }
  }

  // Click the found tab
  if (tabElement) {
    await tabElement.scrollIntoViewIfNeeded();
    await tabElement.click({ timeout: 10000 });
    // Wait for tab content to switch and tab to become active
    await page.waitForTimeout(500);

    // Verify the tab became active
    try {
      const activeTab = page.getByRole('tab', { name: new RegExp(view.label, 'i') });
      await activeTab.waitFor({ state: 'visible', timeout: 5000 });
      // Wait for data-state="active" attribute
      let attempts = 0;
      while (attempts < 10) {
        const dataState = await activeTab.getAttribute('data-state');
        if (dataState === 'active') {
          break;
        }
        await page.waitForTimeout(200);
        attempts++;
      }
    } catch {
      // Tab might already be active or attribute might not be set yet, continue
    }
  } else {
    throw new Error(`Could not find tab for view: ${view.label}. Tabs may not be rendered yet.`);
  }
}

/**
 * Wait for API data to load (check for loading indicator to disappear)
 */
export async function waitForDataLoad(page: Page) {
  // Wait for loading indicators to disappear
  const loadingSelectors = [
    '[data-testid="loading"]',
    'text=Loading...',
    '[aria-busy="true"]',
    'text=Connecting to backend...',
  ];

  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
    } catch {
      // Selector not found or already hidden, continue
    }
  }

  // Wait for network to be idle (indicates data has loaded)
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // If network never becomes idle, just continue
  }

  // Wait a bit more for React to render data
  await page.waitForTimeout(1000);
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
export async function mockApiResponse(page: Page, url: string, response: unknown) {
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
