/**
 * Unit tests for useDnsInsights hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useDnsInsights } from '@/hooks/useDnsInsights';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getDnsStats: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useDnsInsights', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getDnsStats).mockReset();
  });

  it('returns zeroed defaults before the fetch resolves', () => {
    vi.mocked(apiClient.getDnsStats).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDnsInsights(), { wrapper });

    expect(result.current.totalQueries).toBe(0);
    expect(result.current.topDomains).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('maps response data through to the hook result', async () => {
    vi.mocked(apiClient.getDnsStats).mockResolvedValue({
      total_queries: 100,
      failure_count: 5,
      failure_rate: 5,
      response_codes: [
        { code: 'NOERROR', count: 95 },
        { code: 'NXDOMAIN', count: 5 },
      ],
      top_domains: [{ domain: 'example.com', query_count: 50, failure_count: 0 }],
      unusual_tlds: [{ tld: 'xyz', count: 3 }],
    });

    const { result } = renderHook(() => useDnsInsights(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalQueries).toBe(100);
    expect(result.current.failureCount).toBe(5);
    expect(result.current.failureRate).toBe(5);
    expect(result.current.topDomains).toHaveLength(1);
    expect(result.current.unusualTlds).toEqual([{ tld: 'xyz', count: 3 }]);
  });

  it('passes limit and hours through to getDnsStats', async () => {
    vi.mocked(apiClient.getDnsStats).mockResolvedValue({
      total_queries: 0,
      failure_count: 0,
      failure_rate: 0,
      response_codes: [],
      top_domains: [],
      unusual_tlds: [],
    });

    renderHook(() => useDnsInsights(5, 48), { wrapper });

    await waitFor(() => expect(apiClient.getDnsStats).toHaveBeenCalledWith(5, 48));
  });
});
