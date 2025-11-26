# Testing Guide

This directory contains the test setup and integration tests for the NetInsight frontend.

## Test Framework

We use **Vitest** as our testing framework with **React Testing Library** for component testing.

## Running Tests

```bash
# Run tests in watch mode (development)
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run only integration tests
npm run test:integration
```

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Global test setup and mocks
│   └── README.md              # This file
├── lib/
│   └── __tests__/
│       ├── api.integration.test.ts          # API client integration tests
│       └── api.errors.integration.test.ts   # API error handling tests
└── hooks/
    └── __tests__/
        ├── useApiData.integration.test.tsx  # useApiData hook tests
        └── useReconnection.integration.test.ts # Reconnection logic tests
```

## Test Categories

### Integration Tests

Integration tests verify that different parts of the application work together correctly:

- **API Client Tests** (`api.integration.test.ts`): Test API client methods, request/response handling, and WebSocket connections
- **Error Handling Tests** (`api.errors.integration.test.ts`): Test error scenarios, retries, and edge cases
- **Hook Tests** (`useApiData.integration.test.tsx`): Test React hooks with mocked API client
- **Reconnection Tests** (`useReconnection.integration.test.ts`): Test WebSocket reconnection logic

## Writing Tests

### Example: Testing an API Method

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api';

describe('My Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    const result = await apiClient.getDevices();
    expect(result).toEqual({ data: 'test' });
  });
});
```

### Example: Testing a React Hook

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useApiData } from '@/hooks/useApiData';

it('should fetch data on mount', async () => {
  const { result } = renderHook(() => useApiData());

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.devices).toBeDefined();
});
```

## Mocking

### API Client

The API client is mocked in hook tests:

```typescript
vi.mock('@/lib/api', () => ({
  apiClient: {
    getDevices: vi.fn(),
    // ... other methods
  },
}));
```

### WebSocket

WebSocket is mocked globally in `setup.ts` for tests that need it.

### Environment Variables

For tests that depend on environment variables, you can override them:

```typescript
Object.defineProperty(import.meta, 'env', {
  value: { ...originalEnv, VITE_USE_REAL_API: 'true' },
  writable: true,
});
```

## Coverage

Coverage reports are generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view the report.

Target coverage:

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Use Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear sections
4. **Mock External Dependencies**: Mock API calls, WebSocket, and other external services
5. **Test Error Cases**: Don't just test happy paths - test error scenarios too
6. **Keep Tests Fast**: Use fake timers for time-dependent tests
7. **Clean Up**: Use `beforeEach` and `afterEach` to reset state between tests

## Continuous Integration

Tests run automatically in CI/CD pipelines. Make sure all tests pass before merging:

```bash
npm run test:run
```

## Troubleshooting

### Tests timing out

- Check for unresolved promises
- Ensure mocks are properly set up
- Use `waitFor` for async operations

### WebSocket tests failing

- Ensure WebSocket is properly mocked
- Check that cleanup is happening in `afterEach`

### Environment variable issues

- Verify environment variables are set correctly in test setup
- Check that mocks aren't interfering with env access
