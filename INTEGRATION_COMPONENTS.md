# Frontend Component Integration Guide

This guide shows how to use the new enhanced API endpoints in your frontend components.

## Enhanced Components Created

Three new enhanced components have been created that use the new API endpoints:

1. **TopSitesEnhanced** - Uses `/api/stats/top/domains`
2. **TopUsersEnhanced** - Uses `/api/stats/top/devices`
3. **GeographicDistributionEnhanced** - Uses `/api/stats/geographic`

All components automatically fall back to calculating from local data if the API is unavailable.

## Usage in App.tsx

Replace the existing components with the enhanced versions:

```typescript
// Import the enhanced components
import { TopSitesEnhanced } from '@/components/TopSitesEnhanced';
import { TopUsersEnhanced } from '@/components/TopUsersEnhanced';
import { GeographicDistributionEnhanced } from '@/components/GeographicDistributionEnhanced';

// In your component JSX, replace:
<TopUsers devices={devices || []} flows={flows || []} />

// With:
<TopUsersEnhanced
  devices={devices || []}
  flows={flows || []}
  hours={24}
  limit={10}
  sortBy="bytes"
/>

// And replace:
<TopSites flows={flows || []} />

// With:
<TopSitesEnhanced
  flows={flows || []}
  hours={24}
  limit={10}
/>

// And replace:
<GeographicDistribution flows={flows || []} />

// With:
<GeographicDistributionEnhanced
  flows={flows || []}
  hours={24}
/>
```

## Features

### Automatic API Detection

- Components automatically detect if `VITE_USE_REAL_API=true` is set
- Fall back gracefully to local calculations if API unavailable
- Show error messages if API fails but continue with fallback data

### Refresh Functionality

- All components include a refresh button when using API
- Manually trigger data refresh from the backend
- Loading indicators during fetch

### Configurable Parameters

- `hours` - Time range to query (default: 24)
- `limit` - Number of items to display (default: 10 for users, 20 for sites)
- `sortBy` - Sort order for top devices ('bytes' | 'connections' | 'threats')

## Enhanced Analytics Hook

The `useEnhancedAnalytics` hook provides centralized access to all enhanced analytics:

```typescript
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';

function MyComponent() {
  const {
    summaryStats,
    topDomains,
    topDevices,
    geographicStats,
    bandwidthTimeline,
    isLoading,
    error,
    fetchSummaryStats,
    fetchTopDomains,
    refresh,
  } = useEnhancedAnalytics({
    autoFetch: true, // Automatically fetch on mount
    hours: 24,
  });

  // Use the data...
}
```

## Example: Using Summary Stats

```typescript
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';

function SummaryDashboard() {
  const { summaryStats, isLoading } = useEnhancedAnalytics();

  if (isLoading) return <div>Loading...</div>;
  if (!summaryStats) return null;

  return (
    <div>
      <h2>Total Devices: {summaryStats.total_devices}</h2>
      <h2>Active Flows: {summaryStats.active_flows}</h2>
      <h2>Total Bytes: {formatBytes(summaryStats.total_bytes)}</h2>
      <h2>Critical Threats: {summaryStats.critical_threats}</h2>
    </div>
  );
}
```

## Migration Steps

1. **Import enhanced components** instead of original ones
2. **Replace component usage** in your JSX
3. **Test with and without API** to ensure fallback works
4. **Optional**: Update other components to use the enhanced analytics hook

## Backward Compatibility

All enhanced components accept the same props as their original versions, plus additional optional props:

- Original props work exactly as before (fallback mode)
- New props (`hours`, `limit`, `sortBy`) are optional and have sensible defaults
- No breaking changes to existing code

## Performance Benefits

- **Reduced client-side computation** - Backend handles aggregation
- **More accurate data** - Backend has access to full dataset
- **Better performance** - Large datasets processed server-side
- **Real-time updates** - Can refresh to get latest data

## Next Steps

1. Replace components in `App.tsx`
2. Test with API enabled and disabled
3. Consider enhancing other components (HistoricalTrends, etc.)
4. Add caching layer for frequently accessed stats
5. Implement real-time updates via WebSocket for stats
