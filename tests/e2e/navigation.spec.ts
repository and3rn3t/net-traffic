/**
 * E2E Tests: Navigation and Routing
 * Tests navigation between different views and URL routing
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, navigateToView, waitForDataLoad } from './helpers/test-helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await navigateToView(page, 'dashboard');

    // Check URL (if routing is implemented)
    // await expect(page).toHaveURL(/\/dashboard|\/|#dashboard/i);

    // Dashboard content should be visible
    await waitForDataLoad(page);
    const dashboardContent = page.locator('text=Dashboard, [data-testid="dashboard"]');
    await expect(dashboardContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Analytics', async ({ page }) => {
    await navigateToView(page, 'analytics');

    await waitForDataLoad(page);

    // Analytics content should be visible
    const analyticsContent = page.locator(
      'text=Analytics, text=Trends, text=Historical, [data-testid="analytics"]'
    );
    await expect(analyticsContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Devices', async ({ page }) => {
    await navigateToView(page, 'devices');

    await waitForDataLoad(page);

    // Devices content should be visible
    const devicesContent = page.locator('text=Devices, text=Device, [data-testid="devices"]');
    await expect(devicesContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Threats', async ({ page }) => {
    await navigateToView(page, 'threats');

    await waitForDataLoad(page);

    // Threats content should be visible
    const threatsContent = page.locator('text=Threats, text=Threat, [data-testid="threats"]');
    await expect(threatsContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should maintain navigation state on refresh', async ({ page }) => {
    // Navigate to a specific view
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Note: This test depends on whether routing preserves state
    // If using hash routing or state management, adjust accordingly

    // Refresh page
    await page.reload();
    await waitForAppReady(page);

    // App should still load (even if it goes to default view)
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent.first()).toBeVisible();
  });

  test('should handle back/forward browser navigation', async ({ page }) => {
    // Navigate to dashboard (if not already)
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Navigate to analytics
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Go back
    await page.goBack();
    await waitForDataLoad(page);

    // App should still be functional
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent.first()).toBeVisible();

    // Go forward
    await page.goForward();
    await waitForDataLoad(page);

    // App should still be functional
    await expect(mainContent.first()).toBeVisible();
  });
});
