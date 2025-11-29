/**
 * Unit tests for useGracefulDegradation hook
 * Tests fallback logic, caching, and data selection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGracefulDegradation } from '@/hooks/useGracefulDegradation';

// Mock useOfflineDetection
vi.mock('@/hooks/useOfflineDetection', () => ({
  useOfflineDetection: vi.fn(() => ({
    isOnline: true,
    lastOnlineTime: new Date(),
  })),
}));

describe('useGracefulDegradation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Data Selection', () => {
    it('should use API data when API is available', () => {
      const apiData = { count: 10 };
      const fallbackData = { count: 0 };

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: true,
        })
      );

      expect(result.current.data).toEqual(apiData);
      expect(result.current.isUsingFallback).toBe(false);
    });

    it('should use fallback data when API is unavailable and no cache', () => {
      const apiData = null;
      const fallbackData = { count: 0 };

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: false,
        })
      );

      expect(result.current.data).toEqual(fallbackData);
      expect(result.current.isUsingFallback).toBe(true);
    });

    it('should use cached data when API is unavailable', () => {
      const cachedData = { count: 5 };
      const fallbackData = { count: 0 };

      // Set up cache
      localStorage.setItem(
        'test-cache',
        JSON.stringify({
          data: cachedData,
          timestamp: Date.now(),
        })
      );

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
        })
      );

      expect(result.current.data).toEqual(cachedData);
      expect(result.current.isUsingFallback).toBe(true);
      expect(result.current.hasCachedData).toBe(true);
    });
  });

  describe('Caching', () => {
    it('should save API data to cache when cacheKey is provided', () => {
      const apiData = { count: 10 };
      const fallbackData = { count: 0 };

      renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: true,
          cacheKey: 'test-cache',
        })
      );

      const cached = localStorage.getItem('test-cache');
      expect(cached).toBeTruthy();

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        expect(data).toEqual(apiData);
        expect(timestamp).toBeGreaterThan(0);
      }
    });

    it('should not save to cache when cacheKey is not provided', () => {
      const apiData = { count: 10 };
      const fallbackData = { count: 0 };

      renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: true,
        })
      );

      // Should not have any cache entries
      expect(localStorage.length).toBe(0);
    });

    it('should not save to cache when API is unavailable', () => {
      const apiData = null;
      const fallbackData = { count: 0 };

      renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
        })
      );

      expect(localStorage.getItem('test-cache')).toBeNull();
    });

    it('should load valid cached data on mount', () => {
      const cachedData = { count: 5 };
      const fallbackData = { count: 0 };

      localStorage.setItem(
        'test-cache',
        JSON.stringify({
          data: cachedData,
          timestamp: Date.now() - 1000, // 1 second ago
        })
      );

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
          cacheDuration: 5 * 60 * 1000, // 5 minutes
        })
      );

      expect(result.current.data).toEqual(cachedData);
      expect(result.current.hasCachedData).toBe(true);
    });

    it('should ignore expired cached data', () => {
      const cachedData = { count: 5 };
      const fallbackData = { count: 0 };

      localStorage.setItem(
        'test-cache',
        JSON.stringify({
          data: cachedData,
          timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        })
      );

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
          cacheDuration: 5 * 60 * 1000, // 5 minutes
        })
      );

      expect(result.current.data).toEqual(fallbackData);
      expect(result.current.hasCachedData).toBe(false);
      expect(localStorage.getItem('test-cache')).toBeNull(); // Should be removed
    });

    it('should handle invalid cached data gracefully', () => {
      const fallbackData = { count: 0 };

      // Set invalid cache data
      localStorage.setItem('test-cache', 'invalid json');

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
        })
      );

      expect(result.current.data).toEqual(fallbackData);
      expect(result.current.hasCachedData).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should update when API data changes', () => {
      const fallbackData = { count: 0 };
      const { result, rerender } = renderHook(
        ({ apiData }) =>
          useGracefulDegradation({
            apiData,
            fallbackData,
            isApiAvailable: true,
          }),
        {
          initialProps: { apiData: { count: 10 } },
        }
      );

      expect(result.current.data).toEqual({ count: 10 });

      rerender({ apiData: { count: 20 } });

      expect(result.current.data).toEqual({ count: 20 });
    });

    it('should update when API availability changes', () => {
      const apiData = { count: 10 };
      const fallbackData = { count: 0 };

      const { result, rerender } = renderHook(
        ({ isApiAvailable }) =>
          useGracefulDegradation({
            apiData,
            fallbackData,
            isApiAvailable,
          }),
        {
          initialProps: { isApiAvailable: true },
        }
      );

      expect(result.current.data).toEqual(apiData);
      expect(result.current.isUsingFallback).toBe(false);

      rerender({ isApiAvailable: false });

      expect(result.current.data).toEqual(fallbackData);
      expect(result.current.isUsingFallback).toBe(true);
    });

    it('should return correct isApiAvailable value', () => {
      const { result, rerender } = renderHook(
        ({ isApiAvailable }) =>
          useGracefulDegradation({
            apiData: { count: 10 },
            fallbackData: { count: 0 },
            isApiAvailable,
          }),
        {
          initialProps: { isApiAvailable: true },
        }
      );

      expect(result.current.isApiAvailable).toBe(true);

      rerender({ isApiAvailable: false });

      expect(result.current.isApiAvailable).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const apiData = { count: 10 };
      const fallbackData = { count: 0 };

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData,
          fallbackData,
          isApiAvailable: true,
          cacheKey: 'test-cache',
        })
      );

      // Should still work, just without caching
      expect(result.current.data).toEqual(apiData);

      localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage read errors gracefully', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage read error');
      });

      const fallbackData = { count: 0 };

      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
        })
      );

      // Should fall back to fallbackData
      expect(result.current.data).toEqual(fallbackData);

      localStorage.getItem = originalGetItem;
    });
  });

  describe('Custom Cache Duration', () => {
    it('should respect custom cache duration', () => {
      const cachedData = { count: 5 };
      const fallbackData = { count: 0 };

      localStorage.setItem(
        'test-cache',
        JSON.stringify({
          data: cachedData,
          timestamp: Date.now() - 2000, // 2 seconds ago
        })
      );

      // Cache duration of 1 second (expired)
      const { result } = renderHook(() =>
        useGracefulDegradation({
          apiData: null,
          fallbackData,
          isApiAvailable: false,
          cacheKey: 'test-cache',
          cacheDuration: 1000, // 1 second
        })
      );

      expect(result.current.data).toEqual(fallbackData);
      expect(result.current.hasCachedData).toBe(false);
    });
  });
});
