/**
 * Unit tests for LatencyQualityCalendarWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { LatencyQualityCalendarWidget } from '@/components/dashboard/LatencyQualityCalendarWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getLatencyQualityCalendar: vi.fn(),
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <LatencyQualityCalendarWidget />
    </QueryClientProvider>
  );
}

const emptyCells = Array.from({ length: 7 }, () =>
  Array.from({ length: 24 }, () => ({ avg_rtt: null, avg_jitter: null, count: 0 }))
);

describe('LatencyQualityCalendarWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getLatencyQualityCalendar).mockReset();
  });

  it('shows the empty state when there is no latency data', async () => {
    vi.mocked(apiClient.getLatencyQualityCalendar).mockResolvedValue({
      days: 14,
      day_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      cells: emptyCells,
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('No latency data observed')).toBeInTheDocument();
    });
  });

  it('renders a row per day with the day label', async () => {
    const cells = emptyCells.map(row => row.map(() => ({ avg_rtt: 25, avg_jitter: 2, count: 3 })));
    vi.mocked(apiClient.getLatencyQualityCalendar).mockResolvedValue({
      days: 14,
      day_labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      cells,
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });
  });
});
