import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { AnalyticsData } from '@/lib/types';

type TimeRange = '1h' | '24h' | '7d' | '30d';

interface UseHistoricalTrendsOptions {
  initialTimeRange?: TimeRange;
  autoFetch?: boolean;
  cacheEnabled?: boolean;
}

interface CacheEntry {
  data: AnalyticsData[];
  timestamp: number;
  timeRange: TimeRange;
}

const CACHE_DURATION = 60 * 1000; // 1 minute cache
const cache: Map<TimeRange, CacheEntry> = new Map();

// Convert time range to hours
const timeRangeToHours = (range: TimeRange): number => {
  switch (range) {
    case '1h':
      return 1;
    case '24h':
      return 24;
    case '7d':
      return 7 * 24;
    case '30d':
      return 30 * 24;
    default:
      return 24;
  }
};

export function useHistoricalTrends(options: UseHistoricalTrendsOptions = {}) {
  const { initialTimeRange = '24h', autoFetch = true, cacheEnabled = true } = options;

  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if cached data is still valid
  const getCachedData = useCallback(
    (range: TimeRange): AnalyticsData[] | null => {
      if (!cacheEnabled) return null;

      const cached = cache.get(range);
      if (!cached) return null;

      const age = Date.now() - cached.timestamp;
      if (age < CACHE_DURATION) {
        return cached.data;
      }

      // Remove stale cache entry
      cache.delete(range);
      return null;
    },
    [cacheEnabled]
  );

  // Fetch analytics data from API
  const fetchAnalytics = useCallback(
    async (range: TimeRange) => {
      // Check cache first
      const cached = getCachedData(range);
      if (cached) {
        setData(cached);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const hours = timeRangeToHours(range);
        const analyticsData = await apiClient.getAnalytics(hours);

        // Update cache
        if (cacheEnabled) {
          cache.set(range, {
            data: analyticsData,
            timestamp: Date.now(),
            timeRange: range,
          });
        }

        setData(analyticsData || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch historical trends data';
        setError(errorMessage);
        console.error('Error fetching historical trends:', err);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    },
    [getCachedData, cacheEnabled]
  );

  // Update time range and fetch data
  const updateTimeRange = useCallback(
    (newRange: TimeRange) => {
      setTimeRange(newRange);
      if (autoFetch) {
        fetchAnalytics(newRange);
      }
    },
    [autoFetch, fetchAnalytics]
  );

  // Initial fetch and auto-fetch on timeRange change
  useEffect(() => {
    if (autoFetch) {
      fetchAnalytics(timeRange);
    }
  }, [autoFetch, timeRange, fetchAnalytics]);

  // Clear cache
  const clearCache = useCallback(() => {
    cache.clear();
  }, []);

  // Refresh data (bypass cache)
  const refresh = useCallback(() => {
    cache.delete(timeRange);
    fetchAnalytics(timeRange);
  }, [timeRange, fetchAnalytics]);

  return {
    timeRange,
    data,
    isLoading,
    error,
    updateTimeRange,
    refresh,
    clearCache,
  };
}
