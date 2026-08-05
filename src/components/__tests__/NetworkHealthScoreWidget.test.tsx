/**
 * Unit tests for NetworkHealthScoreWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { NetworkHealthScoreWidget } from '@/components/dashboard/NetworkHealthScoreWidget';
import { apiClient } from '@/lib/api';
import type { Threat } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getConnectionQualitySummary: vi.fn(),
  },
}));

function renderWidget(activeThreats: Threat[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NetworkHealthScoreWidget activeThreats={activeThreats} devices={[]} />
    </QueryClientProvider>
  );
}

describe('NetworkHealthScoreWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getConnectionQualitySummary).mockReset();
  });

  it('renders a high score with an excellent label for a healthy network', async () => {
    vi.mocked(apiClient.getConnectionQualitySummary).mockResolvedValue({
      total_flows: 10,
      flows_with_metrics: 10,
      quality_score: 95,
      avg_rtt: 5,
      avg_jitter: 1,
      avg_retransmissions: 0,
      avg_duration: 1,
      avg_packet_size: 1000,
      avg_bandwidth_utilization: 0.5,
      protocol_efficiency: {},
      quality_distribution: { excellent: 10, good: 0, fair: 0, poor: 0 },
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });
    expect(screen.getByText('Network health score')).toBeInTheDocument();
  });
});
