/**
 * Integration tests for WebSocket functionality
 * Tests reconnection logic and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useReconnection } from '@/hooks/useReconnection';
import { renderHook, waitFor } from '@testing-library/react';

describe('WebSocket Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failed');
        }
        return true;
      });

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 5,
          initialDelay: 100,
          maxDelay: 1000,
          onReconnect: vi.fn(),
        })
      );

      const startTime = Date.now();
      result.current.startReconnection(mockOperation);

      // Wait for reconnection to complete
      await waitFor(
        () => {
          expect(mockOperation).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      const endTime = Date.now();
      expect(mockOperation).toHaveBeenCalledTimes(3);
      // Should have delays between retries (exponential backoff)
      expect(endTime - startTime).toBeGreaterThan(200);
    });

    it('should stop reconnection after max retries', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('Connection failed');
      });

      const onMaxRetriesReached = vi.fn();

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 2,
          initialDelay: 50,
          onMaxRetriesReached,
        })
      );

      result.current.startReconnection(mockOperation);

      // Wait for max retries to be reached
      await waitFor(
        () => {
          expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
          expect(onMaxRetriesReached).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });

    it('should call onReconnect callback on successful reconnection', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Connection failed');
        }
        return true;
      });

      const onReconnect = vi.fn();

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 5,
          initialDelay: 50,
          onReconnect,
        })
      );

      result.current.startReconnection(mockOperation);

      // Wait for successful reconnection
      await waitFor(
        () => {
          expect(onReconnect).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Reconnection State', () => {
    it('should track reconnection state', async () => {
      const mockOperation = vi.fn(async () => {
        throw new Error('Connection failed');
      });

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 1,
          initialDelay: 50,
        })
      );

      expect(result.current.isReconnecting).toBe(false);

      const reconnectionPromise = result.current.startReconnection(mockOperation);

      // Should be reconnecting during attempts
      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(true);
      });

      await reconnectionPromise;

      // Should stop reconnecting after max retries
      await waitFor(() => {
        expect(result.current.isReconnecting).toBe(false);
      });
    });

    it('should track retry count', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Connection failed');
        }
        return true;
      });

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 5,
          initialDelay: 50,
        })
      );

      result.current.startReconnection(mockOperation);

      await waitFor(
        () => {
          expect(result.current.retryCount).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Stop Reconnection', () => {
    it('should stop reconnection when stopReconnection is called', async () => {
      const mockOperation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Connection failed');
      });

      const { result } = renderHook(() =>
        useReconnection({
          maxRetries: 10,
          initialDelay: 200,
        })
      );

      const reconnectionPromise = result.current.startReconnection(mockOperation);

      // Wait a bit for reconnection to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Stop reconnection
      result.current.stopReconnection();

      await reconnectionPromise;

      // Should have stopped before max retries
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});
