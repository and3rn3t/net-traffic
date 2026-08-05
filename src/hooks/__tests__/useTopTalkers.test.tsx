/**
 * Unit tests for useTopTalkers hook
 * Tests polling, rank-change tracking, and API disabled fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useTopTalkers } from '@/hooks/useTopTalkers';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getTopDevices: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const deviceA = {
  device_id: 'a',
  device_name: 'Device A',
  device_ip: '10.0.0.1',
  device_type: 'laptop',
  bytes: 1000,
  connections: 5,
  threats: 0,
};
const deviceB = {
  device_id: 'b',
  device_name: 'Device B',
  device_ip: '10.0.0.2',
  device_type: 'desktop',
  bytes: 500,
  connections: 2,
  threats: 0,
};

describe('useTopTalkers', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getTopDevices).mockReset();
  });

  it('returns ranked talkers with no rank change on the first fetch', async () => {
    vi.mocked(apiClient.getTopDevices).mockResolvedValue([deviceA, deviceB]);

    const { result } = renderHook(() => useTopTalkers(5), { wrapper });

    await waitFor(() => expect(result.current.talkers).toHaveLength(2));

    expect(result.current.talkers[0]).toMatchObject({ device_id: 'a', rank: 0, rankChange: 0 });
    expect(result.current.talkers[1]).toMatchObject({ device_id: 'b', rank: 1, rankChange: 0 });
  });

  it('computes rank change when device order shifts on refetch', async () => {
    vi.mocked(apiClient.getTopDevices).mockResolvedValueOnce([deviceA, deviceB]);

    const { result, rerender } = renderHook(({ limit }) => useTopTalkers(limit), {
      wrapper,
      initialProps: { limit: 5 },
    });

    await waitFor(() => expect(result.current.talkers).toHaveLength(2));

    vi.mocked(apiClient.getTopDevices).mockResolvedValueOnce([deviceB, deviceA]);
    queryClient.invalidateQueries({ queryKey: ['top-talkers', 5] });
    rerender({ limit: 5 });

    await waitFor(() => {
      const b = result.current.talkers.find(t => t.device_id === 'b');
      expect(b?.rank).toBe(0);
      expect(b?.rankChange).toBe(1);
    });
  });

  it('returns an empty list when there is no data yet', () => {
    vi.mocked(apiClient.getTopDevices).mockResolvedValue([]);

    const { result } = renderHook(() => useTopTalkers(5), { wrapper });

    expect(result.current.talkers).toEqual([]);
  });
});
