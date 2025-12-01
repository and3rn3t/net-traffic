/**
 * React hook for fetching and managing API data
 * Provides a clean interface to switch between mock and real backend data
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats } from '@/lib/types';
import { toast } from 'sonner';

const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

interface UseApiDataOptions {
  pollingInterval?: number; // ms, 0 to disable
  useWebSocket?: boolean;
}

export function useApiData(options: UseApiDataOptions = {}) {
  const { pollingInterval = 5000, useWebSocket = true } = options;

  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<NetworkFlow[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [protocolStats, setProtocolStats] = useState<ProtocolStats[]>([]);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check backend health
      const health = await apiClient.healthCheck();
      setIsConnected(true);
      setIsCapturing(health.capture_running || false);

      // Fetch all data in parallel
      const [devicesData, flowsData, threatsData, analyticsDataResult, protocolStatsData] =
        await Promise.all([
          apiClient.getDevices(),
          apiClient.getFlows(100),
          apiClient.getThreats(true),
          apiClient.getAnalytics(24),
          apiClient.getProtocolStats(),
        ]);

      setDevices(devicesData || []);
      setFlows(flowsData || []);
      setThreats(threatsData || []);
      setAnalyticsData(analyticsDataResult || []);
      setProtocolStats(protocolStatsData || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setIsConnected(false);
      console.error('API fetch error:', err);

      if (errorMessage.includes('timeout') || errorMessage.includes('unavailable')) {
        toast.error('Backend unavailable', {
          description:
            'Cannot connect to Raspberry Pi backend. Check connection and ensure the service is running.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
              setDevices(message.devices as Device[]);
            }
            if (message.flows && Array.isArray(message.flows)) {
              setFlows(message.flows as NetworkFlow[]);
            }
            if (message.threats && Array.isArray(message.threats)) {
              setThreats(message.threats as Threat[]);
            }
            break;

          case 'flow_update':
            if (message.flow && typeof message.flow === 'object') {
              const flow = message.flow as NetworkFlow;
              setFlows(current => {
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
              setDevices(current => {
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
              setThreats(current => {
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
  }, [USE_REAL_API, useWebSocket, isConnected]);

  // Polling for data updates
  useEffect(() => {
    if (!USE_REAL_API || pollingInterval === 0) {
      return;
    }

    fetchAll();
    const interval = setInterval(fetchAll, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchAll, pollingInterval]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const dismissThreat = useCallback(async (threatId: string) => {
    if (!USE_REAL_API) {
      setThreats(current => current.map(t => (t.id === threatId ? { ...t, dismissed: true } : t)));
      return;
    }

    try {
      await apiClient.dismissThreat(threatId);
      setThreats(current => current.map(t => (t.id === threatId ? { ...t, dismissed: true } : t)));
    } catch (err) {
      toast.error('Failed to dismiss threat', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

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

    // Actions
    startCapture,
    stopCapture,
    dismissThreat,
    refresh: fetchAll,

    // Metadata
    useRealApi: USE_REAL_API,
  };
}
