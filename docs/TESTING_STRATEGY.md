# Testing Strategy

## Overview

The project uses a comprehensive testing strategy with separate workflows for unit tests, E2E tests, and nightly test runs.

## Test Workflows

### 1. CI/CD Workflow (`.github/workflows/ci-cd.yml`)

**Triggers:**

- Push to `main`/`master` branches
- Pull requests to `main`/`master` branches

**Jobs:**

- **Unit Tests**: Runs on every push and PR
  - Type checking
  - Linting
  - Formatting checks
  - Unit tests
  - Integration tests
- **E2E Tests**: Runs only on push to main/master (not on PRs)
  - Full Playwright E2E test suite
  - Uses 4 workers for parallel execution (faster)
  - Doesn't block deployment if tests fail (continue-on-error)
  - Saves time on PRs while ensuring main branch is fully tested

- **Deploy**: Runs after tests pass (only on push to main/master)
  - Builds application
  - Deploys to Cloudflare Pages
  - Verifies deployment

### 2. Nightly Tests Workflow (`.github/workflows/nightly-tests.yml`)

**Triggers:**

- Scheduled: Every night at 2 AM UTC
- Manual: Can be triggered via GitHub Actions UI

**Jobs:**

- **Unit Tests**:
  - Full test suite with coverage
  - Codecov integration (if token is set)
  - 30-day artifact retention
- **E2E Tests**:
  - Complete E2E test suite
  - Uses 4 workers for parallel execution
  - Doesn't fail workflow (continue-on-error)
  - Playwright reports
  - 30-day artifact retention

- **Test Summary**:
  - Aggregates results from both test suites
  - Provides summary in workflow output

## Test Types

### Unit Tests

- **Location**: `src/**/__tests__/**`
- **Framework**: Vitest
- **Run**: `npm run test:run`
- **Coverage**: `npm run test:coverage`

### Integration Tests

- **Location**: `src/test/integration/**`
- **Framework**: Vitest
- **Run**: `npm run test:integration`
- **Config**: `vitest.integration.config.ts`

### E2E Tests

- **Location**: `tests/e2e/**`
- **Framework**: Playwright
- **Run**: `npm run test:e2e`
- **UI Mode**: `npm run test:e2e:ui`

## Running Tests Locally

### Unit Tests

```bash
# Run all unit tests
npm run test:run

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test

# Run with UI
npm run test:ui
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Test Configuration

### Environment Variables

Tests use mock data by default:

```bash
VITE_USE_REAL_API=false
```

This ensures tests don't require a running backend.

### Coverage

Coverage reports are generated in the `coverage/` directory:

- HTML report: `coverage/index.html`
- LCOV report: `coverage/lcov.info` (for Codecov)

### Artifacts

Test results are saved as GitHub Actions artifacts:

- **CI/CD workflow**: 7-day retention
- **Nightly workflow**: 30-day retention

## Benefits of This Strategy

1. **Faster PR Feedback**: Unit tests run quickly on every PR
2. **Comprehensive Main Branch**: E2E tests ensure main branch is fully tested
3. **Nightly Monitoring**: Catches regressions that might slip through
4. **Cost Efficient**: E2E tests only run when needed
5. **Better Coverage**: Nightly runs include coverage reports

## Workflow Summary

| Workflow     | Unit Tests | E2E Tests | When           |
| ------------ | ---------- | --------- | -------------- |
| CI/CD (PR)   | ✅         | ❌        | Every PR       |
| CI/CD (Push) | ✅         | ✅        | Push to main   |
| Nightly      | ✅         | ✅        | 2 AM UTC daily |

## Manual Triggering

All workflows can be manually triggered:

1. Go to **Actions** tab in GitHub
2. Select the workflow
3. Click **Run workflow**
4. Choose branch and click **Run workflow**

## Monitoring

### Check Test Results

1. **GitHub Actions**:
   - Go to **Actions** tab
   - Click on workflow run
   - View test results and artifacts

2. **Artifacts**:
   - Download test results
   - View Playwright reports
   - Check coverage reports

### Codecov Integration

If `CODECOV_TOKEN` secret is set:

- Coverage reports are automatically uploaded
- View coverage trends at codecov.io
- Get PR coverage comments

## Troubleshooting

### Tests Failing

1. **Check logs**: View workflow run logs
2. **Run locally**: Reproduce issue locally
3. **Check environment**: Ensure `VITE_USE_REAL_API=false`

### E2E Tests Timing Out

1. **Increase timeout**: Update `playwright.config.ts`
2. **Check browser installation**: Ensure browsers are installed
3. **Run in headed mode**: Debug visually

### Coverage Not Uploading

1. **Check token**: Ensure `CODECOV_TOKEN` is set (optional)
2. **Check format**: Ensure LCOV format is generated
3. **Manual upload**: Can upload manually if needed

## Best Practices

1. **Write unit tests** for all new features
2. **Add E2E tests** for critical user flows
3. **Keep tests fast** - unit tests should be < 1s each
4. **Use mocks** - don't require real backend for tests
5. **Review coverage** - aim for >80% coverage
6. **Fix flaky tests** - ensure tests are reliable

## Related Documentation

- [E2E_TEST_CONFIGURATION.md](./E2E_TEST_CONFIGURATION.md) - E2E test configuration details
- [TESTING_SETUP.md](./TESTING_SETUP.md) - Detailed test setup guide
- [E2E Tests Guide](../tests/e2e/README.md) - E2E testing guide
