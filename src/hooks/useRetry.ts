/**
 * Hook for retrying failed operations with exponential backoff
 * Useful for API calls that may fail temporarily
 */
import { useState, useCallback, useRef, useEffect } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

export function useRetry<T>(options: UseRetryOptions = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
      return Math.min(delay, maxDelay);
    },
    [initialDelay, backoffMultiplier, maxDelay]
  );

  const retry = useCallback(
    async (operation: () => Promise<T>): Promise<T> => {
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          setIsRetrying(attempt > 0);
          setRetryCount(attempt);

          if (attempt > 0) {
            onRetry?.(attempt);
            const delay = calculateDelay(attempt - 1);
            await new Promise(resolve => {
              timeoutRef.current = setTimeout(resolve, delay);
            });
          }

          const result = await operation();

          // Success - reset state
          setIsRetrying(false);
          setRetryCount(0);
          return result;
        } catch (error) {
          attempt++;

          if (attempt > maxRetries) {
            setIsRetrying(false);
            setRetryCount(0);
            onMaxRetriesReached?.();
            throw error;
          }
        }
      }

      throw new Error('Retry failed');
    },
    [maxRetries, calculateDelay, onRetry, onMaxRetriesReached]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRetrying(false);
    setRetryCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    retry,
    isRetrying,
    retryCount,
    cancel,
  };
}
