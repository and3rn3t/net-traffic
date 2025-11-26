/**
 * Hook for graceful degradation when API is unavailable
 * Falls back to cached/mock data when backend is offline
 */
import { useState, useEffect, useCallback } from 'react';
import { useOfflineDetection } from './useOfflineDetection';

interface UseGracefulDegradationOptions<T> {
  apiData: T | null;
  fallbackData: T;
  isApiAvailable: boolean;
  cacheKey?: string;
  cacheDuration?: number; // ms
}

export function useGracefulDegradation<T>(options: UseGracefulDegradationOptions<T>) {
  const {
    apiData,
    fallbackData,
    isApiAvailable,
    cacheKey,
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
  } = options;

  const { isOnline } = useOfflineDetection();
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Load cached data from localStorage
  useEffect(() => {
    if (!cacheKey) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        if (age < cacheDuration) {
          setCachedData(data);
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      console.error('Failed to load cached data:', e);
    }
  }, [cacheKey, cacheDuration]);

  // Save API data to cache
  useEffect(() => {
    if (apiData && cacheKey && isApiAvailable) {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: apiData,
            timestamp: Date.now(),
          })
        );
        setCachedData(apiData);
      } catch (e) {
        console.error('Failed to cache data:', e);
      }
    }
  }, [apiData, cacheKey, isApiAvailable]);

  // Determine which data to use
  const effectiveData = useCallback((): T => {
    if (isApiAvailable && apiData) {
      setIsUsingFallback(false);
      return apiData;
    }

    if (cachedData) {
      setIsUsingFallback(true);
      return cachedData;
    }

    setIsUsingFallback(true);
    return fallbackData;
  }, [isApiAvailable, apiData, cachedData, fallbackData]);

  const data = effectiveData();

  return {
    data,
    isUsingFallback,
    isOnline,
    isApiAvailable,
    hasCachedData: cachedData !== null,
  };
}
