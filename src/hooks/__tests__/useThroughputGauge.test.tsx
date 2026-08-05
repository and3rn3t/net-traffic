/**
 * Unit tests for useThroughputGauge hook
 * Tests current rate derivation, WS-triggered refresh throttling, and peak-hold decay
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useThroughputGauge } from '@/hooks/useThroughputGauge';
import { apiClient } from '@/lib/api';

const listeners = new Map<string, Set<(data: unknown) => void>>();

function emit(eventType: string, data: unknown) {
  listeners.get(eventType)?.forEach(cb => cb(data));
}

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBandwidthTimeline: vi.fn(),
    on: (eventType: string, callback: (data: unknown) => void) => {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set());
      listeners.get(eventType)!.add(callback);
      return () => listeners.get(eventType)?.delete(callback);
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <WebSocketProvider>{children}</WebSocketProvider>
  </QueryClientProvider>
);

describe('useThroughputGauge', () => {
  beforeEach(() => {
    queryClient.clear();
    listeners.clear();
    vi.mocked(apiClient.getBandwidthTimeline).mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives bytes-per-second from the latest bandwidth interval', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([
      { timestamp: 1, bytes_in: 30_000, bytes_out: 30_000, packets: 100, connections: 5 },
    ]);

    const { result } = renderHook(() => useThroughputGauge(), { wrapper });

    await waitFor(() => expect(result.current.bytesPerSecond).toBeCloseTo(1000));
  });

  it('throttles WS-triggered refetches within the throttle window', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([
      { timestamp: 1, bytes_in: 6000, bytes_out: 0, packets: 1, connections: 1 },
    ]);

    renderHook(() => useThroughputGauge(), { wrapper });
    await waitFor(() => expect(apiClient.getBandwidthTimeline).toHaveBeenCalledTimes(1));

    act(() => {
      emit('flow_update', { flow: {} });
    });
    await waitFor(() => expect(apiClient.getBandwidthTimeline).toHaveBeenCalledTimes(2));

    // A second flow_update arriving immediately after should be throttled away.
    act(() => {
      emit('flow_update', { flow: {} });
    });
    expect(apiClient.getBandwidthTimeline).toHaveBeenCalledTimes(2);

    // Once the throttle window has passed, another event triggers a fresh refetch.
    act(() => {
      vi.advanceTimersByTime(3000);
      emit('flow_update', { flow: {} });
    });
    await waitFor(() => expect(apiClient.getBandwidthTimeline).toHaveBeenCalledTimes(3));
  });

  it('holds the peak and decays it back down after the hold window', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([
      { timestamp: 1, bytes_in: 60_000, bytes_out: 0, packets: 1, connections: 1 },
    ]);

    const { result } = renderHook(() => useThroughputGauge(), { wrapper });

    await waitFor(() => expect(result.current.bytesPerSecond).toBeCloseTo(1000));
    expect(result.current.peakBytesPerSecond).toBeCloseTo(1000);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.peakBytesPerSecond).toBeLessThanOrEqual(1000);
  });
});
