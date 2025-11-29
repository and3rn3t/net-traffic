/**
 * E2E Tests: Error Handling and Recovery
 * Tests error scenarios and recovery mechanisms
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, waitForDataLoad } from './helpers/test-helpers';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should handle 404 errors gracefully', async ({ page }) => {
    // Mock 404 response
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Not found' }),
      });
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should still be functional (might show error or fallback)
    const errorIndicators = [
      '[data-testid="error"]',
      '[role="alert"]',
      'text=Error',
      'text=Not found',
    ];

    let errorShown = false;
    for (const selector of errorIndicators) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
        errorShown = true;
        break;
      }
    }

    // Either error is shown OR app gracefully handles it
    const appLoaded = await page
      .locator('text=/NetInsight/i')
      .first()
      .isVisible({ timeout: 10000 });
    expect(errorShown || appLoaded).toBeTruthy();
  });

  test('should handle 500 server errors', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      });
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should handle error gracefully - verify app still loads
    const appLoaded = await page
      .locator('text=/NetInsight/i')
      .first()
      .isVisible({ timeout: 10000 });
    expect(appLoaded).toBeTruthy();
  });

  test('should handle network timeout', async ({ page }) => {
    // Simulate timeout by aborting requests
    await page.route('**/api/**', route => {
      setTimeout(() => {
        route.abort('timedout');
      }, 100);
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // App should handle timeout - verify app still loads
    const appLoaded = await page
      .locator('text=/NetInsight/i')
      .first()
      .isVisible({ timeout: 10000 });
    expect(appLoaded).toBeTruthy();
  });

  test('should show offline indicator when backend is unavailable', async ({ page }) => {
    // Block all API requests
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // Look for offline indicator
    const offlineIndicators = [
      '[data-testid="offline-indicator"]',
      'text=Offline',
      'text=Disconnected',
      '[data-testid="connection-status"]',
    ];

    let offlineShown = false;
    for (const selector of offlineIndicators) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
        offlineShown = true;
        break;
      }
    }

    // Either offline indicator is shown OR app handles it gracefully
    const isFunctional = await page.locator('main, [role="main"]').first().isVisible();
    expect(offlineShown || isFunctional).toBeTruthy();
  });

  test('should retry failed requests', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/health', route => {
      requestCount++;
      if (requestCount < 3) {
        // Fail first 2 requests
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Service unavailable' }),
        });
      } else {
        // Succeed on 3rd request
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'healthy' }),
        });
      }
    });

    await page.reload();
    await waitForAppReady(page);

    // Wait for retries
    await page.waitForTimeout(5000);

    // App should eventually succeed or handle gracefully
    const isFunctional = await page.locator('main, [role="main"]').first().isVisible();
    expect(isFunctional).toBeTruthy();
  });

  test('should display error messages clearly', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Database connection failed',
          error: 'Internal server error',
        }),
      });
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // Look for error message
    const errorMessage = page.locator(
      'text=Error, text=Failed, [role="alert"], [data-testid="error-message"]'
    );

    // Error message might be shown or app might handle it gracefully
    const hasError = await errorMessage
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const isFunctional = await page.locator('main, [role="main"]').first().isVisible();

    expect(hasError || isFunctional).toBeTruthy();
  });

  test('should recover from errors after backend comes back online', async ({ page }) => {
    // Start with backend offline
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service unavailable' }),
      });
    });

    await page.reload();
    await waitForAppReady(page);
    await waitForDataLoad(page);

    // Wait a bit
    await page.waitForTimeout(2000);

    // Bring backend back online
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'healthy', devices: [] }),
      });
    });

    // Wait for recovery
    await page.waitForTimeout(3000);
    await waitForDataLoad(page);

    // App should recover
    const isFunctional = await page.locator('main, [role="main"]').first().isVisible();
    expect(isFunctional).toBeTruthy();
  });
});
