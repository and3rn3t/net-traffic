# E2E Test Configuration

## Overview

E2E tests are configured for fast parallel execution and don't block deployments if they fail.

## Configuration

### Workers (Parallel Execution)

**Playwright Configuration** (`playwright.config.ts`):
- **CI**: 4 workers (parallel test execution)
- **Local**: 50% of CPU cores

This allows up to 4 tests to run simultaneously on CI, significantly speeding up test execution.

### Failure Handling

E2E tests are configured to **not fail the workflow**:
- Tests run and report results
- Failures are logged and artifacts are saved
- Deployment proceeds even if E2E tests fail
- Results are available in workflow artifacts

**Rationale:**
- E2E tests can be flaky due to timing, network, or environment issues
- Unit tests provide fast feedback for code quality
- E2E test failures don't prevent deployment
- Test results are still available for review

## Workflow Behavior

### CI/CD Workflow

| Job | Blocks Deploy | Workers | Notes |
|-----|--------------|---------|-------|
| Unit Tests | ✅ Yes | N/A | Must pass for deployment |
| E2E Tests | ❌ No | 4 | Results saved, but don't block |
| Deploy | - | - | Runs after unit tests pass |

### Nightly Tests

- E2E tests run with `continue-on-error: true`
- Results are saved for 30 days
- Test summary aggregates all results

## Performance

### Before (2 workers)
- Sequential test execution
- Slower overall completion time

### After (4 workers)
- Parallel test execution
- ~2x faster test completion
- Better resource utilization

## Monitoring

### Check E2E Test Results

1. **GitHub Actions**:
   - Go to Actions tab
   - Click on workflow run
   - Check E2E Tests job status
   - Download artifacts for detailed reports

2. **Artifacts**:
   - `e2e-test-results`: Test results and screenshots
   - `playwright-report`: HTML test report

### Understanding Results

- **Green**: All tests passed
- **Yellow**: Some tests failed (workflow still succeeds)
- **Red**: Job failed (rare, usually infrastructure issues)

## Adjusting Workers

To change the number of workers:

**In `playwright.config.ts`:**
```typescript
workers: process.env.CI ? 4 : '50%', // Change 4 to desired number
```

**Considerations:**
- More workers = faster execution but more resource usage
- Too many workers can cause flakiness
- Recommended: 4-6 workers for CI
- Monitor test stability when changing

## Best Practices

1. **Review E2E failures**: Check artifacts even if workflow succeeds
2. **Fix flaky tests**: Don't ignore consistent failures
3. **Monitor performance**: Track test execution time
4. **Use retries**: Already configured (2 retries on CI)
5. **Parallel-safe tests**: Ensure tests don't interfere with each other

## Troubleshooting

### Tests Timing Out

- Check if too many workers are causing resource contention
- Reduce workers if needed
- Increase test timeout in `playwright.config.ts`

### Flaky Tests

- Check test isolation
- Review timing issues
- Check for shared state between tests
- Use `test.describe.serial()` for tests that must run sequentially

### Slow Execution

- Verify workers are being used (check logs)
- Check for sequential test execution
- Review test dependencies
- Consider splitting large test files

## Related Documentation

- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Complete testing strategy
- [TESTING_WORKFLOWS.md](./TESTING_WORKFLOWS.md) - Workflow overview

