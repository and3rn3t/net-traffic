/**
 * Unit tests for useHistoricalTrends hook
 * Tests historical data fetching, caching, and time range management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useHistoricalTrends } from '@/hooks/useHistoricalTrends';
import { apiClient } from '@/lib/api';

// Mock dependencies
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

describe('useHistoricalTrends', () => {
  let cacheCleared = false;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use real timers for async API calls
    // Set default mock return value
    vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);

    // Clear the cache by calling clearCache on a hook instance
    // We need to ensure cache is cleared between tests
    if (!cacheCleared) {
      const { result, unmount } = renderHook(() => useHistoricalTrends({ autoFetch: false }));
      result.current.clearCache();
      unmount();
      cacheCleared = true;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clear cache after each test as well
    const { result, unmount } = renderHook(() => useHistoricalTrends({ autoFetch: false }));
    result.current.clearCache();
    unmount();
  });

  describe('Initial State', () => {
    it('should initialize with default time range', () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      expect(result.current.timeRange).toBe('24h');
      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should initialize with custom time range', () => {
      const { result } = renderHook(() =>
        useHistoricalTrends({ initialTimeRange: '7d', autoFetch: false })
      );

      expect(result.current.timeRange).toBe('7d');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data when autoFetch is enabled', async () => {
      const mockData = [
        {
          timestamp: Date.now(),
          totalBytes: 1000,
          totalConnections: 10,
          threatCount: 0,
          activeDevices: 5,
        },
      ];

      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: true }));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
          expect(apiClient.getAnalytics).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );

      expect(apiClient.getAnalytics).toHaveBeenCalledWith(24); // 24h = 24 hours
      expect(result.current.data).toEqual(mockData);
    }, 15000);

    it('should not fetch data when autoFetch is disabled', async () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      // Wait a bit to ensure no fetch occurs
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(apiClient.getAnalytics).not.toHaveBeenCalled();
    });

    it('should convert time ranges to correct hours', async () => {
      const mockData: never[] = [];
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result: _result } = renderHook(
        ({ timeRange }) => useHistoricalTrends({ initialTimeRange: timeRange, autoFetch: true }),
        { initialProps: { timeRange: '1h' as const } }
      );

      // Wait for initial fetch
      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      // Clear mock to count new calls
      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        _result.current.updateTimeRange('24h');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(24);
        },
        { timeout: 5000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        _result.current.updateTimeRange('7d');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(168); // 7 * 24
        },
        { timeout: 5000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        _result.current.updateTimeRange('30d');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(720); // 30 * 24
        },
        { timeout: 5000 }
      );
    }, 60000);

    it('should handle API errors', async () => {
      // Clear cache before test
      const { result: clearResult, unmount: clearUnmount } = renderHook(() =>
        useHistoricalTrends({ autoFetch: false })
      );
      clearResult.current.clearCache();
      clearUnmount();

      const error = new Error('API Error');
      vi.mocked(apiClient.getAnalytics).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: false })
      );

      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toEqual([]);
    }, 15000);
  });

  describe('Caching', () => {
    it('should use cached data when available', async () => {
      // Clear cache before test
      const { result: clearResult, unmount: clearUnmount } = renderHook(() =>
        useHistoricalTrends({ autoFetch: false })
      );
      clearResult.current.clearCache();
      clearUnmount();

      const mockData = [
        {
          timestamp: Date.now(),
          totalBytes: 1000,
          totalConnections: 10,
          threatCount: 0,
          activeDevices: 5,
        },
      ];

      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: true })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(mockData);
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Get the initial call count (should be 1 for the initial '24h' fetch)
      const initialCallCount = vi.mocked(apiClient.getAnalytics).mock.calls.length;
      expect(initialCallCount).toBeGreaterThan(0);

      // Clear the mock to verify cache is used
      vi.mocked(apiClient.getAnalytics).mockClear();

      // Change time range to '7d' (will fetch new data, not cached)
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(
        () => {
          expect(result.current.timeRange).toBe('7d');
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Verify API was called for '7d'
      expect(apiClient.getAnalytics).toHaveBeenCalledWith(168); // 7d = 168 hours
      const callsAfter7d = vi.mocked(apiClient.getAnalytics).mock.calls.length;

      // Clear mock again before switching back to '24h'
      vi.mocked(apiClient.getAnalytics).mockClear();

      // Now change back to '24h' - should use cache, not call API
      act(() => {
        result.current.updateTimeRange('24h');
      });

      // Wait for the timeRange to update and cache to be checked
      await waitFor(
        () => {
          expect(result.current.timeRange).toBe('24h');
          // Data should still be available from cache
          expect(result.current.data).toEqual(mockData);
        },
        { timeout: 10000 }
      );

      // Wait a bit more to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not call API again for cached data
      // The mock was cleared after '7d' fetch, so if cache works, no new calls should be made
      expect(apiClient.getAnalytics).not.toHaveBeenCalled();
    }, 60000);

    it('should bypass cache when refresh is called', async () => {
      // Clear cache before test
      const { result: clearResult, unmount: clearUnmount } = renderHook(() =>
        useHistoricalTrends({ autoFetch: false })
      );
      clearResult.current.clearCache();
      clearUnmount();

      const mockData = [
        {
          timestamp: Date.now(),
          totalBytes: 1000,
          totalConnections: 10,
          threatCount: 0,
          activeDevices: 5,
        },
      ];

      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: true })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(mockData);
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        result.current.refresh();
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );
    }, 30000);

    it('should clear cache when clearCache is called', async () => {
      // Clear cache before test
      const { result: clearResult, unmount: clearUnmount } = renderHook(() =>
        useHistoricalTrends({ autoFetch: false })
      );
      clearResult.current.clearCache();
      clearUnmount();

      const mockData = [
        {
          timestamp: Date.now(),
          totalBytes: 1000,
          totalConnections: 10,
          threatCount: 0,
          activeDevices: 5,
        },
      ];

      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: true })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(mockData);
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.clearCache();
      });

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      // Change time range - should fetch again since cache was cleared
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(
        () => {
          expect(result.current.timeRange).toBe('7d');
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );
    }, 60000);

    it('should not use cache when cacheEnabled is false', async () => {
      const mockData = [
        {
          timestamp: Date.now(),
          totalBytes: 1000,
          totalConnections: 10,
          threatCount: 0,
          activeDevices: 5,
        },
      ];

      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: false })
      );

      await waitFor(
        () => {
          expect(result.current.data).toEqual(mockData);
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 5000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      // Change time range and back - should fetch again
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(168); // 7d = 168 hours
        },
        { timeout: 5000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(24); // 24h = 24 hours
        },
        { timeout: 5000 }
      );
    }, 60000);
  });

  describe('Time Range Updates', () => {
    it('should update time range', () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      // Hook should be initialized immediately
      expect(result.current).toBeDefined();
      expect(result.current.updateTimeRange).toBeDefined();

      act(() => {
        result.current.updateTimeRange('7d');
      });

      expect(result.current.timeRange).toBe('7d');
    });

    it('should fetch data when time range is updated with autoFetch enabled', async () => {
      // Clear cache before test
      const { result: clearResult, unmount: clearUnmount } = renderHook(() =>
        useHistoricalTrends({ autoFetch: false })
      );
      clearResult.current.clearCache();
      clearUnmount();

      const mockData: never[] = [];
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useHistoricalTrends({ autoFetch: true, cacheEnabled: false })
      );

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalled();
        },
        { timeout: 10000 }
      );

      vi.mocked(apiClient.getAnalytics).mockClear();
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(
        () => {
          expect(apiClient.getAnalytics).toHaveBeenCalledWith(168);
        },
        { timeout: 10000 }
      );
    }, 30000);

    it('should not fetch data when time range is updated with autoFetch disabled', async () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      // Hook should be initialized immediately
      expect(result.current).toBeDefined();
      expect(result.current.updateTimeRange).toBeDefined();

      expect(result.current).toBeDefined();
      expect(result.current?.updateTimeRange).toBeDefined();

      act(() => {
        if (result.current?.updateTimeRange) {
          result.current.updateTimeRange('7d');
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(apiClient.getAnalytics).not.toHaveBeenCalled();
    });
  });
});
