/**
 * Unified data source hook for the application.
 * Encapsulates the selection between real API data and mock data,
 * along with all mock data generation and state management.
 */
import { useState, useEffect } from 'react';
import { useApiData } from './useApiData';
import { useEnhancedAnalytics } from './useEnhancedAnalytics';
import { API_CONFIG } from './useApiConfig';
import { toast } from 'sonner';
import {
  generateInitialDevices,
  generateInitialFlows,
  generateInitialThreats,
  generateAnalyticsData,
  generateProtocolStats,
  generateNetworkFlow,
  generateThreat,
} from '@/lib/mockData';
import type { Device, NetworkFlow, Threat, AnalyticsData, ProtocolStats } from '@/lib/types';

export function useDataSource() {
  const apiData = useApiData({ pollingInterval: 30000, useWebSocket: true });
  const { summaryStats, bandwidthTimeline } = useEnhancedAnalytics({
    autoFetch: API_CONFIG.USE_REAL_API,
    hours: 24,
  });

  const [mockDevices, setMockDevices] = useState<Device[]>([]);
  const [mockFlows, setMockFlows] = useState<NetworkFlow[]>([]);
  const [mockThreats, setMockThreats] = useState<Threat[]>([]);
  const [mockAnalyticsData] = useState<AnalyticsData[]>(() => generateAnalyticsData(24));
  const [mockProtocolStats] = useState<ProtocolStats[]>(() => generateProtocolStats());
  const [mockIsCapturing, setMockIsCapturing] = useState(true);

  // Initialize mock data once on mount when API is disabled
  useEffect(() => {
    if (API_CONFIG.USE_REAL_API || mockDevices.length > 0) return;
    const initialDevices = generateInitialDevices(8);
    const initialFlows = generateInitialFlows(initialDevices, 30);
    const initialThreats = generateInitialThreats(initialDevices, initialFlows, 3);
    setMockDevices(initialDevices);
    setMockFlows(initialFlows);
    setMockThreats(initialThreats);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mock data generation interval (only when API is disabled and capturing)
  useEffect(() => {
    if (API_CONFIG.USE_REAL_API || !mockIsCapturing || mockDevices.length === 0) return;

    const interval = setInterval(() => {
      setMockFlows(currentFlows => {
        const randomDevice = mockDevices[Math.floor(Math.random() * mockDevices.length)];
        const newFlow = generateNetworkFlow(randomDevice.id, `flow-${Date.now()}`);

        if (newFlow.threatLevel === 'high' || newFlow.threatLevel === 'critical') {
          const newThreat = generateThreat(randomDevice.id, newFlow.id, `threat-${Date.now()}`);
          setMockThreats(current => [newThreat, ...current].slice(0, 20));
          toast.error(`Threat detected: ${newThreat.description}`, {
            description: `Device: ${randomDevice.name}`,
          });
        }

        return [newFlow, ...currentFlows].slice(0, 100);
      });

      setMockDevices(currentDevices =>
        currentDevices.map(d => {
          const deviceFlows = mockFlows.filter(f => f.deviceId === d.id);
          const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
          return {
            ...d,
            lastSeen: Date.now(),
            bytesTotal: d.bytesTotal + totalBytes,
            connectionsCount: d.connectionsCount + 1,
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [mockIsCapturing, mockDevices, mockFlows]);

  // Select data source
  const devices = API_CONFIG.USE_REAL_API ? apiData.devices : mockDevices;
  const flows = API_CONFIG.USE_REAL_API ? apiData.flows : mockFlows;
  const threats = API_CONFIG.USE_REAL_API ? apiData.threats : mockThreats;
  const analyticsData = API_CONFIG.USE_REAL_API ? apiData.analyticsData : mockAnalyticsData;
  const protocolStats = API_CONFIG.USE_REAL_API ? apiData.protocolStats : mockProtocolStats;
  const isCapturing = API_CONFIG.USE_REAL_API ? apiData.isCapturing : mockIsCapturing;
  const isLoading = API_CONFIG.USE_REAL_API ? apiData.isLoading : false;
  const isConnected = API_CONFIG.USE_REAL_API ? apiData.isConnected : false;
  const error = API_CONFIG.USE_REAL_API ? apiData.error : null;

  const handleDismissThreat = (id: string) => {
    if (API_CONFIG.USE_REAL_API) {
      apiData.dismissThreat(id);
    } else {
      setMockThreats(current => current.map(t => (t.id === id ? { ...t, dismissed: true } : t)));
    }
  };

  const handleToggleCapture = () => {
    if (API_CONFIG.USE_REAL_API) {
      isCapturing ? apiData.stopCapture() : apiData.startCapture();
    } else {
      setMockIsCapturing(prev => !prev);
    }
  };

  const startCapture = () => {
    if (API_CONFIG.USE_REAL_API) {
      apiData.startCapture();
    } else {
      setMockIsCapturing(true);
    }
  };

  return {
    devices,
    flows,
    threats,
    analyticsData,
    protocolStats,
    isCapturing,
    isLoading,
    isConnected,
    error,
    summaryStats,
    bandwidthTimeline,
    handleDismissThreat,
    handleToggleCapture,
    startCapture,
    refresh: apiData.refresh,
    // Config flags for JSX conditionals
    USE_REAL_API: API_CONFIG.USE_REAL_API,
    useRealApi: API_CONFIG.USE_REAL_API,
  };
}
