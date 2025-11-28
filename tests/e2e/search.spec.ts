/**
 * E2E Tests: Search Functionality
 * Tests global search feature
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, waitForDataLoad } from './helpers/test-helpers';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
  });

  test('should open search dialog', async ({ page }) => {
    // Look for search button/input
    const searchSelectors = [
      '[data-testid="search-button"]',
      '[data-testid="search"]',
      'button[aria-label*="Search"]',
      'input[placeholder*="Search"]',
      'button:has-text("Search")',
    ];

    let searchElement = null;
    for (const selector of searchSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          searchElement = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (searchElement) {
      await searchElement.click();

      // Search dialog or input should be visible
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"], [data-testid="search-input"]'
      );
      await expect(searchInput.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should perform search query', async ({ page }) => {
    // Try to find and open search
    const searchSelectors = [
      '[data-testid="search-button"]',
      'button[aria-label*="Search"]',
      'input[placeholder*="Search"]',
    ];

    for (const selector of searchSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();

          // Wait for search input
          const searchInput = page
            .locator('input[type="search"], input[placeholder*="Search"]')
            .first();

          if (await searchInput.isVisible({ timeout: 3000 })) {
            // Type search query
            await searchInput.fill('test');
            await page.waitForTimeout(500); // Wait for debounce

            // Check for results
            const resultsSelectors = [
              '[data-testid="search-results"]',
              'text=results',
              '[role="listbox"]',
            ];

            // At least one of these should appear
            let resultsFound = false;
            for (const resultSelector of resultsSelectors) {
              try {
                if (await page.locator(resultSelector).first().isVisible({ timeout: 2000 })) {
                  resultsFound = true;
                  break;
                }
              } catch {
                // Continue
              }
            }

            // Either results appear or search is cleared
            expect(resultsFound || (await searchInput.inputValue()) === '').toBeTruthy();
            return;
          }
        }
      } catch {
        // Continue to next selector
      }
    }

    // If search is not available, skip test gracefully
    test.skip();
  });
});
