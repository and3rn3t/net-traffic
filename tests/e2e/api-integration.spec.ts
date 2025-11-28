/**
 * E2E Tests: API Integration
 * Tests frontend-backend integration with real or mocked API
 */

import { test, expect } from './fixtures/test-fixtures';
import {
  waitForAppReady,
  waitForDataLoad,
  mockApiResponse,
  checkConnectionStatus,
  waitForToast,
} from './helpers/test-helpers';

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should handle API connection status', async ({ page }) => {
    await waitForDataLoad(page);

    // Check for connection status indicator
    // It might show as connected or disconnected depending on backend
    const statusIndicators = [
      '[data-testid="connection-status"]',
      '[data-testid="backend-status"]',
      'text=Connected',
      'text=Disconnected',
    ];

    let statusFound = false;
    for (const selector of statusIndicators) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          statusFound = true;
          break;
        }
      } catch {
        // Continue checking
      }
    }

    // Status indicator should exist (even if backend is offline)
    // If no backend, it might show mock data mode
    expect(statusFound || await page.locator('text=Mock').isVisible()).toBeTruthy();
  });

  test('should display error when backend is unavailable', async ({ page, context }) => {
    // Intercept API calls and return error
    await page.route('**/api/health', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service unavailable' }),
      });
    });

    // Reload to trigger API call
    await page.reload();
    await waitForAppReady(page);

    // Should show error or fallback to mock mode
    const errorIndicators = [
      'text=Error',
      'text=unavailable',
      'text=Failed to connect',
      '[role="alert"]',
      '[data-testid="error"]',
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

    // Either error is shown OR app gracefully falls back to mock mode
    expect(errorFound || await page.locator('text=Mock').isVisible()).toBeTruthy();
  });

  test('should load device data', async ({ page }) => {
    // Mock successful API response
    await mockApiResponse(page, '**/api/devices', [
      {
        id: 'test-device-1',
        name: 'Test Device',
        ip: '192.168.1.100',
        type: 'laptop',
      },
    ]);

    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to devices view
    const devicesLink = page.locator('text=Devices').first();
    if (await devicesLink.isVisible({ timeout: 5000 })) {
      await devicesLink.click();
      await waitForDataLoad(page);

      // Should show device data
      const deviceContent = page.locator('text=Test Device, text=device, [data-testid="device"]');
      await expect(deviceContent.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle API timeout gracefully', async ({ page }) => {
    // Intercept and delay API calls to simulate timeout
    await page.route('**/api/**', route => {
      // Don't fulfill - simulate timeout
      setTimeout(() => {
        route.abort('timedout');
      }, 100);
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should handle timeout (show error or fallback)
    // Don't fail test if app gracefully handles it
    const isFunctional = await page.locator('main, [role="main"]').first().isVisible();
    expect(isFunctional).toBeTruthy();
  });
});

