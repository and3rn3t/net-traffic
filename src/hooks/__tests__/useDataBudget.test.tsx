/**
 * Unit tests for useDataBudget hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useDataBudget } from '@/hooks/useDataBudget';
import { apiClient } from '@/lib/api';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getMonthlyUsage: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>{children}</AppProvider>
  </QueryClientProvider>
);

describe('useDataBudget', () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    vi.mocked(apiClient.getMonthlyUsage).mockReset();
  });

  it('returns zeroed defaults before the fetch resolves', () => {
    vi.mocked(apiClient.getMonthlyUsage).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDataBudget(), { wrapper });

    expect(result.current.currentBytes).toBe(0);
    expect(result.current.capGb).toBeUndefined();
    expect(result.current.percentOfCap).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('maps response data through to the hook result', async () => {
    vi.mocked(apiClient.getMonthlyUsage).mockResolvedValue({
      month_start: 0,
      current_bytes: 1_000_000_000,
      prior_month_bytes: 2_000_000_000,
      days_elapsed: 10,
      days_in_month: 30,
      projected_month_bytes: 3_000_000_000,
    });

    const { result } = renderHook(() => useDataBudget(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentBytes).toBe(1_000_000_000);
    expect(result.current.priorMonthBytes).toBe(2_000_000_000);
    expect(result.current.daysElapsed).toBe(10);
    expect(result.current.daysInMonth).toBe(30);
    expect(result.current.projectedMonthBytes).toBe(3_000_000_000);
  });
});
