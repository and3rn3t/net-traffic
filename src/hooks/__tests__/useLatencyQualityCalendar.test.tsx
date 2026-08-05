/**
 * Unit tests for useLatencyQualityCalendar hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useLatencyQualityCalendar } from '@/hooks/useLatencyQualityCalendar';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getLatencyQualityCalendar: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useLatencyQualityCalendar', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getLatencyQualityCalendar).mockReset();
  });

  it('returns empty defaults before the fetch resolves', () => {
    vi.mocked(apiClient.getLatencyQualityCalendar).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useLatencyQualityCalendar(), { wrapper });

    expect(result.current.cells).toEqual([]);
    expect(result.current.dayLabels).toHaveLength(7);
    expect(result.current.isLoading).toBe(true);
  });

  it('maps response data through to the hook result', async () => {
    const cells = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ avg_rtt: 20, avg_jitter: 2, count: 5 }))
    );
    vi.mocked(apiClient.getLatencyQualityCalendar).mockResolvedValue({
      days: 14,
      day_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      cells,
    });

    const { result } = renderHook(() => useLatencyQualityCalendar(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toBe(14);
    expect(result.current.cells).toHaveLength(7);
    expect(result.current.cells[0]).toHaveLength(24);
  });

  it('passes days and deviceId through to getLatencyQualityCalendar', async () => {
    vi.mocked(apiClient.getLatencyQualityCalendar).mockResolvedValue({
      days: 7,
      day_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      cells: [],
    });

    renderHook(() => useLatencyQualityCalendar(7, 'dev-1'), { wrapper });

    await waitFor(() =>
      expect(apiClient.getLatencyQualityCalendar).toHaveBeenCalledWith(7, 'dev-1')
    );
  });
});
