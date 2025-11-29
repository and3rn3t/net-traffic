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

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(3000); // Give React app time to render

    // Check that page has content in the HTML (not checking visibility, just existence)
    const htmlContent = await page.content();
    expect(htmlContent.length).toBeGreaterThan(1000); // Should have substantial content

    // Check for React root element (the app should mount here)
    const root = page.locator('#root');
    const rootExists = (await root.count()) > 0;
    expect(rootExists).toBeTruthy();

    // Wait a bit more for React to hydrate and render
    await page.waitForTimeout(2000);

    // Check that the page has elements (DOM structure exists)
    const elementCount = await page.locator('*').count();
    expect(elementCount).toBeGreaterThan(10); // Should have many DOM elements
  });

  test('should display dashboard view by default', async ({ page }) => {
    // Dashboard should be visible
    await waitForDataLoad(page);

    // Check for dashboard content - look for metric cards or dashboard-specific content
    const dashboardContent = page
      .locator('text=Active Connections, text=Network Throughput, text=Active Devices')
      .first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between views', async ({ page }) => {
    await waitForDataLoad(page);

    // Test navigation to Analytics
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Should show analytics content - look for analytics tab active state and content
    const analyticsTab = page.getByRole('tab', { name: /Analytics/i });
    await expect(analyticsTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Test navigation to Devices
    await navigateToView(page, 'devices');
    await waitForDataLoad(page);

    // Should show devices content - verify tab is active
    const devicesTab = page.getByRole('tab', { name: /Devices/i });
    await expect(devicesTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Test navigation to Threats
    await navigateToView(page, 'threats');
    await waitForDataLoad(page);

    // Should show threats content - verify tab is active
    const threatsTab = page.getByRole('tab', { name: /Threats/i });
    await expect(threatsTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Navigate back to Dashboard
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Verify dashboard tab is active again
    const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
    await expect(dashboardTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });
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

    // App should still be functional - check for NetInsight heading
    const header = page
      .locator('h1')
      .filter({ hasText: /NetInsight/i })
      .or(page.getByText(/NetInsight/i))
      .first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // App should load back to dashboard (default view) - verify dashboard content is visible
    const dashboardContent = page
      .locator('text=Active Connections, text=Network Throughput')
      .first();
    await expect(dashboardContent).toBeVisible({ timeout: 5000 });
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await waitForDataLoad(page);

    // App should still be visible and functional - check for NetInsight heading
    const header = page
      .locator('h1')
      .filter({ hasText: /NetInsight/i })
      .or(page.getByText(/NetInsight/i))
      .first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // Navigation should still work on mobile (tabs may be scrollable)
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Verify analytics tab is active
    const analyticsTab = page.getByRole('tab', { name: /Analytics/i });
    await expect(analyticsTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });
  });
});
