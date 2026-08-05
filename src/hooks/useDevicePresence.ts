/**
 * useDevicePresence: polls the per-device, per-hour activity heatmap
 * endpoint (top devices by activity over the last N days).
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useApiConfig } from '@/hooks/useApiConfig';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface DevicePresenceEntry {
  device_id: string;
  device_name: string;
  device_ip: string;
  presence: number[];
}

export interface DevicePresence {
  days: number;
  hours: number;
  devices: DevicePresenceEntry[];
  isLoading: boolean;
}

export function useDevicePresence(days: number = 7, limit: number = 10): DevicePresence {
  const { useRealApi } = useApiConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['device-presence', days, limit],
    queryFn: () => apiClient.getDevicePresence(days, limit),
    enabled: useRealApi,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return {
    days: data?.days ?? days,
    hours: data?.hours ?? days * 24,
    devices: data?.devices ?? [],
    isLoading,
  };
}
