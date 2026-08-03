/**
 * React hook for fetching and managing API data
 * Provides a clean interface to switch between mock and real backend data
 *
 * Backed by TanStack Query (retry/caching/polling) instead of hand-rolled
 * fetch state - matches the pattern used by SearchBar.tsx/useFlowFilters.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';
import { NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats } from '@/lib/types';
import { toast } from 'sonner';
import { API_CONFIG } from '@/hooks/useApiConfig';
import { loadSnapshot, saveSnapshot } from '@/lib/snapshotCache';

const USE_REAL_API = API_CONFIG.USE_REAL_API;
const SNAPSHOT_KEY = 'netinsight_snapshot_core';
const SNAPSHOT_SAVE_DEBOUNCE_MS = 10000;

interface CoreSnapshot {
  devices: Device[];
  flows: NetworkFlow[];
  threats: Threat[];
  analyticsData: AnalyticsData[];
  protocolStats: ProtocolStats[];
}

interface UseApiDataOptions {
  pollingInterval?: number; // ms, 0 to disable
  useWebSocket?: boolean;
}

const QUERY_KEYS = {
  health: ['core', 'health'] as const,
  devices: ['core', 'devices'] as const,
  flows: ['core', 'flows'] as const,
  threats: ['core', 'threats'] as const,
  analytics: ['core', 'analytics'] as const,
  protocolStats: ['core', 'protocolStats'] as const,
};

export function useApiData(options: UseApiDataOptions = {}) {
  const { pollingInterval = 5000, useWebSocket = true } = options;
  const queryClient = useQueryClient();

  const snapshot = USE_REAL_API ? loadSnapshot<CoreSnapshot>(SNAPSHOT_KEY) : null;
  // initialDataUpdatedAt: 0 marks the hydrated snapshot as already-stale, so
  // TanStack still kicks off a real background fetch on mount instead of
  // treating the cached snapshot as fresh for a full staleTime window.
  // (initialData is a function above so a missing snapshot cleanly resolves
  // to `undefined` at runtime, matching TanStack's "no initial data" path,
  // despite the `as` cast needed to satisfy the strict overload typing.)
  const snapshotHydration = { initialDataUpdatedAt: () => 0 };

  const [isCapturing, setIsCapturing] = useState(false);
  // True once we've painted from a cached snapshot but haven't confirmed it
  // with a fresh fetch yet - lets the UI show a "stale data" hint.
  const [isShowingStaleSnapshot, setIsShowingStaleSnapshot] = useState(!!snapshot);

  const healthQuery = useQuery({
    queryKey: QUERY_KEYS.health,
    queryFn: () => apiClient.healthCheck(),
    enabled: USE_REAL_API,
    // ApiClient already retries internally on 5xx errors - don't stack a
    // second layer of retries on top, matching the original hook's
    // single-attempt-per-fetch design.
    retry: false,
    refetchInterval: (pollingInterval || false) as number | false,
  });

  const isConnected = USE_REAL_API && healthQuery.isSuccess;

  // Backup poll every 60s once WebSocket is providing real-time updates,
  // otherwise fall back to normal interval polling.
  const dataRefetchInterval: number | false =
    useWebSocket && isConnected ? 60000 : pollingInterval || false;
  const dataQueryOptions: { enabled: boolean; retry: false; refetchInterval: number | false } = {
    enabled: USE_REAL_API,
    retry: false,
    refetchInterval: dataRefetchInterval,
  };

  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.devices,
    queryFn: () => apiClient.getDevices(),
    initialData: () => snapshot?.devices as Device[],
    ...snapshotHydration,
    ...dataQueryOptions,
  });
  const flowsQuery = useQuery({
    queryKey: QUERY_KEYS.flows,
    queryFn: () => apiClient.getFlows(100),
    initialData: () => snapshot?.flows as NetworkFlow[],
    ...snapshotHydration,
    ...dataQueryOptions,
  });
  const threatsQuery = useQuery({
    queryKey: QUERY_KEYS.threats,
    queryFn: () => apiClient.getThreats(true),
    initialData: () => snapshot?.threats as Threat[],
    ...snapshotHydration,
    ...dataQueryOptions,
  });
  const analyticsQuery = useQuery({
    queryKey: QUERY_KEYS.analytics,
    queryFn: () => apiClient.getAnalytics(24),
    initialData: () => snapshot?.analyticsData as AnalyticsData[],
    ...snapshotHydration,
    ...dataQueryOptions,
  });
  const protocolStatsQuery = useQuery({
    queryKey: QUERY_KEYS.protocolStats,
    queryFn: () => apiClient.getProtocolStats(),
    initialData: () => snapshot?.protocolStats as ProtocolStats[],
    ...snapshotHydration,
    ...dataQueryOptions,
  });

  const devices = devicesQuery.data ?? [];
  const flows = flowsQuery.data ?? [];
  const threats = threatsQuery.data ?? [];
  const analyticsData = analyticsQuery.data ?? [];
  const protocolStats = protocolStatsQuery.data ?? [];

  const isLoading =
    USE_REAL_API &&
    (devicesQuery.isLoading ||
      flowsQuery.isLoading ||
      threatsQuery.isLoading ||
      analyticsQuery.isLoading ||
      protocolStatsQuery.isLoading);

  const firstError =
    healthQuery.error ||
    devicesQuery.error ||
    flowsQuery.error ||
    threatsQuery.error ||
    analyticsQuery.error ||
    protocolStatsQuery.error;
  const error = firstError
    ? firstError instanceof Error
      ? firstError.message
      : 'Failed to fetch data'
    : null;

  // Sync isCapturing from the health check (background poll keeps it fresh);
  // startCapture/stopCapture below override it immediately for instant UI feedback.
  useEffect(() => {
    if (healthQuery.data) {
      setIsCapturing(healthQuery.data.capture_running || false);
    }
  }, [healthQuery.data]);

  // Clear the "stale snapshot" flag once every core query has completed at
  // least one real network fetch (not just the hydrated snapshot).
  useEffect(() => {
    if (
      isShowingStaleSnapshot &&
      devicesQuery.isFetched &&
      flowsQuery.isFetched &&
      threatsQuery.isFetched &&
      analyticsQuery.isFetched &&
      protocolStatsQuery.isFetched
    ) {
      setIsShowingStaleSnapshot(false);
    }
  }, [
    isShowingStaleSnapshot,
    devicesQuery.isFetched,
    flowsQuery.isFetched,
    threatsQuery.isFetched,
    analyticsQuery.isFetched,
    protocolStatsQuery.isFetched,
  ]);

  const refetchAll = useCallback(async () => {
    if (!USE_REAL_API) return;
    await Promise.all([
      healthQuery.refetch(),
      devicesQuery.refetch(),
      flowsQuery.refetch(),
      threatsQuery.refetch(),
      analyticsQuery.refetch(),
      protocolStatsQuery.refetch(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast once per new failure incident (rising edge), not once per
  // individual retry/poll attempt - avoids toast spam while the backend
  // stays down across many background polls.
  const isError =
    healthQuery.isError ||
    devicesQuery.isError ||
    flowsQuery.isError ||
    threatsQuery.isError ||
    analyticsQuery.isError ||
    protocolStatsQuery.isError;
  const wasErrorRef = useRef(false);
  useEffect(() => {
    if (isError && !wasErrorRef.current) {
      toast.error('Backend unavailable', {
        description:
          firstError instanceof ApiError && firstError.requestId
            ? `Cannot connect to backend. Check that the service is running. (Request ID: ${firstError.requestId})`
            : 'Cannot connect to backend. Check that the service is running.',
        action: {
          label: 'Retry',
          onClick: () => refetchAll(),
        },
      });
    }
    wasErrorRef.current = isError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!USE_REAL_API || !useWebSocket || !isConnected) {
      return;
    }

    const disconnect = apiClient.connectWebSocket((data: unknown) => {
      try {
        if (!data || typeof data !== 'object') return;
        const message = data as Record<string, unknown>;

        switch (message.type) {
          case 'initial_state':
            if (message.devices && Array.isArray(message.devices)) {
              queryClient.setQueryData(QUERY_KEYS.devices, message.devices as Device[]);
            }
            if (message.flows && Array.isArray(message.flows)) {
              queryClient.setQueryData(QUERY_KEYS.flows, message.flows as NetworkFlow[]);
            }
            if (message.threats && Array.isArray(message.threats)) {
              queryClient.setQueryData(QUERY_KEYS.threats, message.threats as Threat[]);
            }
            break;

          case 'flow_update':
            if (message.flow && typeof message.flow === 'object') {
              const flow = message.flow as NetworkFlow;
              queryClient.setQueryData(QUERY_KEYS.flows, (current: NetworkFlow[] = []) => {
                const existing = current.findIndex(f => f.id === flow.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = flow;
                  return updated;
                }
                return [flow, ...current].slice(0, 100);
              });
            }
            break;

          case 'device_update':
            if (message.device && typeof message.device === 'object') {
              const device = message.device as Device;
              queryClient.setQueryData(QUERY_KEYS.devices, (current: Device[] = []) => {
                const existing = current.findIndex(d => d.id === device.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = device;
                  return updated;
                }
                return [...current, device];
              });
            }
            break;

          case 'threat_update':
            if (message.threat && typeof message.threat === 'object') {
              const threat = message.threat as Threat;
              queryClient.setQueryData(QUERY_KEYS.threats, (current: Threat[] = []) => {
                const existing = current.findIndex(t => t.id === threat.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = threat;
                  return updated;
                }

                // Show toast for new threats
                if (threat.severity === 'critical' || threat.severity === 'high') {
                  toast.error(`Threat detected: ${threat.description}`, {
                    description: `Severity: ${threat.severity}`,
                  });
                }

                return [threat, ...current].slice(0, 50);
              });
            }
            break;

          default:
            console.log('Unknown WebSocket message type:', message.type);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });

    return disconnect;
  }, [useWebSocket, isConnected, queryClient]);

  // Persist a trimmed snapshot to localStorage (debounced) so a reload can
  // paint instantly from cache instead of showing a blank loading screen.
  useEffect(() => {
    if (!USE_REAL_API) return;
    const timeout = setTimeout(() => {
      saveSnapshot<CoreSnapshot>(SNAPSHOT_KEY, {
        devices,
        flows: flows.slice(0, 100),
        threats: threats.slice(0, 50),
        analyticsData,
        protocolStats,
      });
    }, SNAPSHOT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [devices, flows, threats, analyticsData, protocolStats]);

  // Control functions
  const startCapture = useCallback(async () => {
    if (!USE_REAL_API) {
      setIsCapturing(true);
      return;
    }

    try {
      await apiClient.startCapture();
      setIsCapturing(true);
      toast.success('Packet capture started');
    } catch (err) {
      toast.error('Failed to start capture', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const stopCapture = useCallback(async () => {
    if (!USE_REAL_API) {
      setIsCapturing(false);
      return;
    }

    try {
      await apiClient.stopCapture();
      setIsCapturing(false);
      toast.success('Packet capture stopped');
    } catch (err) {
      toast.error('Failed to stop capture', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const dismissThreat = useCallback(
    async (threatId: string) => {
      const markDismissed = (current: Threat[] = []) =>
        current.map(t => (t.id === threatId ? { ...t, dismissed: true } : t));

      if (!USE_REAL_API) {
        queryClient.setQueryData(QUERY_KEYS.threats, markDismissed);
        return;
      }

      try {
        await apiClient.dismissThreat(threatId);
        queryClient.setQueryData(QUERY_KEYS.threats, markDismissed);
      } catch (err) {
        toast.error('Failed to dismiss threat', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [queryClient]
  );

  return {
    // Data
    devices,
    flows,
    threats,
    analyticsData,
    protocolStats,

    // State
    isCapturing,
    isLoading,
    isConnected,
    error,
    isShowingStaleSnapshot,

    // Actions
    startCapture,
    stopCapture,
    dismissThreat,
    refresh: refetchAll,
    retryNow: refetchAll,

    // Metadata
    useRealApi: USE_REAL_API,
  };
}
