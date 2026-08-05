/**
 * Unit tests for WeekComparisonWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { WeekComparisonWidget } from '@/components/dashboard/WeekComparisonWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBandwidthTimeline: vi.fn(),
  },
}));

function makeTimeline(hours: number, bytesPerHour: number) {
  return Array.from({ length: hours }, (_, i) => ({
    timestamp: i * 60 * 60 * 1000,
    bytes_in: bytesPerHour / 2,
    bytes_out: bytesPerHour / 2,
    packets: 100,
    connections: 5,
  }));
}

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <WeekComparisonWidget />
    </QueryClientProvider>
  );
}

describe('WeekComparisonWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getBandwidthTimeline).mockReset();
  });

  it('shows the empty state when there is no data', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([]);

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('renders totals and a delta callout once data resolves', async () => {
    const timeline = [...makeTimeline(168, 1000), ...makeTimeline(168, 2000)];
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue(timeline);

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });
});
