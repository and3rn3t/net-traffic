/**
 * E2E Tests: Application Core Functionality
 * Tests basic app loading, navigation, and core features
 */

import { test, expect } from './fixtures/test-fixtures';
import {
  waitForAppReady,
  navigateToView,
  waitForDataLoad,
  expectVisibleWithContent,
} from './helpers/test-helpers';

test.describe('Application Core', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should load the application successfully', async ({ page }) => {
    // Check that the app loaded
    await expect(page).toHaveTitle(/NetInsight|Net Traffic/i);

    // Check for main content area
    const mainContent = page.locator('main, [role="main"], [data-testid="app"]');
    await expect(mainContent.first()).toBeVisible();
  });

  test('should display dashboard view by default', async ({ page }) => {
    // Dashboard should be visible
    await waitForDataLoad(page);

    // Check for dashboard content indicators
    const dashboardElements = ['text=Dashboard', 'text=Network', '[data-testid="dashboard"]'];

    let found = false;
    for (const selector of dashboardElements) {
      try {
        await expect(page.locator(selector).first()).toBeVisible({ timeout: 2000 });
        found = true;
        break;
      } catch {
        // Continue checking
      }
    }

    expect(found).toBeTruthy();
  });

  test('should navigate between views', async ({ page }) => {
    await waitForDataLoad(page);

    // Test navigation to Analytics
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Should show analytics content
    const analyticsContent = page.locator('text=Analytics, text=Trends, [data-testid="analytics"]');
    await expect(analyticsContent.first()).toBeVisible({ timeout: 5000 });

    // Test navigation to Devices
    await navigateToView(page, 'devices');
    await waitForDataLoad(page);

    // Should show devices content
    const devicesContent = page.locator('text=Devices, [data-testid="devices"]');
    await expect(devicesContent.first()).toBeVisible({ timeout: 5000 });

    // Test navigation to Threats
    await navigateToView(page, 'threats');
    await waitForDataLoad(page);

    // Should show threats content
    const threatsContent = page.locator('text=Threats, [data-testid="threats"]');
    await expect(threatsContent.first()).toBeVisible({ timeout: 5000 });

    // Navigate back to Dashboard
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);
  });

  test('should handle page refresh gracefully', async ({ page }) => {
    await waitForDataLoad(page);

    // Navigate to a view
    await navigateToView(page, 'devices');
    await waitForDataLoad(page);

    // Refresh the page
    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should still be functional
    const mainContent = page.locator('main, [role="main"], [data-testid="app"]');
    await expect(mainContent.first()).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await waitForDataLoad(page);

    // App should still be visible and functional
    const mainContent = page.locator('main, [role="main"], [data-testid="app"]');
    await expect(mainContent.first()).toBeVisible();

    // Navigation should still work (may be in a menu/drawer)
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);
  });
});
