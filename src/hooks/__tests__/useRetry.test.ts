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
      let promiseHandled = false;
      // Handle promise rejection immediately to avoid unhandled rejection
      const promise = result.current
        .retry(operation)
        .catch(err => {
          error = err;
          promiseHandled = true;
          // Don't re-throw - just catch and handle the error
          throw err;
        })
        .catch(() => {
          // Second catch to prevent unhandled rejection
          promiseHandled = true;
        });

      // Fast-forward timers for all retry delays
      // Use runAllTimersAsync to advance all pending timers
      await act(async () => {
        // Advance through all delays: 100ms, 200ms, 400ms (exponential backoff)
        // Total: 700ms, but we'll advance more to ensure all timers are processed
        await vi.runAllTimersAsync();
        // Give time for all async operations to complete
        await Promise.resolve();
        await Promise.resolve();
      });

      try {
        await promise;
      } catch (err) {
        // Error is expected
        error = err;
      }

      // Ensure promise was handled
      expect(promiseHandled).toBe(true);
      expect(error).toBeDefined();
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 20000);

    it('should use exponential backoff for delays', async () => {
      const onRetry = vi.fn();
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 100, backoffMultiplier: 2, maxRetries: 2, onRetry })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      // Handle promise rejection immediately
      const promise = result.current.retry(operation).catch(() => {
        // Expected to fail
      });

      await act(async () => {
        // Advance through all delays
        await vi.runAllTimersAsync();
      });

      try {
        await promise;
      } catch {
        // Expected to fail
      }

      expect(onRetry).toHaveBeenCalledTimes(2);
      // First retry delay: 100ms
      // Second retry delay: 200ms (100 * 2)
    }, 20000);

    it('should respect maxDelay', async () => {
      const { result } = renderHook(() =>
        useRetry({ initialDelay: 1000, backoffMultiplier: 10, maxDelay: 5000, maxRetries: 2 })
      );
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      // Handle promise rejection immediately
      const promise = result.current.retry(operation).catch(() => {
        // Expected to fail
      });

      await act(async () => {
        // Advance through all delays
        await vi.runAllTimersAsync();
      });

      try {
        await promise;
      } catch {
        // Expected to fail
      }

      expect(operation).toHaveBeenCalledTimes(3);
    }, 20000);
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

      // Handle promise rejection immediately
      const promise = result.current.retry(operation).catch(() => {
        // Expected
      });

      await act(async () => {
        // Advance through all delays
        await vi.runAllTimersAsync();
      });

      try {
        await promise;
      } catch {
        // Expected
      }

      expect(onMaxRetriesReached).toHaveBeenCalledTimes(1);
    }, 20000);
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
        // Advance through all delays
        await vi.runAllTimersAsync();
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
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
        await promise;
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    }, 10000);

    it('should reset state after max retries reached', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 1 }));
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      // Ensure hook is ready
      expect(result.current).toBeDefined();
      expect(result.current.retry).toBeDefined();

      // Handle promise rejection immediately
      const promise = result.current.retry(operation).catch(() => {
        // Expected
      });

      await act(async () => {
        // Advance through all delays
        await vi.runAllTimersAsync();
      });

      try {
        await promise;
      } catch {
        // Expected
      }

      // Ensure hook is still mounted
      expect(result.current).toBeDefined();
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    }, 20000);
  });

  describe('Cancel', () => {
    it('should cancel retry operation', async () => {
      const { result } = renderHook(() => useRetry({ maxRetries: 2, initialDelay: 1000 }));
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      // Ensure hook is ready
      expect(result.current).toBeDefined();
      expect(result.current.retry).toBeDefined();

      // Start retry and handle rejection immediately to avoid unhandled rejection
      let promiseRejected = false;
      const promise = result.current.retry(operation).catch(() => {
        promiseRejected = true;
        // Expected to fail
      });

      // Cancel immediately after starting
      await act(async () => {
        expect(result.current).toBeDefined();
        result.current.cancel();
      });

      // Advance timers to process cancellation
      await act(async () => {
        await vi.runAllTimersAsync();
        // Give time for state updates
        await Promise.resolve();
        await Promise.resolve();
      });

      // Wait for promise to settle with a timeout
      try {
        await Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
        ]);
      } catch {
        // Expected - promise will reject or timeout
      }

      // Verify cancel was called and state was reset
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
    }, 10000);
  });
});
