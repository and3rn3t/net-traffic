/**
 * Hook for detecting offline/online status
 * Provides network connectivity monitoring
 */
import { useState, useEffect, useCallback } from 'react';

interface UseOfflineDetectionOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  checkInterval?: number; // ms, 0 to disable periodic checks
}

export function useOfflineDetection(options: UseOfflineDetectionOptions = {}) {
  const { onOnline, onOffline, checkInterval = 0 } = options;

  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(() => {
    return typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null;
  });

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnlineTime(new Date());
    onOnline?.();
  }, [onOnline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    onOffline?.();
  }, [onOffline]);

  // Listen to browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Optional: Periodic connectivity check via API
  useEffect(() => {
    if (checkInterval === 0 || typeof window === 'undefined') return;

    const checkConnectivity = async () => {
      try {
        // Try to fetch a small resource to verify connectivity
        const response = await fetch('/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
        });

        if (response.ok && !isOnline) {
          handleOnline();
        } else if (!response.ok && isOnline) {
          handleOffline();
        }
      } catch (error) {
        if (isOnline) {
          handleOffline();
        }
      }
    };

    const interval = setInterval(checkConnectivity, checkInterval);
    return () => clearInterval(interval);
  }, [checkInterval, isOnline, handleOnline, handleOffline]);

  return {
    isOnline,
    lastOnlineTime,
  };
}
