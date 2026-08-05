/**
 * Unit tests for DevicePresenceWidget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { DevicePresenceWidget } from '@/components/dashboard/DevicePresenceWidget';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getDevicePresence: vi.fn(),
  },
}));

function renderWidget() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DevicePresenceWidget />
    </QueryClientProvider>
  );
}

describe('DevicePresenceWidget', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getDevicePresence).mockReset();
  });

  it('shows the empty state when there are no devices', async () => {
    vi.mocked(apiClient.getDevicePresence).mockResolvedValue({
      days: 7,
      hours: 168,
      start_timestamp: 0,
      devices: [],
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('No device activity observed')).toBeInTheDocument();
    });
  });

  it('renders a row per device with the device name as the label', async () => {
    vi.mocked(apiClient.getDevicePresence).mockResolvedValue({
      days: 1,
      hours: 24,
      start_timestamp: 0,
      devices: [
        {
          device_id: 'dev-1',
          device_name: 'Laptop',
          device_ip: '10.0.0.1',
          presence: Array(24).fill(1),
        },
      ],
    });

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });
  });
});
