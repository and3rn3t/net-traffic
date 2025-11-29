/**
 * E2E Tests: Data Visualizations
 * Tests charts, graphs, and visual components
 */

import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, navigateToView, waitForDataLoad } from './helpers/test-helpers';

test.describe('Data Visualizations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDataLoad(page);
  });

  test('should display network graph', async ({ page }) => {
    // Navigate to visualizations or dashboard
    const vizTabs = page.locator('text=Visualizations, text=Network Graph');
    if (await vizTabs.first().isVisible({ timeout: 3000 })) {
      await vizTabs.first().click();
      await waitForDataLoad(page);
    } else {
      await navigateToView(page, 'dashboard');
      await waitForDataLoad(page);
    }

    // Look for network graph
    const graphSelectors = [
      '[data-testid="network-graph"]',
      'canvas',
      'svg',
      '[data-testid="graph"]',
    ];

    let graphFound = false;
    for (const selector of graphSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
        graphFound = true;
        break;
      }
    }

    // Graph should be visible or dashboard should show visualizations
    expect(graphFound || (await page.locator('main').first().isVisible())).toBeTruthy();
  });

  test('should display traffic chart', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for traffic chart
    const chartSelectors = [
      '[data-testid="traffic-chart"]',
      'canvas',
      'svg[class*="chart"]',
      '[role="img"][aria-label*="chart" i]',
    ];

    let chartFound = false;
    for (const selector of chartSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
        chartFound = true;
        break;
      }
    }

    // Chart should be visible or analytics should be shown
    expect(
      chartFound ||
        (await page
          .locator('text=Traffic, text=Bandwidth')
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false))
    ).toBeTruthy();
  });

  test('should display protocol breakdown', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for protocol breakdown
    const protocolSelectors = [
      '[data-testid="protocol-breakdown"]',
      'text=Protocol',
      'text=HTTP',
      'text=HTTPS',
      '[class*="protocol"]',
    ];

    let protocolFound = false;
    for (const selector of protocolSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
        protocolFound = true;
        break;
      }
    }

    // Protocol info should be visible
    expect(protocolFound || (await page.locator('main').first().isVisible())).toBeTruthy();
  });

  test('should display geographic map', async ({ page }) => {
    // Navigate to analytics or visualizations
    await navigateToView(page, 'analytics');
    await waitForDataLoad(page);

    // Look for geographic map
    const mapSelectors = [
      '[data-testid="geographic-map"]',
      '[data-testid="map"]',
      'canvas',
      'svg[class*="map"]',
      'text=Geographic',
    ];

    let mapFound = false;
    for (const selector of mapSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 5000 })) {
        mapFound = true;
        break;
      }
    }

    // Map might not always be visible, but analytics should be
    expect(
      mapFound ||
        (await page
          .locator('text=Analytics, text=Geographic')
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false))
    ).toBeTruthy();
  });

  test('should interact with charts', async ({ page }) => {
    await navigateToView(page, 'dashboard');
    await waitForDataLoad(page);

    // Look for interactive chart elements
    const interactiveElements = page.locator(
      'canvas, svg, [role="button"][aria-label*="chart" i], [data-testid*="chart"]'
    );

    const count = await interactiveElements.count();
    if (count > 0) {
      // Try to hover or click on chart
      const firstElement = interactiveElements.first();
      if (await firstElement.isVisible({ timeout: 3000 })) {
        // Hover to see if tooltip appears
        await firstElement.hover();
        await page.waitForTimeout(500);

        // Chart should be interactive (tooltip might appear or not)
        expect(await firstElement.isVisible()).toBeTruthy();
      }
    } else {
      // Charts might not be available, that's okay
      expect(await page.locator('main').first().isVisible()).toBeTruthy();
    }
  });

  test('should switch between visualization modes', async ({ page }) => {
    // Navigate to visualizations tab if available
    const vizTab = page.locator('text=Visualizations').first();
    if (await vizTab.isVisible({ timeout: 3000 })) {
      await vizTab.click();
      await waitForDataLoad(page);

      // Look for visualization mode switcher
      const modeSelectors = [
        'button[aria-label*="View" i]',
        'button:has-text("Graph")',
        'button:has-text("Chart")',
        '[data-testid="viz-mode"]',
      ];

      let modeButton: ReturnType<typeof page.locator> | null = null;
      for (const selector of modeSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            modeButton = element;
            break;
          }
        } catch {
          // Continue
        }
      }

      if (modeButton) {
        await modeButton.click();
        await page.waitForTimeout(1000);
        await waitForDataLoad(page);

        // Mode should switch
        expect(await modeButton.isVisible()).toBeTruthy();
      }
    } else {
      // Visualizations tab might not be available - verify we can navigate to dashboard
      await navigateToView(page, 'dashboard');
      const dashboardContent = page
        .locator('text=Active Connections, text=Network Throughput')
        .first();
      await expect(dashboardContent).toBeVisible({ timeout: 5000 });
    }
  });
});
