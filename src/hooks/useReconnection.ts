/**
 * Hook for automatic reconnection with exponential backoff
 * Handles connection failures and retries with increasing delays
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseReconnectionOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onReconnect?: () => void;
  onMaxRetriesReached?: () => void;
}

export function useReconnection(options: UseReconnectionOptions = {}) {
  const {
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onReconnect,
    onMaxRetriesReached,
  } = options;

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryDelay, setNextRetryDelay] = useState(initialDelay);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
      return Math.min(delay, maxDelay);
    },
    [initialDelay, backoffMultiplier, maxDelay]
  );

  const attemptReconnect = useCallback(
    async (testConnection: () => Promise<boolean>) => {
      if (retryCountRef.current >= maxRetries) {
        setIsReconnecting(false);
        onMaxRetriesReached?.();
        return;
      }

      setIsReconnecting(true);
      retryCountRef.current += 1;

      try {
        const connected = await testConnection();
        if (connected) {
          // Successfully reconnected
          setIsReconnecting(false);
          setRetryCount(0);
          retryCountRef.current = 0;
          setNextRetryDelay(initialDelay);
          onReconnect?.();
        } else {
          // Still disconnected, schedule next retry
          const delay = calculateDelay(retryCountRef.current);
          setNextRetryDelay(delay);
          setRetryCount(retryCountRef.current);

          timeoutRef.current = setTimeout(() => {
            attemptReconnect(testConnection);
          }, delay);
        }
      } catch (error) {
        // Connection test failed, schedule next retry
        const delay = calculateDelay(retryCountRef.current);
        setNextRetryDelay(delay);
        setRetryCount(retryCountRef.current);

        timeoutRef.current = setTimeout(() => {
          attemptReconnect(testConnection);
        }, delay);
      }
    },
    [maxRetries, calculateDelay, initialDelay, onReconnect, onMaxRetriesReached]
  );

  const startReconnection = useCallback(
    (testConnection: () => Promise<boolean>) => {
      // Reset state
      retryCountRef.current = 0;
      setRetryCount(0);
      setNextRetryDelay(initialDelay);

      // Start reconnection attempts
      attemptReconnect(testConnection);
    },
    [attemptReconnect, initialDelay]
  );

  const stopReconnection = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsReconnecting(false);
    retryCountRef.current = 0;
    setRetryCount(0);
  }, []);

  const reset = useCallback(() => {
    stopReconnection();
    setRetryCount(0);
    retryCountRef.current = 0;
    setNextRetryDelay(initialDelay);
  }, [stopReconnection, initialDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isReconnecting,
    retryCount,
    nextRetryDelay,
    startReconnection,
    stopReconnection,
    reset,
  };
}

