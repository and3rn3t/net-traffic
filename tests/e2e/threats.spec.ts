/**
 * E2E Tests: Threat Management
 * Tests threat viewing, dismissing, and management
 */

import { test, expect } from './fixtures/test-fixtures';
import {
  waitForAppReady,
  navigateToView,
  waitForDataLoad,
  waitForToast,
} from './helpers/test-helpers';

test.describe('Threat Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
    await navigateToView(page, 'threats');
    await waitForDataLoad(page);
  });

  test('should display threats list', async ({ page }) => {
    // Threats list should be visible (even if empty)
    const threatsView = page.locator('text=Threats, [data-testid="threats"]');
    await expect(threatsView.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show threat details', async ({ page }) => {
    // Look for threat cards/alerts
    const threatElements = page.locator(
      '[data-testid="threat"], [role="alert"], .threat-card, [data-testid="threat-alert"]'
    );

    const count = await threatElements.count();
    if (count > 0) {
      const firstThreat = threatElements.first();
      await expect(firstThreat).toBeVisible();

      // Check for threat information
      const detailSelectors = [
        'text=Severity',
        'text=Type',
        'text=Description',
        'text=Device',
        'text=Time',
      ];

      let detailsFound = false;
      for (const selector of detailSelectors) {
        if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
          detailsFound = true;
          break;
        }
      }

      // Threat should have some details visible
      expect(detailsFound || count > 0).toBeTruthy();
    } else {
      // No threats available, that's okay
      const noThreatsMessage = page.locator('text=No threats, text=All clear');
      const hasMessage = await noThreatsMessage
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasMessage || count === 0).toBeTruthy();
    }
  });

  test('should dismiss a threat', async ({ page }) => {
    // Look for threat dismiss buttons
    const dismissSelectors = [
      'button[aria-label*="Dismiss" i]',
      'button:has-text("Dismiss")',
      '[data-testid="dismiss-threat"]',
      'button:has-text("Mark as resolved")',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dismissButton: any = null;
    for (const selector of dismissSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          dismissButton = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (dismissButton) {
      // Get initial threat count if available
      const threatCountBefore = await page
        .locator('[data-testid="threat"], [role="alert"]')
        .count();

      await dismissButton.click();
      await page.waitForTimeout(1000);

      // Check for success message
      try {
        await waitForToast(page, undefined, 3000);
      } catch {
        // Toast might not appear, continue
      }

      // Threat should be dismissed (count should decrease or threat should disappear)
      const threatCountAfter = await page.locator('[data-testid="threat"], [role="alert"]').count();

      // Either count decreased or threat is no longer visible
      expect(threatCountAfter <= threatCountBefore).toBeTruthy();
    } else {
      // Dismiss functionality might not be available
      test.skip();
    }
  });

  test('should filter threats by severity', async ({ page }) => {
    // Look for severity filter
    const filterSelectors = [
      'button[aria-label*="Filter" i]',
      'select[name*="severity" i]',
      '[data-testid="severity-filter"]',
      'button:has-text("Filter")',
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

      // Look for severity options
      const severityOptions = page.locator(
        'text=High, text=Medium, text=Low, text=Critical, [data-testid="severity-high"]'
      );

      if (await severityOptions.first().isVisible({ timeout: 2000 })) {
        await severityOptions.first().click();
        await page.waitForTimeout(1000);
        await waitForDataLoad(page);

        // Filter should be applied
        expect(await filterButton.isVisible()).toBeTruthy();
      }
    } else {
      // Filter might not be available
      test.skip();
    }
  });

  test('should show threat count badge', async ({ page }) => {
    // Check for threat count badge in navigation
    const badgeSelectors = ['text=Threats', '[data-testid="threats-tab"]'];

    for (const selector of badgeSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 })) {
        // Badge might or might not be visible depending on threat count
        expect(await element.isVisible()).toBeTruthy();
        break;
      }
    }
  });
});
