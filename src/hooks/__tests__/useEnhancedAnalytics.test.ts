/**
 * Unit tests for useEnhancedAnalytics hook
 * Tests analytics data fetching and state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { apiClient } from '@/lib/api';

// Mock apiClient
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

// Mock environment variable
vi.mock('import.meta', () => ({
  env: {
    VITE_USE_REAL_API: 'true',
  },
}));

const mockSummaryStats = {
  total_devices: 10,
  active_devices: 8,
  total_flows: 100,
  active_flows: 50,
  total_bytes: 1000000,
  total_threats: 5,
  active_threats: 3,
  critical_threats: 1,
  oldest_flow_timestamp: Date.now() - 86400000,
  newest_flow_timestamp: Date.now(),
  capture_duration_hours: 24,
};

const mockTopDomains = [
  { domain: 'example.com', connections: 50, bytes: 500000, unique_devices: 3 },
  { domain: 'test.com', connections: 30, bytes: 300000, unique_devices: 2 },
];

const mockTopDevices = [
  {
    device_id: '1',
    device_name: 'Device 1',
    device_ip: '192.168.1.1',
    device_type: 'desktop',
    bytes: 500000,
    connections: 50,
    threats: 2,
  },
];

const mockGeographicStats = [
  { country: 'US', connections: 100, bytes: 1000000, threats: 5 },
  { country: 'UK', connections: 50, bytes: 500000, threats: 2 },
];

const mockBandwidthTimeline = [
  {
    timestamp: Date.now() - 3600000,
    bytes_in: 100000,
    bytes_out: 50000,
    packets: 1000,
    connections: 10,
  },
];

describe('useEnhancedAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      expect(result.current.summaryStats).toBeNull();
      expect(result.current.topDomains).toEqual([]);
      expect(result.current.topDevices).toEqual([]);
      expect(result.current.geographicStats).toEqual([]);
      expect(result.current.bandwidthTimeline).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Auto Fetch', () => {
    it('should fetch all data on mount when autoFetch is true', async () => {
      vi.mocked(apiClient.getSummaryStats).mockResolvedValue(mockSummaryStats);
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);
      vi.mocked(apiClient.getTopDevices).mockResolvedValue(mockTopDevices);
      vi.mocked(apiClient.getGeographicStats).mockResolvedValue(mockGeographicStats);
      vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(mockBandwidthTimeline);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: true, hours: 24 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.getSummaryStats).toHaveBeenCalled();
      expect(apiClient.getTopDomains).toHaveBeenCalledWith(20, 24);
      expect(apiClient.getTopDevices).toHaveBeenCalledWith(10, 24, 'bytes');
      expect(apiClient.getGeographicStats).toHaveBeenCalledWith(24);
      expect(apiClient.getBandwidthTimeline).toHaveBeenCalledWith(24, 5);
    });

    it('should not fetch on mount when autoFetch is false', () => {
      renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      expect(apiClient.getSummaryStats).not.toHaveBeenCalled();
      expect(apiClient.getTopDomains).not.toHaveBeenCalled();
    });
  });

  describe('fetchSummaryStats', () => {
    it('should fetch and set summary stats', async () => {
      vi.mocked(apiClient.getSummaryStats).mockResolvedValue(mockSummaryStats);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.fetchSummaryStats();

      await waitFor(() => {
        expect(apiClient.getSummaryStats).toHaveBeenCalled();
        expect(result.current.summaryStats).toEqual(mockSummaryStats);
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(apiClient.getSummaryStats).mockRejectedValue(error);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.fetchSummaryStats();

      await waitFor(() => {
        expect(result.current.summaryStats).toBeNull();
        // Hook sets error message from the caught error
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should return null when API is not available', async () => {
      // Mock environment variable before hook is used
      vi.stubEnv('VITE_USE_REAL_API', 'false');

      // Re-import the hook to get the new USE_REAL_API value
      const { useEnhancedAnalytics: useEnhancedAnalyticsMocked } = await import(
        '@/hooks/useEnhancedAnalytics'
      );

      const { result } = renderHook(() => useEnhancedAnalyticsMocked({ autoFetch: false }));

      const stats = await result.current.fetchSummaryStats();

      expect(stats).toBeNull();
      expect(apiClient.getSummaryStats).not.toHaveBeenCalled();

      // Restore env
      vi.unstubAllEnvs();
    });
  });

  describe('fetchTopDomains', () => {
    it('should fetch and set top domains', async () => {
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.fetchTopDomains(20, 24);

      await waitFor(() => {
        expect(apiClient.getTopDomains).toHaveBeenCalledWith(20, 24);
      });

      await waitFor(() => {
        expect(result.current.topDomains).toEqual(mockTopDomains);
      });
    });

    it('should use default limit and hours', async () => {
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 48 }));

      await result.current.fetchTopDomains();

      expect(apiClient.getTopDomains).toHaveBeenCalledWith(20, 48);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(apiClient.getTopDomains).mockRejectedValue(error);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.fetchTopDomains();

      await waitFor(() => {
        expect(result.current.topDomains).toEqual([]);
        expect(result.current.error).toBe('Failed to fetch');
      });
    });
  });

  describe('fetchTopDevices', () => {
    it('should fetch and set top devices', async () => {
      vi.mocked(apiClient.getTopDevices).mockResolvedValue(mockTopDevices);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.fetchTopDevices(10, 24, 'bytes');

      await waitFor(() => {
        expect(apiClient.getTopDevices).toHaveBeenCalledWith(10, 24, 'bytes');
        expect(result.current.topDevices).toEqual(mockTopDevices);
      });
    });

    it('should support different sortBy options', async () => {
      vi.mocked(apiClient.getTopDevices).mockResolvedValue(mockTopDevices);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.fetchTopDevices(10, 24, 'connections');
      expect(apiClient.getTopDevices).toHaveBeenCalledWith(10, 24, 'connections');

      await result.current.fetchTopDevices(10, 24, 'threats');
      expect(apiClient.getTopDevices).toHaveBeenCalledWith(10, 24, 'threats');
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(apiClient.getTopDevices).mockRejectedValue(error);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.fetchTopDevices();

      await waitFor(() => {
        expect(result.current.topDevices).toEqual([]);
        expect(result.current.error).toBe('Failed to fetch');
      });
    });
  });

  describe('fetchGeographicStats', () => {
    it('should fetch and set geographic stats', async () => {
      vi.mocked(apiClient.getGeographicStats).mockResolvedValue(mockGeographicStats);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.fetchGeographicStats(24);

      await waitFor(() => {
        expect(apiClient.getGeographicStats).toHaveBeenCalledWith(24);
        expect(result.current.geographicStats).toEqual(mockGeographicStats);
      });
    });

    it('should use default hours', async () => {
      vi.mocked(apiClient.getGeographicStats).mockResolvedValue(mockGeographicStats);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 48 }));

      await result.current.fetchGeographicStats();

      expect(apiClient.getGeographicStats).toHaveBeenCalledWith(48);
    });
  });

  describe('fetchBandwidthTimeline', () => {
    it('should fetch and set bandwidth timeline', async () => {
      vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(mockBandwidthTimeline);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.fetchBandwidthTimeline(24, 5);

      await waitFor(() => {
        expect(apiClient.getBandwidthTimeline).toHaveBeenCalledWith(24, 5);
        expect(result.current.bandwidthTimeline).toEqual(mockBandwidthTimeline);
      });
    });

    it('should use default interval', async () => {
      vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(mockBandwidthTimeline);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.fetchBandwidthTimeline();

      expect(apiClient.getBandwidthTimeline).toHaveBeenCalledWith(24, 5);
    });
  });

  describe('fetchAll', () => {
    it('should fetch all analytics data', async () => {
      vi.mocked(apiClient.getSummaryStats).mockResolvedValue(mockSummaryStats);
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);
      vi.mocked(apiClient.getTopDevices).mockResolvedValue(mockTopDevices);
      vi.mocked(apiClient.getGeographicStats).mockResolvedValue(mockGeographicStats);
      vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(mockBandwidthTimeline);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 24 }));

      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaryStats).toEqual(mockSummaryStats);
      expect(result.current.topDomains).toEqual(mockTopDomains);
      expect(result.current.topDevices).toEqual(mockTopDevices);
      expect(result.current.geographicStats).toEqual(mockGeographicStats);
      expect(result.current.bandwidthTimeline).toEqual(mockBandwidthTimeline);
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(apiClient.getSummaryStats).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSummaryStats), 100))
      );
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);
      vi.mocked(apiClient.getTopDevices).mockResolvedValue(mockTopDevices);
      vi.mocked(apiClient.getGeographicStats).mockResolvedValue(mockGeographicStats);
      vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(mockBandwidthTimeline);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      const refreshPromise = result.current.refresh();

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      await refreshPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle errors in fetchAll', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(apiClient.getSummaryStats).mockRejectedValue(error);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false }));

      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch');
    });
  });

  describe('Custom Hours', () => {
    it('should use custom hours value', async () => {
      vi.mocked(apiClient.getTopDomains).mockResolvedValue(mockTopDomains);

      const { result } = renderHook(() => useEnhancedAnalytics({ autoFetch: false, hours: 48 }));

      await result.current.fetchTopDomains();

      expect(apiClient.getTopDomains).toHaveBeenCalledWith(20, 48);
    });
  });
});
