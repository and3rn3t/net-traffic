# Test Fixes Priority Guide

## Fixed Issues ✅

1. **Select.Item Empty String Values** - Fixed in:
   - `FlowFilters.tsx` - Changed `value=""` to `value="all"` for status, threat level, and device filters
   - `DataExporterEnhanced.tsx` - Changed `value=""` to `value="all"` for device filter
   - Updated handlers to convert "all" back to null

## Remaining Issues (123 failures)

### Category 1: Hook Return Value Issues (High Priority)

**Affected Tests:**

- `useHistoricalTrends.test.ts` - `result.current` is null
- `useRetry.test.ts` - `result.current` is null

**Possible Causes:**

- Hook throwing errors during render
- Dependency issues in useCallback/useEffect
- Test setup issues with fake timers

**Fix Strategy:**

1. Check if hooks are throwing errors
2. Verify all dependencies are properly mocked
3. Ensure test setup doesn't interfere with hook execution

### Category 2: Component Rendering Issues (Medium Priority)

**Affected Components:**

- `AnomalyDetection` - Not detecting anomalies
- `ConnectionHealthMonitor` - Not showing status
- `ConnectionsTableEnhanced` - Not displaying flows
- `DevicesListEnhanced` - Not rendering devices
- `HistoricalTrends` - Not calling updateTimeRange
- `SearchBar` - Not showing loading states

**Possible Causes:**

- Components not receiving required props
- Component structure changed
- Mock data doesn't match component expectations
- Components using new data fields that tests don't provide

**Fix Strategy:**

1. Verify components receive all required props in tests
2. Update mock data to include all new fields
3. Check if component rendering logic changed

### Category 3: API Integration Issues (Medium Priority)

**Affected Tests:**

- `useEnhancedAnalytics` - State not being set
- `useFlowFilters` - API errors not handled
- `api.integration.test.tsx` - API called when disabled

**Possible Causes:**

- API mocks not returning data correctly
- State not being updated after API calls
- Environment variable checks not working in tests

**Fix Strategy:**

1. Verify API mocks return proper data structures
2. Check if state setters are being called
3. Ensure environment variable mocks work correctly

### Category 4: Test Setup Issues (Low Priority)

**Affected Tests:**

- `useDebounce` - Timing issues
- `useGracefulDegradation` - Infinite loop
- `ErrorBoundary` - Multiple elements found

**Possible Causes:**

- Fake timers not working correctly
- React rendering issues
- Test assertions too strict

## Recommended Fix Order

1. **Fix hook null returns** - These block many tests
2. **Fix component rendering** - Most visible failures
3. **Fix API integration** - Affects data-dependent tests
4. **Fix test setup issues** - Edge cases

## Quick Wins

1. ✅ Fixed Select.Item empty string values
2. Update component tests to use `createMockNetworkFlow` and `createMockDevice` helpers
3. Verify all API mocks include all required methods
4. Check if components need additional props

## Next Steps

Run tests with verbose output to see specific error messages:

```bash
npm test -- --run --reporter=verbose 2>&1 | Select-String -Pattern "Error|FAIL" -Context 3
```

Focus on one test file at a time, starting with the hook tests since they affect many component tests.
