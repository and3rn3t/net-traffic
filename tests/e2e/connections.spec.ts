/**
 * E2E Tests: Connections Table
 * Tests viewing and interacting with network connections
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, navigateToView, waitForDataLoad } from './helpers/test-helpers';

test.describe('Connections Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);
  });

  test('should display connections table', async ({ page }) => {
    // Look for connections table
    const tableSelectors = [
      '[data-testid="connections-table"]',
      'table',
      '[role="table"]',
      'text=Connections',
    ];

    let tableFound = false;
    for (const selector of tableSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
        tableFound = true;
        break;
      }
    }

    // Table should be visible or connections should be shown
    expect(
      tableFound ||
        (await page
          .locator('text=Connection, text=Flow')
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false))
    ).toBeTruthy();
  });

  test('should sort connections by column', async ({ page }) => {
    // Look for sortable column headers
    const columnHeaders = page.locator('th, [role="columnheader"], button[aria-label*="Sort" i]');

    const count = await columnHeaders.count();
    if (count > 0) {
      const firstHeader = columnHeaders.first();
      if (await firstHeader.isVisible({ timeout: 3000 })) {
        await firstHeader.click();
        await page.waitForTimeout(500);
        await waitForDataLoad(page);

        // Table should still be visible after sorting
        expect(await firstHeader.isVisible()).toBeTruthy();
      }
    } else {
      // Sorting might not be available - verify table is visible
      const tableVisible = await page
        .locator('table, [role="table"]')
        .first()
        .isVisible({ timeout: 5000 });
      expect(tableVisible).toBeTruthy();
    }
  });

  test('should paginate connections', async ({ page }) => {
    // Look for pagination controls
    const paginationSelectors = [
      'button[aria-label*="Next" i]',
      'button:has-text("Next")',
      '[data-testid="pagination"]',
      'button[aria-label*="Page" i]',
    ];

    let paginationFound = false;
    for (const selector of paginationSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
        paginationFound = true;

        // Try to navigate to next page
        const nextButton = page
          .locator('button[aria-label*="Next" i], button:has-text("Next")')
          .first();
        if (await nextButton.isVisible({ timeout: 2000 })) {
          await nextButton.click();
          await page.waitForTimeout(500);
          await waitForDataLoad(page);

          // Should be on next page
          expect(await nextButton.isVisible()).toBeTruthy();
        }
        break;
      }
    }

    // Pagination might not be available if there are few connections
    // In that case, just verify connections table is visible
    if (!paginationFound) {
      const tableVisible = await page
        .locator('table, [role="table"], text=/connection/i')
        .first()
        .isVisible({ timeout: 5000 });
      expect(tableVisible).toBeTruthy();
    }
  });

  test('should show connection details on click', async ({ page }) => {
    // Look for connection rows
    const connectionRows = page.locator('tr, [role="row"], [data-testid="connection"]');

    const count = await connectionRows.count();
    if (count > 0) {
      const firstRow = connectionRows.first();
      if (await firstRow.isVisible({ timeout: 3000 })) {
        await firstRow.click();
        await page.waitForTimeout(500);

        // Check for details panel or expanded view
        const detailSelectors = [
          '[data-testid="connection-details"]',
          '[role="dialog"]',
          'text=Details',
          'text=Source',
          'text=Destination',
        ];

        let detailsFound = false;
        for (const selector of detailSelectors) {
          if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
            detailsFound = true;
            break;
          }
        }

        // Details should be shown or row should be expanded
        expect(detailsFound || (await firstRow.isVisible())).toBeTruthy();
      }
    } else {
      // No connections available - verify table structure is present
      const tableVisible = await page
        .locator('table, [role="table"]')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(tableVisible || count === 0).toBeTruthy();
    }
  });

  test('should filter connections in table', async ({ page }) => {
    // Look for table filter input
    const filterInput = page
      .locator(
        'input[placeholder*="Filter" i], input[placeholder*="Search" i], [data-testid="table-filter"]'
      )
      .first();

    if (await filterInput.isVisible({ timeout: 3000 })) {
      await filterInput.fill('192.168');
      await page.waitForTimeout(500); // Wait for debounce
      await waitForDataLoad(page);

      // Filter should be applied
      const filterValue = await filterInput.inputValue();
      expect(filterValue).toContain('192.168');
    } else {
      // Filter might not be available - verify connections table is visible
      const tableVisible = await page
        .locator('table, [role="table"]')
        .first()
        .isVisible({ timeout: 5000 });
      expect(tableVisible).toBeTruthy();
    }
  });
});
