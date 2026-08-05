/**
 * useWeekComparison: fetches 14 days of hourly bandwidth data and splits it
 * into "this week" vs "last week" aligned series for an overlay chart, plus
 * a total-bytes delta between the two periods.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useApiConfig } from '@/hooks/useApiConfig';

const HOURS_PER_WEEK = 168;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface WeekComparisonPoint {
  /** Hours before the current hour (0 = most recent, 167 = oldest in the week) */
  hoursAgo: number;
  thisWeekBytes: number | null;
  lastWeekBytes: number | null;
}

export interface WeekComparison {
  points: WeekComparisonPoint[];
  thisWeekTotalBytes: number;
  lastWeekTotalBytes: number;
  deltaPercent: number | null;
  isLoading: boolean;
}

export function useWeekComparison(): WeekComparison {
  const { useRealApi } = useApiConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['bandwidth-timeline', HOURS_PER_WEEK * 2, 60],
    queryFn: () => apiClient.getBandwidthTimeline(HOURS_PER_WEEK * 2, 60),
    enabled: useRealApi,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return useMemo(() => {
    const timeline = data ?? [];
    // Newest last-week point is at the boundary between the two halves.
    const lastWeekSlice = timeline.slice(0, HOURS_PER_WEEK);
    const thisWeekSlice = timeline.slice(HOURS_PER_WEEK);

    const points: WeekComparisonPoint[] = [];
    for (let i = 0; i < HOURS_PER_WEEK; i++) {
      const hoursAgo = HOURS_PER_WEEK - 1 - i;
      points.push({
        hoursAgo,
        thisWeekBytes: thisWeekSlice[i]
          ? thisWeekSlice[i].bytes_in + thisWeekSlice[i].bytes_out
          : null,
        lastWeekBytes: lastWeekSlice[i]
          ? lastWeekSlice[i].bytes_in + lastWeekSlice[i].bytes_out
          : null,
      });
    }

    const thisWeekTotalBytes = thisWeekSlice.reduce(
      (sum, item) => sum + item.bytes_in + item.bytes_out,
      0
    );
    const lastWeekTotalBytes = lastWeekSlice.reduce(
      (sum, item) => sum + item.bytes_in + item.bytes_out,
      0
    );

    const deltaPercent =
      lastWeekTotalBytes > 0
        ? ((thisWeekTotalBytes - lastWeekTotalBytes) / lastWeekTotalBytes) * 100
        : null;

    return {
      points,
      thisWeekTotalBytes,
      lastWeekTotalBytes,
      deltaPercent,
      isLoading,
    };
  }, [data, isLoading]);
}
