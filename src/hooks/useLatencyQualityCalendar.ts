/**
 * useLatencyQualityCalendar: polls the RTT/jitter heatmap by hour-of-day x
 * day-of-week endpoint (averaged over the last N days).
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useApiConfig } from '@/hooks/useApiConfig';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface LatencyCalendarCell {
  avg_rtt: number | null;
  avg_jitter: number | null;
  count: number;
}

export interface LatencyQualityCalendar {
  days: number;
  dayLabels: string[];
  cells: LatencyCalendarCell[][];
  isLoading: boolean;
}

export function useLatencyQualityCalendar(
  days: number = 14,
  deviceId?: string
): LatencyQualityCalendar {
  const { useRealApi } = useApiConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['latency-quality-calendar', days, deviceId],
    queryFn: () => apiClient.getLatencyQualityCalendar(days, deviceId),
    enabled: useRealApi,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return {
    days: data?.days ?? days,
    dayLabels: data?.day_labels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    cells: data?.cells ?? [],
    isLoading,
  };
}
