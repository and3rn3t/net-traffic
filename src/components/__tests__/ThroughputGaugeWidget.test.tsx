/**
 * Unit tests for ThroughputGaugeWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ThroughputGaugeWidget } from '@/components/dashboard/ThroughputGaugeWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getBandwidthTimeline: vi.fn(),
    on: () => () => {},
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <ThroughputGaugeWidget />
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

describe('ThroughputGaugeWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getBandwidthTimeline).mockReset();
  });

  it('renders the current and peak rate', async () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([
      { timestamp: 1, bytes_in: 30_000, bytes_out: 30_000, packets: 100, connections: 5 },
    ]);

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('1000.0 B/s')).toBeInTheDocument();
    });
    expect(screen.getByText(/Peak:/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Live throughput gauge' })).toBeInTheDocument();
  });

  it('renders a zeroed gauge when there is no bandwidth data', () => {
    vi.mocked(apiClient.getBandwidthTimeline).mockResolvedValue([]);

    renderWidget();

    expect(screen.getByText('0 B/s')).toBeInTheDocument();
  });
});
