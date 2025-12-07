/**
 * Unit tests for useApiData hook
 * Tests WebSocket updates, error handling, and state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiData } from '@/hooks/useApiData';
import { apiClient } from '@/lib/api';
import { NetworkFlow, Device, Threat } from '@/lib/types';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    healthCheck: vi.fn(),
    getDevices: vi.fn(),
    getDevice: vi.fn(),
    getFlows: vi.fn(),
    getFlow: vi.fn(),
    getThreats: vi.fn(),
    dismissThreat: vi.fn(),
    getAnalytics: vi.fn(),
    getProtocolStats: vi.fn(),
    getCaptureStatus: vi.fn(),
    startCapture: vi.fn(),
    stopCapture: vi.fn(),
    getSummaryStats: vi.fn(),
    getGeographicStats: vi.fn(),
    getTopDomains: vi.fn(),
    getTopDevices: vi.fn(),
    getBandwidthTimeline: vi.fn(),
    getRttTrends: vi.fn(),
    getJitterAnalysis: vi.fn(),
    getRetransmissionReport: vi.fn(),
    getConnectionQualitySummary: vi.fn(),
    getApplicationBreakdown: vi.fn(),
    getApplicationTrends: vi.fn(),
    getDeviceApplicationProfile: vi.fn(),
    getDeviceAnalytics: vi.fn(),
    updateDevice: vi.fn(),
    search: vi.fn(),
    exportFlows: vi.fn(),
    getMaintenanceStats: vi.fn(),
    runCleanup: vi.fn(),
    connectWebSocket: vi.fn(() => () => {}),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => {
  const mockToast = vi.fn().mockReturnValue('toast-id') as any;
  mockToast.success = vi.fn().mockReturnValue('toast-id');
  mockToast.error = vi.fn().mockReturnValue('toast-id');
  mockToast.warning = vi.fn().mockReturnValue('toast-id');
  mockToast.info = vi.fn().mockReturnValue('toast-id');
  return {
    toast: mockToast,
  };
});

// Mock environment variable
vi.mock('import.meta', () => ({
  env: {
    VITE_USE_REAL_API: 'true',
  },
}));

const mockDevice: Device = {
  id: 'device-1',
  name: 'Test Device',
  ip: '192.168.1.1',
  mac: '00:00:00:00:00:01',
  type: 'desktop',
  vendor: 'Test Vendor',
  firstSeen: Date.now() - 86400000,
  lastSeen: Date.now(),
  bytesTotal: 1000000,
  connectionsCount: 10,
  threatScore: 5,
  behavioral: {
    peakHours: [9, 10, 11],
    commonPorts: [80, 443],
    commonDomains: ['example.com'],
    anomalyCount: 0,
  },
};

const mockFlow: NetworkFlow = {
  id: 'flow-1',
  timestamp: Date.now(),
  sourceIp: '192.168.1.1',
  sourcePort: 50000,
  destIp: '8.8.8.8',
  destPort: 53,
  protocol: 'HTTPS',
  bytesIn: 1000,
  bytesOut: 500,
  packetsIn: 10,
  packetsOut: 5,
  duration: 1000,
  status: 'active',
  threatLevel: 'safe',
  deviceId: 'device-1',
};

const mockThreat: Threat = {
  id: 'threat-1',
  timestamp: Date.now(),
  type: 'malware',
  severity: 'high',
  deviceId: 'device-1',
  flowId: 'flow-1',
  description: 'Test threat',
  recommendation: 'Investigate',
  dismissed: false,
};

describe('useApiData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WebSocket Updates', () => {
    it('should update flows when flow_update message is received', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([mockDevice]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([mockFlow]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {}; // Disconnect function
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Wait for WebSocket to be connected
      await waitFor(() => {
        expect(apiClient.connectWebSocket).toHaveBeenCalled();
      });

      // Simulate flow update
      const updatedFlow = { ...mockFlow, bytesIn: 2000 };
      act(() => {
        wsCallback?.({
          type: 'flow_update',
          flow: updatedFlow,
        });
      });

      await waitFor(() => {
        const flows = result.current.flows;
        expect(flows.some(f => f.bytesIn === 2000)).toBe(true);
      });
    });

    it('should add new flow when flow_update message contains new flow', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([mockDevice]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([mockFlow]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const newFlow: NetworkFlow = {
        ...mockFlow,
        id: 'flow-2',
        destIp: '1.1.1.1',
      };

      act(() => {
        wsCallback?.({
          type: 'flow_update',
          flow: newFlow,
        });
      });

      await waitFor(() => {
        expect(result.current.flows.length).toBeGreaterThan(1);
        expect(result.current.flows.some(f => f.id === 'flow-2')).toBe(true);
      });
    });

    it('should update devices when device_update message is received', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([mockDevice]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const updatedDevice = { ...mockDevice, name: 'Updated Device' };

      act(() => {
        wsCallback?.({
          type: 'device_update',
          device: updatedDevice,
        });
      });

      await waitFor(() => {
        const devices = result.current.devices;
        expect(devices.some(d => d.name === 'Updated Device')).toBe(true);
      });
    });

    it('should show toast for high/critical threats', async () => {
      const { toast } = await import('sonner');
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(apiClient.connectWebSocket).toHaveBeenCalled();
      });

      const criticalThreat: Threat = {
        ...mockThreat,
        severity: 'critical',
        description: 'Critical threat detected',
      };

      act(() => {
        wsCallback?.({
          type: 'threat_update',
          threat: criticalThreat,
        });
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Critical threat detected'),
          expect.any(Object)
        );
      });
    });

    it('should handle initial_state WebSocket message', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        wsCallback?.({
          type: 'initial_state',
          devices: [mockDevice],
          flows: [mockFlow],
          threats: [mockThreat],
        });
      });

      await waitFor(() => {
        expect(result.current.devices).toHaveLength(1);
        expect(result.current.flows).toHaveLength(1);
        expect(result.current.threats).toHaveLength(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors with specific message', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { toast } = await import('sonner');
      const error = new Error('Request timeout');
      vi.mocked(apiClient.healthCheck).mockRejectedValue(error);

      const { result } = renderHook(() => useApiData());

      // Wait for initial attempt to fail
      await act(async () => {
        await Promise.resolve();
      });

      // Advance timers to complete all retries (3 retries with exponential backoff: 1s, 2s, 4s = ~7s total)
      // Run all timers and flush promises multiple times to ensure all retries complete
      await act(async () => {
        // Run all pending timers (this will execute all setTimeout callbacks)
        vi.runAllTimers();
        // Flush promises to allow async operations to complete
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 1000 }
      );

      expect(toast.error).toHaveBeenCalledWith(
        'Backend unavailable',
        expect.objectContaining({
          description: expect.stringContaining('Cannot connect to backend'),
        })
      );

      vi.useRealTimers();
    });

    it('should handle unavailable errors', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { toast } = await import('sonner');
      const error = new Error('Service unavailable');
      vi.mocked(apiClient.healthCheck).mockRejectedValue(error);

      const { result } = renderHook(() => useApiData());

      // Wait for initial attempt to fail
      await act(async () => {
        await Promise.resolve();
      });

      // Run all timers and flush promises
      await act(async () => {
        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 1000 }
      );

      expect(result.current.isConnected).toBe(false);
      expect(toast.error).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should set error state on fetch failure', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const error = new Error('Network error');
      vi.mocked(apiClient.healthCheck).mockRejectedValue(error);

      const { result } = renderHook(() => useApiData());

      // Wait for initial attempt to fail
      await act(async () => {
        await Promise.resolve();
      });

      // Run all timers and flush promises
      await act(async () => {
        vi.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBe('Network error');
        },
        { timeout: 1000 }
      );

      expect(result.current.isConnected).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('State Management', () => {
    it('should set isCapturing from health check', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);

      const { result } = renderHook(() => useApiData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCapturing).toBe(true);
    });

    it('should update isCapturing when startCapture is called', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: false,
        active_flows: 0,
        active_devices: 0,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.startCapture).mockResolvedValue(undefined);

      const { result } = renderHook(() => useApiData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startCapture();
      });

      expect(result.current.isCapturing).toBe(true);
      expect(apiClient.startCapture).toHaveBeenCalled();
    });

    it('should limit flows to 100 items', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      const manyFlows = Array.from({ length: 150 }, (_, i) => ({
        ...mockFlow,
        id: `flow-${i}`,
      }));

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue(manyFlows.slice(0, 100));
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Add more flows via WebSocket
      for (let i = 100; i < 150; i++) {
        act(() => {
          wsCallback?.({
            type: 'flow_update',
            flow: { ...mockFlow, id: `flow-${i}` },
          });
        });
      }

      await waitFor(() => {
        // Should be limited to 100
        expect(result.current.flows.length).toBeLessThanOrEqual(100);
      });
    });

    it('should limit threats to 50 items', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      let wsCallback:
        | ((data: {
            type: string;
            flow?: NetworkFlow;
            device?: Device;
            threat?: Threat;
            devices?: Device[];
            flows?: NetworkFlow[];
            threats?: Threat[];
          }) => void)
        | null = null;

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.connectWebSocket).mockImplementation(callback => {
        wsCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useApiData({ useWebSocket: true }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Add many threats
      for (let i = 0; i < 60; i++) {
        act(() => {
          wsCallback?.({
            type: 'threat_update',
            threat: { ...mockThreat, id: `threat-${i}`, severity: 'low' },
          });
        });
      }

      await waitFor(() => {
        // Should be limited to 50
        expect(result.current.threats.length).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('Polling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should poll at specified interval', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);

      renderHook(() => useApiData({ pollingInterval: 1000 }));

      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalled();
      });

      vi.mocked(apiClient.getFlows).mockClear();
      vi.mocked(apiClient.healthCheck).mockClear();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
        await Promise.resolve();
      });

      expect(apiClient.getFlows).toHaveBeenCalled();
    });

    it('should not poll when pollingInterval is 0', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);

      renderHook(() => useApiData({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalled();
      });

      vi.mocked(apiClient.getFlows).mockClear();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      // Should not have polled (only initial fetch)
      // getFlows might be called during initial fetch, so we check it wasn't called again
      const callCount = vi.mocked(apiClient.getFlows).mock.calls.length;
      // Allow initial call but no additional polling calls
      expect(callCount).toBeLessThanOrEqual(1);
    }, 10000);
  });

  describe('Threat Dismissal', () => {
    it('should update threat as dismissed', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getDevices).mockResolvedValue([]);
      vi.mocked(apiClient.getFlows).mockResolvedValue([]);
      vi.mocked(apiClient.getThreats).mockResolvedValue([mockThreat]);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);
      vi.mocked(apiClient.dismissThreat).mockResolvedValue(undefined);

      const { result } = renderHook(() => useApiData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.dismissThreat('threat-1');
      });

      expect(apiClient.dismissThreat).toHaveBeenCalledWith('threat-1');
      expect(result.current.threats.find(t => t.id === 'threat-1')?.dismissed).toBe(true);
    });
  });
});
