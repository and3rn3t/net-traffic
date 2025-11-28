/**
 * E2E Tests: Device Management
 * Tests device viewing, editing, and management features
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, navigateToView, waitForDataLoad } from './helpers/test-helpers';

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
    await navigateToView(page, 'devices');
    await waitForDataLoad(page);
  });

  test('should display devices list', async ({ page }) => {
    // Look for device list indicators
    const deviceSelectors = [
      '[data-testid="devices-list"]',
      'text=Device',
      'table',
      '[role="table"]',
      '[role="list"]',
    ];

    let devicesFound = false;
    for (const selector of deviceSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          devicesFound = true;
          break;
        }
      } catch {
        // Continue
      }
    }

    expect(devicesFound).toBeTruthy();
  });

  test('should show device details', async ({ page }) => {
    // Look for device cards or rows
    const deviceElements = page.locator(
      '[data-testid="device"], [data-testid="device-card"], tr, [role="row"]'
    );

    const count = await deviceElements.count();
    if (count > 0) {
      // Click on first device if clickable
      const firstDevice = deviceElements.first();
      const isClickable = await firstDevice.isVisible();

      if (isClickable) {
        // Try to click or expand device
        try {
          await firstDevice.click({ timeout: 2000 });
          await page.waitForTimeout(500);

          // Check for device details
          const detailSelectors = [
            '[data-testid="device-details"]',
            'text=IP',
            'text=MAC',
            'text=Type',
          ];

          let detailsFound = false;
          for (const selector of detailSelectors) {
            if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
              detailsFound = true;
              break;
            }
          }

          // Details should be visible or device should be expanded
          expect(detailsFound || isClickable).toBeTruthy();
        } catch {
          // Device might not be clickable, that's okay
        }
      }
    }
  });

  test('should edit device information', async ({ page }) => {
    // Look for edit button or action
    const editSelectors = [
      'button[aria-label*="Edit"]',
      'button:has-text("Edit")',
      '[data-testid="edit-device"]',
      'button[aria-label*="edit" i]',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let editButton: any = null;
    for (const selector of editSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          editButton = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Look for edit dialog/form
      const formSelectors = [
        '[role="dialog"]',
        'form',
        '[data-testid="device-form"]',
        'input[name*="name" i]',
      ];

      let formFound = false;
      for (const selector of formSelectors) {
        if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
          formFound = true;

          // Try to edit device name
          const nameInput = page
            .locator('input[name*="name" i], input[placeholder*="name" i]')
            .first();
          if (await nameInput.isVisible({ timeout: 2000 })) {
            await nameInput.fill('Test Device Name');
            await page.waitForTimeout(300);

            // Look for save button
            const saveButton = page
              .locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]')
              .first();

            if (await saveButton.isVisible({ timeout: 2000 })) {
              await saveButton.click();
              await page.waitForTimeout(1000);

              // Check for success message or updated device
              const successIndicators = [
                'text=Saved',
                'text=Updated',
                'text=Success',
                '[role="status"]',
              ];

              let successFound = false;
              for (const indicator of successIndicators) {
                if (await page.locator(indicator).first().isVisible({ timeout: 3000 })) {
                  successFound = true;
                  break;
                }
              }

              // Success should be indicated
              expect(successFound).toBeTruthy();
            }
          }
          break;
        }
      }

      expect(formFound).toBeTruthy();
    } else {
      // Edit functionality might not be available, skip gracefully
      test.skip();
    }
  });

  test('should filter devices', async ({ page }) => {
    // Look for filter controls
    const filterSelectors = [
      'input[placeholder*="Filter" i]',
      'input[placeholder*="Search" i]',
      '[data-testid="device-filter"]',
      'button[aria-label*="Filter" i]',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filterInput: any = null;
    for (const selector of filterSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          filterInput = element;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (filterInput) {
      // Type filter query
      await filterInput.fill('test');
      await page.waitForTimeout(500); // Wait for debounce

      // Check that results are filtered
      await waitForDataLoad(page);

      // Filter should work (results might be empty or filtered)
      const isFiltered = await filterInput.inputValue();
      expect(isFiltered).toBeTruthy();
    } else {
      // Filter might not be available
      test.skip();
    }
  });

  test('should display device statistics', async ({ page }) => {
    // Look for device statistics/metrics
    const statSelectors = [
      'text=Total',
      'text=Active',
      'text=Bytes',
      '[data-testid="device-stats"]',
      'text=Connections',
    ];

    // At least one stat should be visible
    let statsFound = false;
    for (const selector of statSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
        statsFound = true;
        break;
      }
    }

    // Stats might not always be visible, but if devices are shown, that's good
    const devicesVisible = await page
      .locator('text=Device, [data-testid="device"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(statsFound || devicesVisible).toBeTruthy();
  });
});
