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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const maxRetries = 3;

  // Fetch all data with automatic retry
  const fetchAll = useCallback(async (attemptNum = 0) => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      if (attemptNum > 0) {
        setIsRetrying(true);
      }
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

      // Reset retry count on success
      setRetryCount(0);
      setIsRetrying(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setIsConnected(false);
      console.error('API fetch error:', err);

      // Auto-retry logic with exponential backoff
      if (attemptNum < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attemptNum), 10000); // Max 10 seconds
        const nextAttempt = attemptNum + 1;
        setRetryCount(nextAttempt);

        toast.info(`Retrying connection... (${nextAttempt}/${maxRetries})`, {
          description: `Waiting ${delay / 1000} seconds before retry`,
        });

        setTimeout(() => {
          fetchAll(nextAttempt);
        }, delay);
      } else {
        // Max retries reached
        setIsRetrying(false);
        setRetryCount(0);

        if (errorMessage.includes('timeout') || errorMessage.includes('unavailable')) {
          toast.error('Backend unavailable', {
            description:
              'Cannot connect to backend after multiple attempts. Check connection and ensure the service is running.',
            action: {
              label: 'Retry Now',
              onClick: () => fetchAll(0),
            },
          });
        }
      }
    } finally {
      if (attemptNum >= maxRetries || retryCount === 0) {
        setIsLoading(false);
      }
    }
  }, [maxRetries, retryCount]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!USE_REAL_API || !useWebSocket || !isConnected) {
      return;
    }

    const disconnect = apiClient.connectWebSocket(data => {
      try {
        switch (data.type) {
          case 'initial_state':
            if (data.devices) setDevices(data.devices);
            if (data.flows) setFlows(data.flows);
            if (data.threats) setThreats(data.threats);
            break;

          case 'flow_update':
            if (data.flow) {
              setFlows(current => {
                const existing = current.findIndex(f => f.id === data.flow.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = data.flow;
                  return updated;
                }
                return [data.flow, ...current].slice(0, 100);
              });
            }
            break;

          case 'device_update':
            if (data.device) {
              setDevices(current => {
                const existing = current.findIndex(d => d.id === data.device.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = data.device;
                  return updated;
                }
                return [...current, data.device];
              });
            }
            break;

          case 'threat_update':
            if (data.threat) {
              setThreats(current => {
                const existing = current.findIndex(t => t.id === data.threat.id);
                if (existing >= 0) {
                  const updated = [...current];
                  updated[existing] = data.threat;
                  return updated;
                }

                // Show toast for new threats
                if (data.threat.severity === 'critical' || data.threat.severity === 'high') {
                  toast.error(`Threat detected: ${data.threat.description}`, {
                    description: `Severity: ${data.threat.severity}`,
                  });
                }

                return [data.threat, ...current].slice(0, 50);
              });
            }
            break;

          default:
            console.log('Unknown WebSocket message type:', data.type);
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
    isRetrying,
    retryCount,

    // Actions
    startCapture,
    stopCapture,
    dismissThreat,
    refresh: () => fetchAll(0),
    retryNow: () => fetchAll(0),

    // Metadata
    useRealApi: USE_REAL_API,
  };
}
