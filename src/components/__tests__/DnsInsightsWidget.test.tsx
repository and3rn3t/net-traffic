/**
 * Unit tests for DnsInsightsWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { DnsInsightsWidget } from '@/components/dashboard/DnsInsightsWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getDnsStats: vi.fn(),
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DnsInsightsWidget />
    </QueryClientProvider>
  );
}

describe('DnsInsightsWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getDnsStats).mockReset();
  });

  it('shows the empty state when there is no DNS activity', async () => {
    vi.mocked(apiClient.getDnsStats).mockResolvedValue({
      total_queries: 0,
      failure_count: 0,
      failure_rate: 0,
      response_codes: [],
      top_domains: [],
      unusual_tlds: [],
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('No DNS activity observed')).toBeInTheDocument();
    });
  });

  it('renders query volume, failure rate, top domains, and unusual TLDs', async () => {
    vi.mocked(apiClient.getDnsStats).mockResolvedValue({
      total_queries: 100,
      failure_count: 5,
      failure_rate: 5,
      response_codes: [{ code: 'NOERROR', count: 95 }],
      top_domains: [{ domain: 'example.com', query_count: 50, failure_count: 0 }],
      unusual_tlds: [{ tld: 'xyz', count: 3 }],
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('5.0% failed (5)')).toBeInTheDocument();
    expect(screen.getByText('.xyz (3)')).toBeInTheDocument();
  });
});
