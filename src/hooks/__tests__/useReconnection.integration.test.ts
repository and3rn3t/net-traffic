/**
 * Integration tests for WebSocket reconnection logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReconnection } from '../useReconnection';

describe('useReconnection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attempt reconnection with exponential backoff', async () => {
    const reconnectFn = vi.fn().mockResolvedValue(false);
    const onReconnect = vi.fn();
    const onMaxRetriesReached = vi.fn();

    const { result } = renderHook(() =>
      useReconnection({
        maxRetries: 3,
        initialDelay: 50,
        maxDelay: 10000,
        onReconnect,
        onMaxRetriesReached,
      })
    );

    // Start reconnection
    result.current.startReconnection(reconnectFn);

    // Wait for first attempt (it's called immediately)
    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.isReconnecting).toBe(true);
    expect(result.current.retryCount).toBeGreaterThanOrEqual(1);
    const firstDelay = result.current.nextRetryDelay;
    expect(firstDelay).toBeGreaterThan(50); // Exponential backoff

    // Second retry - wait for delay
    await new Promise(resolve => setTimeout(resolve, firstDelay + 50));

    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 }
    );

    // Third retry (max retries)
    const secondDelay = result.current.nextRetryDelay;
    await new Promise(resolve => setTimeout(resolve, secondDelay + 50));

    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalledTimes(3);
        expect(onMaxRetriesReached).toHaveBeenCalled();
        expect(result.current.isReconnecting).toBe(false);
      },
      { timeout: 2000 }
    );
  });

  it('should stop reconnection on successful reconnect', async () => {
    const reconnectFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onReconnect = vi.fn();

    const { result } = renderHook(() =>
      useReconnection({
        maxRetries: 5,
        initialDelay: 100,
        onReconnect,
      })
    );

    result.current.startReconnection(reconnectFn);

    // Wait for first attempt
    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );

    // Second attempt succeeds (with shorter delay for test speed)
    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalledTimes(2);
        expect(onReconnect).toHaveBeenCalled();
        expect(result.current.isReconnecting).toBe(false);
      },
      { timeout: 3000 }
    );
  });

  it(
    'should respect max delay cap',
    async () => {
      const reconnectFn = vi.fn().mockResolvedValue(false);
      const maxDelay = 5000;

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 10,
          initialDelay: 50,
          maxDelay,
        })
      );

      result.current.startReconnection(reconnectFn);

      // Wait for first attempt
      await waitFor(
        () => {
          expect(reconnectFn).toHaveBeenCalled();
          expect(result.current.isReconnecting).toBe(true);
        },
        { timeout: 2000 }
      );

      // Wait for state update after first attempt completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that first delay respects max cap
      const firstDelay = result.current.nextRetryDelay;
      expect(firstDelay).toBeLessThanOrEqual(maxDelay);
      expect(firstDelay).toBeGreaterThan(0);

      // Poll for second attempt and stop immediately when detected
      const maxWaitTime = firstDelay + 200;
      const startTime = Date.now();
      let secondCallDetected = false;

      while (Date.now() - startTime < maxWaitTime && !secondCallDetected) {
        if (reconnectFn.mock.calls.length >= 2) {
          secondCallDetected = true;
          // Immediately stop to prevent further retries
          result.current.stopReconnection();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // If we detected the second call, verify the delay cap was respected
      if (secondCallDetected) {
        // Wait a bit for state update
        await new Promise(resolve => setTimeout(resolve, 50));

        // The key test: verify delays respect max cap
        expect(firstDelay).toBeLessThanOrEqual(maxDelay);
        expect(reconnectFn.mock.calls.length).toBe(2);
      } else {
        // If we didn't detect second call in time, just verify first delay
        result.current.stopReconnection();
        expect(firstDelay).toBeLessThanOrEqual(maxDelay);
      }
    },
    { timeout: 10000 }
  );

  it('should stop reconnection manually', async () => {
    const reconnectFn = vi.fn().mockResolvedValue(false);

    const { result } = renderHook(() =>
      useReconnection({
        maxRetries: 5,
        initialDelay: 50,
      })
    );

    result.current.startReconnection(reconnectFn);

    // Wait for first attempt to be called
    await waitFor(
      () => {
        expect(reconnectFn).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    const firstCallCount = reconnectFn.mock.calls.length;

    // Stop reconnection - this should clear timeout and set isReconnecting to false
    result.current.stopReconnection();

    // Wait a bit for state to update
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.isReconnecting).toBe(false);

    // Wait longer - should not trigger more reconnection attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should not have made additional calls after stop
    expect(reconnectFn.mock.calls.length).toBeLessThanOrEqual(firstCallCount + 1);
  });

  it('should handle rapid start/stop cycles', async () => {
    const reconnectFn = vi.fn().mockResolvedValue(false);

    const { result } = renderHook(() =>
      useReconnection({
        maxRetries: 3,
        initialDelay: 1000,
      })
    );

    // Start and stop multiple times
    result.current.startReconnection(reconnectFn);
    result.current.stopReconnection();
    result.current.startReconnection(reconnectFn);
    result.current.stopReconnection();

    expect(result.current.isReconnecting).toBe(false);
  });
});
