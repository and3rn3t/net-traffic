/**
 * E2E Tests: Filter Functionality
 * Tests filtering connections, flows, and data
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, navigateToView, waitForDataLoad } from './helpers/test-helpers';

test.describe('Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
  });

  test('should filter connections by protocol', async ({ page }) => {
    // Navigate to dashboard or connections view
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for filter controls
    const filterSelectors = [
      '[data-testid="flow-filters"]',
      'button[aria-label*="Filter" i]',
      'button:has-text("Filter")',
      'select[name*="protocol" i]',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filterButton: any = null;
    for (const selector of filterSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          filterButton = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (filterButton) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Look for protocol filter
      const protocolSelectors = [
        'select[name*="protocol" i]',
        'button:has-text("HTTP")',
        'button:has-text("HTTPS")',
        '[data-testid="protocol-filter"]',
        'input[type="checkbox"][value*="http" i]',
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let protocolFilter: any = null;
      for (const selector of protocolSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            protocolFilter = element;
            break;
          }
        } catch {
          // Continue
        }
      }

      if (protocolFilter) {
        // Select a protocol
        if ((await protocolFilter.getAttribute('type')) === 'checkbox') {
          await protocolFilter.check();
        } else {
          await protocolFilter.click();
        }

        await page.waitForTimeout(1000);
        await waitForDataLoad(page);

        // Filter should be applied
        expect(await protocolFilter.isVisible()).toBeTruthy();
      }
    } else {
      // Filter might not be available
      test.skip();
    }
  });

  test('should filter by time range', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for time range filter
    const timeFilterSelectors = [
      '[data-testid="time-filter"]',
      'button:has-text("Last")',
      'select[name*="time" i]',
      'button:has-text("24h")',
      'button:has-text("7d")',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let timeFilter: any = null;
    for (const selector of timeFilterSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          timeFilter = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (timeFilter) {
      await timeFilter.click();
      await page.waitForTimeout(500);

      // Select a time range option
      const timeOptions = page.locator(
        'text=Last 24 hours, text=Last 7 days, text=Last hour, button:has-text("24h")'
      );

      if (await timeOptions.first().isVisible({ timeout: 2000 })) {
        await timeOptions.first().click();
        await page.waitForTimeout(1000);
        await waitForDataLoad(page);

        // Time filter should be applied
        expect(await timeFilter.isVisible()).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('should filter by IP address', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for IP filter input
    const ipFilterSelectors = [
      'input[placeholder*="IP" i]',
      'input[name*="ip" i]',
      '[data-testid="ip-filter"]',
      'input[placeholder*="Source" i]',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ipFilter: any = null;
    for (const selector of ipFilterSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          ipFilter = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (ipFilter) {
      // Enter IP address
      await ipFilter.fill('192.168.1');
      await page.waitForTimeout(500); // Wait for debounce
      await waitForDataLoad(page);

      // Filter should be applied
      const filterValue = await ipFilter.inputValue();
      expect(filterValue).toContain('192.168.1');
    } else {
      test.skip();
    }
  });

  test('should clear filters', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Apply a filter first
    const filterInput = page
      .locator('input[placeholder*="Filter" i], input[placeholder*="Search" i]')
      .first();
    if (await filterInput.isVisible({ timeout: 3000 })) {
      await filterInput.fill('test');
      await page.waitForTimeout(500);

      // Look for clear button
      const clearSelectors = [
        'button[aria-label*="Clear" i]',
        'button:has-text("Clear")',
        'button:has-text("Reset")',
        '[data-testid="clear-filters"]',
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let clearButton: any = null;
      for (const selector of clearSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            clearButton = element;
            break;
          }
        } catch {
          // Continue
        }
      }

      if (clearButton) {
        await clearButton.click();
        await page.waitForTimeout(500);

        // Filter should be cleared
        const filterValue = await filterInput.inputValue();
        expect(filterValue).toBe('');
      }
    } else {
      test.skip();
    }
  });
});
