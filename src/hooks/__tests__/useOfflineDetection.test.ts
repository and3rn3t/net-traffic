/**
 * Unit tests for useOfflineDetection hook
 * Tests online/offline detection and event handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';

describe('useOfflineDetection', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with navigator.onLine value', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.isOnline).toBe(true);
    });

    it('should initialize as offline when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.isOnline).toBe(false);
    });

    it('should set lastOnlineTime when online on init', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.lastOnlineTime).toBeInstanceOf(Date);
    });

    it('should not set lastOnlineTime when offline on init', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.lastOnlineTime).toBeNull();
    });
  });

  describe('Online Event Handling', () => {
    it('should update to online when online event fires', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.isOnline).toBe(false);

      act(() => {
        globalThis.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.lastOnlineTime).toBeInstanceOf(Date);
    });

    it('should call onOnline callback when going online', () => {
      const onOnline = vi.fn();
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      renderHook(() => useOfflineDetection({ onOnline }));

      act(() => {
        globalThis.dispatchEvent(new Event('online'));
      });

      expect(onOnline).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline Event Handling', () => {
    it('should update to offline when offline event fires', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => useOfflineDetection());

      expect(result.current.isOnline).toBe(true);

      act(() => {
        globalThis.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should call onOffline callback when going offline', () => {
      const onOffline = vi.fn();
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      renderHook(() => useOfflineDetection({ onOffline }));

      act(() => {
        globalThis.dispatchEvent(new Event('offline'));
      });

      expect(onOffline).toHaveBeenCalledTimes(1);
    });
  });

  describe('Periodic Connectivity Check', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should check connectivity periodically when checkInterval is set', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      renderHook(() => useOfflineDetection({ checkInterval: 1000 }));

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve(); // Allow async operations to complete
      });

      expect(fetchSpy).toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('should not check connectivity when checkInterval is 0', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      renderHook(() => useOfflineDetection({ checkInterval: 0 }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('should update to online when fetch succeeds', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const { result } = renderHook(() => useOfflineDetection({ checkInterval: 1000 }));

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve(); // Allow async operations to complete
      });

      expect(result.current.isOnline).toBe(true);

      fetchSpy.mockRestore();
    });

    it('should update to offline when fetch fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => useOfflineDetection({ checkInterval: 1000 }));

      // Advance timers to trigger the connectivity check
      await act(async () => {
        // Advance through check interval to trigger the first check
        await vi.advanceTimersByTimeAsync(1000);
        // Wait for the async fetch to complete and state to update
        // The fetch rejection needs to be handled by the hook
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve(); // Multiple ticks to ensure state updates propagate
      });

      // Wait for fetch to be called
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Wait for the state to update to offline (hook calls handleOffline when fetch fails)
      await waitFor(
        () => {
          expect(result.current.isOnline).toBe(false);
        },
        { timeout: 10000 }
      );

      fetchSpy.mockRestore();
    }, 20000);

    it('should update to offline when fetch returns non-ok response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
      } as Response);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => useOfflineDetection({ checkInterval: 1000 }));

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve(); // Allow async operations to complete
      });

      expect(result.current.isOnline).toBe(false);

      fetchSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(globalThis, 'removeEventListener');

      const { unmount } = renderHook(() => useOfflineDetection());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should clear interval on unmount when checkInterval is set', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const { unmount } = renderHook(() => useOfflineDetection({ checkInterval: 1000 }));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
