/**
 * Unit tests for TopTalkersWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { TopTalkersWidget } from '@/components/dashboard/TopTalkersWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getTopDevices: vi.fn(),
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TopTalkersWidget />
    </QueryClientProvider>
  );
}

describe('TopTalkersWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getTopDevices).mockReset();
  });

  it('shows an empty state when there are no devices', async () => {
    vi.mocked(apiClient.getTopDevices).mockResolvedValue([]);
    renderWidget();

    expect(await screen.findByText('No device activity yet.')).toBeInTheDocument();
  });

  it('renders ranked devices with formatted bytes', async () => {
    vi.mocked(apiClient.getTopDevices).mockResolvedValue([
      {
        device_id: 'a',
        device_name: 'Kitchen Laptop',
        device_ip: '10.0.0.5',
        device_type: 'laptop',
        bytes: 1_500_000,
        connections: 3,
        threats: 0,
      },
    ]);

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('Kitchen Laptop')).toBeInTheDocument();
    });
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
  });
});
