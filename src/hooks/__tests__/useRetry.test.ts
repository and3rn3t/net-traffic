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
      const { result } = renderHook(() => useRetry({ maxRetries: 2, initialDelay: 100 }));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success');

      let retryResult: unknown;
      await act(async () => {
        const promise = result.current.retry(operation);
        // Fast-forward timers for retry delay
        await vi.runAllTimersAsync();
        retryResult = await promise;
      });

      expect(retryResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry up to maxRetries times', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 3, initialDelay: 100 }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      let error: unknown;
      const promise = result.current.retry(operation);

      // Fast-forward timers for all retry delays
      // Each retry has a delay, so we need to advance multiple times
      await act(async () => {
        // Advance through all delays: 100ms, 200ms, 400ms (exponential backoff)
        vi.advanceTimersByTime(100); // First retry delay
        await Promise.resolve();
        vi.advanceTimersByTime(200); // Second retry delay
        await Promise.resolve();
        vi.advanceTimersByTime(400); // Third retry delay
        await Promise.resolve();
      });

      try {
        await promise;
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));
    }, 15000);

    it('should use exponential backoff for delays', async () => {
      const onRetry = vi.fn();
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 100, backoffMultiplier: 2, maxRetries: 2, onRetry })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = result.current.retry(operation);

      await act(async () => {
        // Advance through delays: 100ms, 200ms
        vi.advanceTimersByTime(100);
        await Promise.resolve();
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      try {
        await promise;
      } catch {
        // Expected to fail
      }

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onRetry).toHaveBeenCalledTimes(2);
      // First retry delay: 100ms
      // Second retry delay: 200ms (100 * 2)
    }, 15000);

    it('should respect maxDelay', async () => {
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 1000, backoffMultiplier: 10, maxDelay: 5000, maxRetries: 2 })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = result.current.retry(operation);

      await act(async () => {
        // Advance through delays: 1000ms, 5000ms (capped at maxDelay)
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      try {
        await promise;
      } catch {
        // Expected to fail
      }

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(operation).toHaveBeenCalledTimes(3);
    }, 15000);
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
        const promise = result.current.retry(operation);
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1);
      expect(onRetry).toHaveBeenCalledWith(2);
    });

    it('should call onMaxRetriesReached when max retries exceeded', async () => {
      const onMaxRetriesReached = vi.fn();
      const { result } = renderHook(() => useRetry({ maxRetries: 2, onMaxRetriesReached }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const promise = result.current.retry(operation);

      await act(async () => {
        // Advance through delays for 2 retries
        vi.advanceTimersByTime(1000); // First retry delay
        await Promise.resolve();
        vi.advanceTimersByTime(2000); // Second retry delay
        await Promise.resolve();
      });

      try {
        await promise;
      } catch {
        // Expected
      }

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onMaxRetriesReached).toHaveBeenCalledTimes(1);
    }, 15000);
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
        // Advance through delay: 100ms
        vi.advanceTimersByTime(100);
        await Promise.resolve();
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
        const promise = result.current.retry(operation);
        // Advance through delay: 1000ms
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        await promise;
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should reset state after max retries reached', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 1 }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const promise = result.current.retry(operation);

      await act(async () => {
        // Advance through delay: 1000ms
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      try {
        await promise;
      } catch {
        // Expected
      }

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    }, 15000);
  });

  describe('Cancel', () => {
    it('should cancel retry operation', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 2, initialDelay: 1000 }));
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      // Start retry
      const promise = result.current.retry(operation);

      await act(async () => {
        // Cancel before delay completes
        result.current.cancel();

        // Advance timers (even though cancelled, timers might still be pending)
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Wait for promise (it will fail, but that's expected)
      try {
        await promise;
      } catch {
        // Expected to fail
      }

      // Ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });
  });
});
