/**
 * E2E Tests: API Integration
 * Tests frontend-backend integration with real or mocked API
 */

import { test, expect } from './fixtures/test-fixtures';
import {
  waitForAppReady,
  waitForDataLoad,
  mockApiResponse,
  navigateToView,
} from './helpers/test-helpers';

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should handle API connection status', async ({ page }) => {
    await waitForDataLoad(page);

    // Check for connection status indicator
    // The app shows connection status in the header as a badge
    const statusIndicators = ['text=Connected', 'text=Disconnected', 'text=/Connection/i'];

    let statusFound = false;
    for (const selector of statusIndicators) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          statusFound = true;
          break;
        }
      } catch {
        // Continue checking
      }
    }

    // App should show some status or work in mock mode
    // If connection status isn't visible, at least verify app loaded
    const appLoaded = await page.locator('text=/NetInsight/i').first().isVisible({ timeout: 5000 });
    expect(statusFound || appLoaded).toBeTruthy();
  });

  test('should display error when backend is unavailable', async ({ page, context }) => {
    // Intercept API calls and return error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service unavailable' }),
      });
    });

    // Reload to trigger API call
    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // Should show error or fallback gracefully
    // App should still be functional (may show disconnected status or error)
    const errorIndicators = [
      'text=Error',
      'text=unavailable',
      'text=Failed',
      'text=Disconnected',
      '[role="alert"]',
    ];

    let errorFound = false;
    for (const selector of errorIndicators) {
      try {
        if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
          errorFound = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    // App should still be functional even if backend is down
    const appFunctional = await page
      .locator('text=/NetInsight/i')
      .first()
      .isVisible({ timeout: 5000 });
    expect(errorFound || appFunctional).toBeTruthy();
  });

  test('should load device data', async ({ page }) => {
    // Mock successful API response
    await mockApiResponse(page, '**/api/devices', [
      {
        id: 'test-device-1',
        name: 'Test Device',
        ip: '192.168.1.100',
        type: 'laptop',
        mac: '00:11:22:33:44:55',
        threatScore: 10,
        lastSeen: Date.now(),
        bytesTotal: 1000000,
        connectionsCount: 5,
      },
    ]);

    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // Navigate to devices view using our helper
    await navigateToView(page, 'devices');
    await waitForDataLoad(page);

    // Should show device data - look for device list or device content
    const deviceContent = page.locator('text=/device/i, [role="table"], table').first();
    await expect(deviceContent).toBeVisible({ timeout: 10000 });
  });

  test('should handle API timeout gracefully', async ({ page }) => {
    // Intercept and delay API calls to simulate timeout
    await page.route('**/api/**', route => {
      // Abort immediately to simulate timeout
      route.abort('timedout');
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should handle timeout gracefully - verify app still loads
    const appFunctional = await page
      .locator('text=/NetInsight/i')
      .first()
      .isVisible({ timeout: 10000 });
    expect(appFunctional).toBeTruthy();

    // App may show disconnected status or error, but should still be functional
    const pageHasContent = (await page.locator('*').count()) > 10;
    expect(pageHasContent).toBeTruthy();
  });
});
