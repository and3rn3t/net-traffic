/**
 * Unit tests for useDevicePresence hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useDevicePresence } from '@/hooks/useDevicePresence';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getDevicePresence: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useDevicePresence', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getDevicePresence).mockReset();
  });

  it('returns empty defaults before the fetch resolves', () => {
    vi.mocked(apiClient.getDevicePresence).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDevicePresence(), { wrapper });

    expect(result.current.devices).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('maps response data through to the hook result', async () => {
    vi.mocked(apiClient.getDevicePresence).mockResolvedValue({
      days: 7,
      hours: 168,
      start_timestamp: 0,
      devices: [
        {
          device_id: 'dev-1',
          device_name: 'Laptop',
          device_ip: '10.0.0.1',
          presence: Array(168).fill(1),
        },
      ],
    });

    const { result } = renderHook(() => useDevicePresence(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toBe(7);
    expect(result.current.hours).toBe(168);
    expect(result.current.devices).toHaveLength(1);
    expect(result.current.devices[0].presence).toHaveLength(168);
  });

  it('passes days and limit through to getDevicePresence', async () => {
    vi.mocked(apiClient.getDevicePresence).mockResolvedValue({
      days: 3,
      hours: 72,
      start_timestamp: 0,
      devices: [],
    });

    renderHook(() => useDevicePresence(3, 5), { wrapper });

    await waitFor(() => expect(apiClient.getDevicePresence).toHaveBeenCalledWith(3, 5));
  });
});
