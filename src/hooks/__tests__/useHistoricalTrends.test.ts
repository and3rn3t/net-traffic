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
    getAnalytics: vi.fn(),
  },
}));

describe('useHistoricalTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
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

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(apiClient.getAnalytics).toHaveBeenCalledWith(24); // 24h = 24 hours
      expect(result.current.data).toEqual(mockData);
    });

    it('should not fetch data when autoFetch is disabled', async () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      // Wait a bit to ensure no fetch occurs
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(apiClient.getAnalytics).not.toHaveBeenCalled();
    });

    it('should convert time ranges to correct hours', async () => {
      const mockData: never[] = [];
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result: _result } = renderHook(
        ({ timeRange }) => useHistoricalTrends({ initialTimeRange: timeRange, autoFetch: true }),
        { initialProps: { timeRange: '1h' as const } }
      );

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalledWith(1);
      });

      act(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalledWith(24);
      });

      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalledWith(168); // 7 * 24
      });

      act(() => {
        result.current.updateTimeRange('30d');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalledWith(720); // 30 * 24
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.getAnalytics).mockRejectedValue(error);

      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should use cached data when available', async () => {
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

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      // Clear the mock to verify cache is used
      vi.mocked(apiClient.getAnalytics).mockClear();

      // Change time range and back (should use cache)
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(() => {
        expect(result.current.timeRange).toBe('7d');
      });

      act(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(() => {
        // Should not call API again for cached data
        expect(apiClient.getAnalytics).not.toHaveBeenCalled();
      });
    });

    it('should bypass cache when refresh is called', async () => {
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

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      vi.mocked(apiClient.getAnalytics).mockClear();

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalled();
      });
    });

    it('should clear cache when clearCache is called', async () => {
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

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      act(() => {
        result.current.clearCache();
      });

      vi.mocked(apiClient.getAnalytics).mockClear();

      // Change time range - should fetch again since cache was cleared
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalled();
      });
    });

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

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      vi.mocked(apiClient.getAnalytics).mockClear();

      // Change time range and back - should fetch again
      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(() => {
        result.current.updateTimeRange('24h');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalled();
      });
    });
  });

  describe('Time Range Updates', () => {
    it('should update time range', () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      act(() => {
        result.current.updateTimeRange('7d');
      });

      expect(result.current.timeRange).toBe('7d');
    });

    it('should fetch data when time range is updated with autoFetch enabled', async () => {
      const mockData: never[] = [];
      vi.mocked(apiClient.getAnalytics).mockResolvedValue(mockData);

      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: true }));

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalled();
      });

      vi.mocked(apiClient.getAnalytics).mockClear();

      act(() => {
        result.current.updateTimeRange('7d');
      });

      await waitFor(() => {
        expect(apiClient.getAnalytics).toHaveBeenCalledWith(168);
      });
    });

    it('should not fetch data when time range is updated with autoFetch disabled', async () => {
      const { result } = renderHook(() => useHistoricalTrends({ autoFetch: false }));

      act(() => {
        result.current.updateTimeRange('7d');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(apiClient.getAnalytics).not.toHaveBeenCalled();
    });
  });
});
