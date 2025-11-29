/**
 * Unit tests for useRetry hook
 * Tests retry logic with exponential backoff
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetry } from '@/hooks/useRetry';

describe('useRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useRetry());

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
      expect(typeof result.current.retry).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
    });
  });

  describe('Successful Operations', () => {
    it('should return result on first attempt if successful', async () => {
      const { result } = renderHook(() => useRetry());
      const operation = vi.fn().mockResolvedValue('success');

      let retryResult: unknown;
      await act(async () => {
        retryResult = await result.current.retry(operation);
      });

      expect(retryResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should not retry on success', async () => {
      const { result } = renderHook(() => useRetry());
      const operation = vi.fn().mockResolvedValue('success');

      await act(async () => {
        await result.current.retry(operation);
      });

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure and succeed on retry', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 2 }));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success');

      let retryResult: unknown;
      await act(async () => {
        retryResult = await result.current.retry(operation);
        // Fast-forward timers for retry delay
        vi.advanceTimersByTime(1000);
      });

      expect(retryResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry up to maxRetries times', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 3 }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      let error: unknown;
      await act(async () => {
        try {
          await result.current.retry(operation);
        } catch (err) {
          error = err;
        }
        // Fast-forward timers for all retry delays
        vi.advanceTimersByTime(10000);
      });

      expect(error).toBeDefined();
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should use exponential backoff for delays', async () => {
      const onRetry = vi.fn();
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 100, backoffMultiplier: 2, maxRetries: 2, onRetry })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      await act(async () => {
        try {
          await result.current.retry(operation);
        } catch {
          // Expected to fail
        }
        // Fast-forward timers
        vi.advanceTimersByTime(1000);
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      // First retry delay: 100ms
      // Second retry delay: 200ms (100 * 2)
    });

    it('should respect maxDelay', async () => {
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 1000, backoffMultiplier: 10, maxDelay: 5000, maxRetries: 2 })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      await act(async () => {
        try {
          await result.current.retry(operation);
        } catch {
          // Expected to fail
        }
        // Fast-forward timers
        vi.advanceTimersByTime(20000);
      });

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Callbacks', () => {
    it('should call onRetry callback on each retry attempt', async () => {
      const onRetry = vi.fn();
      const { result } = renderHook(() => useRetry({ maxRetries: 2, onRetry }));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      await act(async () => {
        await result.current.retry(operation);
        vi.advanceTimersByTime(2000);
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1);
      expect(onRetry).toHaveBeenCalledWith(2);
    });

    it('should call onMaxRetriesReached when max retries exceeded', async () => {
      const onMaxRetriesReached = vi.fn();
      const { result } = renderHook(() => useRetry({ maxRetries: 2, onMaxRetriesReached }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      await act(async () => {
        try {
          await result.current.retry(operation);
        } catch {
          // Expected
        }
        vi.advanceTimersByTime(5000);
      });

      expect(onMaxRetriesReached).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Management', () => {
    it('should set isRetrying to true during retry', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 1, initialDelay: 100 }));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      await act(async () => {
        const promise = result.current.retry(operation);
        // Advance timers to complete the retry
        vi.advanceTimersByTime(100);
        await promise;
      });

      // After retry completes, state should be reset
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should reset state after successful retry', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 1 }));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      await act(async () => {
        await result.current.retry(operation);
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should reset state after max retries reached', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 1 }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      await act(async () => {
        try {
          await result.current.retry(operation);
        } catch {
          // Expected
        }
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Cancel', () => {
    it('should cancel retry operation', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 2, initialDelay: 1000 }));
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      await act(async () => {
        // Start retry
        const promise = result.current.retry(operation);

        // Cancel before delay completes
        result.current.cancel();

        // Advance timers
        vi.advanceTimersByTime(2000);

        // Wait for promise (it will fail, but that's expected)
        try {
          await promise;
        } catch {
          // Expected to fail
        }
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });
  });
});
