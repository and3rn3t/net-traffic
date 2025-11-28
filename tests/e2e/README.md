# E2E Tests

End-to-end tests for NetInsight application using Playwright.

## Overview

These tests verify the complete user flows and ensure the application works correctly from a user's perspective. They run in real browsers and test the full application stack.

## Test Structure

```
tests/e2e/
├── helpers/
│   └── test-helpers.ts      # Shared utility functions
├── fixtures/
│   └── test-fixtures.ts     # Custom Playwright fixtures
├── app.spec.ts              # Core app functionality
├── navigation.spec.ts       # Navigation and routing
├── api-integration.spec.ts  # API integration tests
├── search.spec.ts           # Search functionality
├── devices.spec.ts          # Device management
├── threats.spec.ts          # Threat management
├── filters.spec.ts         # Filter functionality
├── export.spec.ts           # Data export
├── visualizations.spec.ts  # Data visualizations
├── error-handling.spec.ts   # Error handling
├── connections.spec.ts      # Connections table
└── README.md               # This file
```

## Running Tests

### Install Dependencies

First, install Playwright browsers:

```bash
npx playwright install
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run in UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Run in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/app.spec.ts
```

### Debug Tests

```bash
npm run test:e2e:debug
```

### View Test Report

```bash
npm run test:e2e:report
```

## Test Configuration

Tests are configured in `playwright.config.ts`:

- **Workers**: 50% of CPUs locally, 2 workers on CI (for fast parallel execution)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Browsers**: Chromium by default (can enable Firefox/WebKit)

## Test Categories

### Core Functionality (`app.spec.ts`)

- Application loading
- Default view display
- Navigation between views
- Page refresh handling
- Responsive design

### Navigation (`navigation.spec.ts`)

- View switching
- URL routing
- Browser back/forward
- State persistence

### API Integration (`api-integration.spec.ts`)

- Connection status
- Error handling
- Data loading
- Timeout handling

### Search (`search.spec.ts`)

- Search dialog
- Query execution
- Results display

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from './fixtures/test-fixtures';
import { waitForAppReady, waitForDataLoad } from './helpers/test-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should do something', async ({ page }) => {
    // Your test code
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Using Helper Functions

```typescript
// Wait for app to be ready
await waitForAppReady(page);

// Navigate to a view
await navigateToView(page, 'dashboard');

// Wait for data to load
await waitForDataLoad(page);

// Check visibility with content
await expectVisibleWithContent(page, 'selector', 10);
```

### Best Practices

1. **Use data-testid attributes** when possible for stable selectors
2. **Wait for data loading** before making assertions
3. **Use helper functions** for common operations
4. **Handle async operations** properly with `await`
5. **Keep tests independent** - each test should be able to run alone
6. **Use descriptive test names** that explain what is being tested

## Performance Optimization

Tests are optimized for fast execution:

1. **Parallel Execution**: Tests run in parallel across workers
2. **Shared Browser Context**: Reuses browser instances when possible
3. **Selective Test Runs**: Run only changed tests during development
4. **Smart Waiting**: Uses network idle and element visibility checks

## CI/CD Integration

Tests automatically run on CI with:

- 2 workers (configurable)
- Automatic retries on failure
- GitHub Actions reporter
- Screenshots/videos on failure

## Troubleshooting

### Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify selectors are correct

### Tests Fail Intermittently

- Add explicit waits for async operations
- Check for race conditions
- Use `waitForDataLoad()` helper

### Can't Find Elements

- Use Playwright Inspector: `npm run test:e2e:debug`
- Check page content: `await page.screenshot()`
- Use browser devtools in headed mode

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Unit Tests](../src/test/README.md)
- [Integration Tests](../src/test/integration/README.md)
