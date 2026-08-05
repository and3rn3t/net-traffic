/**
 * useDataBudget: polls month-to-date bandwidth usage and computes a linear
 * end-of-month projection, plus percentage-of-cap using the user's
 * configured monthly data cap preference (client-side, stored in
 * AppContext preferences).
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useApiConfig } from '@/hooks/useApiConfig';
import { useApp } from '@/contexts/AppContext';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const BYTES_PER_GB = 1024 ** 3;

export interface DataBudget {
  currentBytes: number;
  priorMonthBytes: number;
  projectedMonthBytes: number;
  daysElapsed: number;
  daysInMonth: number;
  capGb: number | undefined;
  percentOfCap: number | undefined;
  projectedPercentOfCap: number | undefined;
  isLoading: boolean;
}

export function useDataBudget(): DataBudget {
  const { useRealApi } = useApiConfig();
  const { preferences } = useApp();
  const capGb = preferences.monthlyDataCapGb;

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-usage'],
    queryFn: () => apiClient.getMonthlyUsage(),
    enabled: useRealApi,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const currentBytes = data?.current_bytes ?? 0;
  const projectedMonthBytes = data?.projected_month_bytes ?? 0;
  const capBytes = capGb !== undefined ? capGb * BYTES_PER_GB : undefined;

  return {
    currentBytes,
    priorMonthBytes: data?.prior_month_bytes ?? 0,
    projectedMonthBytes,
    daysElapsed: data?.days_elapsed ?? 0,
    daysInMonth: data?.days_in_month ?? 0,
    capGb,
    percentOfCap: capBytes ? (currentBytes / capBytes) * 100 : undefined,
    projectedPercentOfCap: capBytes ? (projectedMonthBytes / capBytes) * 100 : undefined,
    isLoading,
  };
}
