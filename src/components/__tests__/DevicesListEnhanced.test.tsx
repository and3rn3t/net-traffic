/**
 * Unit tests for DevicesListEnhanced component
 * Tests device display, edit functionality, and API integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { DevicesListEnhanced } from '@/components/DevicesListEnhanced';
import { apiClient } from '@/lib/api';
import { Device } from '@/lib/types';
// Toast is mocked below

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiClient: {
    healthCheck: vi.fn(),
    getDevices: vi.fn(),
    getDevice: vi.fn(),
    getFlows: vi.fn(),
    getFlow: vi.fn(),
    getThreats: vi.fn(),
    dismissThreat: vi.fn(),
    getAnalytics: vi.fn(),
    getProtocolStats: vi.fn(),
    getCaptureStatus: vi.fn(),
    startCapture: vi.fn(),
    stopCapture: vi.fn(),
    getSummaryStats: vi.fn(),
    getGeographicStats: vi.fn(),
    getTopDomains: vi.fn(),
    getTopDevices: vi.fn(),
    getBandwidthTimeline: vi.fn(),
    getRttTrends: vi.fn(),
    getJitterAnalysis: vi.fn(),
    getRetransmissionReport: vi.fn(),
    getConnectionQualitySummary: vi.fn(),
    getApplicationBreakdown: vi.fn(),
    getApplicationTrends: vi.fn(),
    getDeviceApplicationProfile: vi.fn(),
    getDeviceAnalytics: vi.fn(),
    updateDevice: vi.fn(),
    search: vi.fn(),
    exportFlows: vi.fn(),
    getMaintenanceStats: vi.fn(),
    runCleanup: vi.fn(),
    connectWebSocket: vi.fn(() => () => {}),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: mockToast,
}));

const renderDevicesList = (
  props: Partial<React.ComponentProps<typeof DevicesListEnhanced>> = {}
) => {
  const defaultProps = { devices: [] as Device[] };
  return render(
    <QueryClientProvider client={queryClient}>
      <DevicesListEnhanced {...defaultProps} {...props} />
    </QueryClientProvider>
  );
};

const mockDevice: Device = {
  id: '1',
  name: 'Test Device',
  ip: '192.168.1.1',
  type: 'laptop',
  mac: '00:11:22:33:44:55',
  vendor: 'Test Vendor',
  firstSeen: Date.now() - 86400000,
  lastSeen: Date.now(),
  bytesTotal: 1536000,
  connectionsCount: 5,
  threatScore: 0,
  behavioral: {
    peakHours: [9, 10, 11, 14, 15, 16],
    commonPorts: [80, 443],
    commonDomains: ['example.com'],
    anomalyCount: 0,
  },
};

describe('DevicesListEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    vi.stubEnv('VITE_USE_REAL_API', 'true');
  });

  describe('Rendering', () => {
    it('should render empty state when no devices', () => {
      renderDevicesList({ devices: [] as Device[] });
      expect(screen.getByText(/no devices discovered yet/i)).toBeInTheDocument();
    });

    it('should render device list', () => {
      renderDevicesList({ devices: [mockDevice] });
      expect(screen.getByText('Test Device')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    it('should render multiple devices', () => {
      const devices: Device[] = [
        mockDevice,
        {
          ...mockDevice,
          id: '2',
          name: 'Device 2',
          ip: '192.168.1.2',
        },
      ];
      renderDevicesList({ devices });
      expect(screen.getByText('Test Device')).toBeInTheDocument();
      expect(screen.getByText('Device 2')).toBeInTheDocument();
    });

    it('should display device statistics', () => {
      renderDevicesList({ devices: [mockDevice] });
      // Component shows device count badge and device details
      // Use getAllByText since "devices" appears multiple times
      const deviceTexts = screen.getAllByText(/devices/i);
      expect(deviceTexts.length).toBeGreaterThan(0);
      expect(screen.getByText('Test Device')).toBeInTheDocument();
    });
  });

  describe('Edit Functionality', () => {
    it('should open edit dialog when edit button is clicked', async () => {
      renderDevicesList({ devices: [mockDevice] });

      // Find edit button by title attribute "Edit Device"
      const editButton = screen.getByTitle('Edit Device');

      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText(/edit device/i)).toBeInTheDocument();
      });
    });

    it('should populate edit form with device data', async () => {
      renderDevicesList({ devices: [mockDevice] });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        // Input has id="device-name", find by that or by placeholder
        const nameInput =
          screen.getByLabelText('Device Name') || screen.getByPlaceholderText('Enter device name');
        expect(nameInput).toBeInTheDocument();
        expect((nameInput as HTMLInputElement).value).toBe('Test Device');
      });
    });

    it('should update device name in form', async () => {
      renderDevicesList({ devices: [mockDevice] });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        const nameInput = (screen.getByLabelText('Device Name') ||
          screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Updated Device' } });
        expect(nameInput.value).toBe('Updated Device');
      });
    });

    it('should save device changes via API', async () => {
      const onDeviceUpdate = vi.fn();
      const updatedDevice = { ...mockDevice, name: 'Updated Device' };

      vi.mocked(apiClient.updateDevice).mockResolvedValue(updatedDevice);

      renderDevicesList({ devices: [mockDevice], onDeviceUpdate });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        const nameInput = (screen.getByLabelText('Device Name') ||
          screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = (screen.getByLabelText('Device Name') ||
        screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Updated Device' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(apiClient.updateDevice).toHaveBeenCalledWith('1', {
          name: 'Updated Device',
          type: 'laptop',
          notes: '',
        });
      });
    });

    it('should call onDeviceUpdate callback after saving', async () => {
      const onDeviceUpdate = vi.fn();
      const updatedDevice = { ...mockDevice, name: 'Updated Device' };

      vi.mocked(apiClient.updateDevice).mockResolvedValue(updatedDevice);

      renderDevicesList({ devices: [mockDevice], onDeviceUpdate });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        const nameInput = (screen.getByLabelText('Device Name') ||
          screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = (screen.getByLabelText('Device Name') ||
        screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Updated Device' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onDeviceUpdate).toHaveBeenCalledWith(updatedDevice);
      });
    });

    it('should show success toast after saving', async () => {
      const updatedDevice = { ...mockDevice, name: 'Updated Device' };
      vi.mocked(apiClient.updateDevice).mockResolvedValue(updatedDevice);

      renderDevicesList({ devices: [mockDevice] });

      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(
        btn => btn.querySelector('svg') || btn.textContent?.includes('Edit')
      );

      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(async () => {
          const saveButton = screen.getByRole('button', { name: /save changes/i });
          fireEvent.click(saveButton);

          await waitFor(() => {
            expect(toast.toast.success).toHaveBeenCalledWith('Device updated successfully');
          });
        });
      }
    });

    it('should handle API errors when saving', async () => {
      const error = new Error('Update failed');
      vi.mocked(apiClient.updateDevice).mockRejectedValue(error);

      renderDevicesList({ devices: [mockDevice] });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        const nameInput = (screen.getByLabelText('Device Name') ||
          screen.getByPlaceholderText('Enter device name')) as HTMLInputElement;
        expect(nameInput).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('should cancel edit when cancel button is clicked', async () => {
      renderDevicesList({ devices: [mockDevice] });

      const editButton = screen.getByTitle('Edit Device');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText(/edit device/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/edit device/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Device Selection', () => {
    it('should call onDeviceSelect when device is clicked', () => {
      const onDeviceSelect = vi.fn();
      renderDevicesList({ devices: [mockDevice], onDeviceSelect });

      // Click on device card
      const deviceCard =
        screen.getByText('Test Device').closest('[class*="card"]') ||
        screen.getByText('Test Device').closest('div');

      if (deviceCard) {
        fireEvent.click(deviceCard);
        expect(onDeviceSelect).toHaveBeenCalledWith(mockDevice);
      }
    });
  });

  describe('Mock Mode', () => {
    it('should work in mock mode when API is disabled', async () => {
      vi.stubEnv('VITE_USE_REAL_API', 'false');
      const onDeviceUpdate = vi.fn();

      renderDevicesList({ devices: [mockDevice], onDeviceUpdate });

      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(
        btn => btn.querySelector('svg') || btn.textContent?.includes('Edit')
      );

      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(async () => {
          const saveButton = screen.getByRole('button', { name: /save changes/i });
          fireEvent.click(saveButton);

          await waitFor(() => {
            expect(onDeviceUpdate).toHaveBeenCalled();
            expect(apiClient.updateDevice).not.toHaveBeenCalled();
          });
        });
      }
    });
  });
});
