# Quick Integration Example

This shows how to quickly integrate the enhanced API components into your existing App.tsx.

## Step 1: Update Imports

Add these imports to your `src/App.tsx`:

```typescript
// Add enhanced components
import { TopSitesEnhanced } from '@/components/TopSitesEnhanced';
import { TopUsersEnhanced } from '@/components/TopUsersEnhanced';
import { GeographicDistributionEnhanced } from '@/components/GeographicDistributionEnhanced';
import { SummaryStatsCard } from '@/components/SummaryStatsCard';
```

## Step 2: Replace Components in JSX

Find these sections in your App.tsx and replace them:

### Replace TopUsers and TopSites

**Before:**

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <TopUsers devices={devices || []} flows={flows || []} />
  <TopSites flows={flows || []} />
</div>
```

**After:**

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <TopUsersEnhanced devices={devices || []} flows={flows || []} hours={24} limit={10} />
  <TopSitesEnhanced flows={flows || []} hours={24} limit={10} />
</div>
```

### Replace GeographicDistribution

**Before:**

```tsx
<GeographicDistribution flows={flows || []} />
```

**After:**

```tsx
<GeographicDistributionEnhanced flows={flows || []} hours={24} />
```

### Add Summary Stats Card (Optional)

Add this at the top of your insights or dashboard tab:

```tsx
<SummaryStatsCard />
```

## Step 3: Test

1. **With API enabled** - Set `VITE_USE_REAL_API=true` in `.env.local`
2. **Without API** - Components automatically fall back to local calculations
3. **Verify** - Check that refresh buttons work and data loads correctly

## Complete Example Section

Here's what a complete insights section might look like:

```tsx
<TabsContent value="insights" className="space-y-6">
  <div>
    <h2 className="text-2xl font-bold mb-2">Network Insights</h2>
    <p className="text-sm text-muted-foreground mb-6">
      Deep analysis of network patterns, top users, destinations, and usage trends
    </p>
  </div>

  {/* Summary Statistics - New! */}
  <SummaryStatsCard />

  <InsightsSummary devices={devices || []} flows={flows || []} threats={threats || []} />

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ConnectionQuality flows={flows || []} />
    <PeakUsageAnalysis flows={flows || []} devices={devices || []} />
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Enhanced components */}
    <TopUsersEnhanced devices={devices || []} flows={flows || []} hours={24} limit={10} />
    <TopSitesEnhanced flows={flows || []} hours={24} limit={10} />
  </div>

  <HistoricalTrends data={analyticsData} />

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <BandwidthPatterns flows={flows || []} />
    {/* Enhanced component */}
    <GeographicDistributionEnhanced flows={flows || []} hours={24} />
  </div>

  <ProtocolTimeline flows={flows || []} />
  <UserActivityTimeline flows={flows || []} />
</TabsContent>
```

## Features You Get

✅ **Automatic API Detection** - Components detect if API is available
✅ **Graceful Fallback** - Falls back to local calculations if API unavailable
✅ **Refresh Buttons** - Manually refresh data from backend
✅ **Loading States** - Shows loading indicators during fetch
✅ **Error Handling** - Displays errors but continues with fallback data
✅ **Configurable** - Customize time ranges, limits, and sort order

## That's It!

The enhanced components are drop-in replacements. They work with or without the API, so you can test incrementally without breaking existing functionality.
