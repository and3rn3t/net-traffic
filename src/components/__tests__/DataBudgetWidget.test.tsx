/**
 * Unit tests for DataBudgetWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { DataBudgetWidget } from '@/components/dashboard/DataBudgetWidget';
import { apiClient } from '@/lib/api';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getMonthlyUsage: vi.fn(),
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <DataBudgetWidget />
      </AppProvider>
    </QueryClientProvider>
  );
}

describe('DataBudgetWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    vi.mocked(apiClient.getMonthlyUsage).mockReset();
  });

  it('shows a projection prompt when no cap is set', async () => {
    vi.mocked(apiClient.getMonthlyUsage).mockResolvedValue({
      month_start: 0,
      current_bytes: 1_000_000_000,
      prior_month_bytes: 2_000_000_000,
      days_elapsed: 10,
      days_in_month: 30,
      projected_month_bytes: 3_000_000_000,
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText(/Set a monthly cap/)).toBeInTheDocument();
    });
  });

  it('shows month-to-date usage', async () => {
    vi.mocked(apiClient.getMonthlyUsage).mockResolvedValue({
      month_start: 0,
      current_bytes: 1_073_741_824,
      prior_month_bytes: 0,
      days_elapsed: 10,
      days_in_month: 30,
      projected_month_bytes: 0,
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('1.00 GB')).toBeInTheDocument();
    });
  });
});
