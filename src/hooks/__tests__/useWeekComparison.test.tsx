/**
 * Unit tests for useWeekComparison hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useWeekComparison } from '@/hooks/useWeekComparison';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBandwidthTimeline: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function makeTimeline(hours: number, bytesPerHour: number) {
  return Array.from({ length: hours }, (_, i) => ({
    timestamp: i * 60 * 60 * 1000,
    bytes_in: bytesPerHour / 2,
    bytes_out: bytesPerHour / 2,
    packets: 100,
    connections: 5,
  }));
}

describe('useWeekComparison', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getBandwidthTimeline).mockReset();
  });

  it('fetches 336 hours at a 60 minute interval', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(makeTimeline(336, 1000));

    const { result } = renderHook(() => useWeekComparison(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiClient.getBandwidthTimeline).toHaveBeenCalledWith(336, 60);
  });

  it('splits the timeline into 168-point this-week/last-week series', async () => {
    const timeline = [
      ...makeTimeline(168, 1000), // last week (older half)
      ...makeTimeline(168, 2000), // this week (newer half)
    ];
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(timeline);

    const { result } = renderHook(() => useWeekComparison(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.points).toHaveLength(168);
    expect(result.current.lastWeekTotalBytes).toBe(168 * 1000);
    expect(result.current.thisWeekTotalBytes).toBe(168 * 2000);
  });

  it('computes a positive delta percent when this week is higher than last week', async () => {
    const timeline = [...makeTimeline(168, 1000), ...makeTimeline(168, 1500)];
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(timeline);

    const { result } = renderHook(() => useWeekComparison(), { wrapper });

    await waitFor(() => expect(result.current.deltaPercent).not.toBeNull());
    expect(result.current.deltaPercent).toBeCloseTo(50, 5);
  });

  it('returns a null delta percent when there is no prior-week data', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([]);

    const { result } = renderHook(() => useWeekComparison(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.deltaPercent).toBeNull();
  });
});
