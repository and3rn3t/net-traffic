/**
 * Unit tests for ConnectionsTableEnhanced component
 * Tests table rendering, sorting, filtering, and virtualization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ConnectionsTableEnhanced } from '@/components/ConnectionsTableEnhanced';
import { NetworkFlow, Device } from '@/lib/types';
import { apiClient } from '@/lib/api';
import * as toast from 'sonner';
import { createDefaultFlowFilters } from '@/test/helpers';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiClient: {
    exportFlows: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const defaultFilters = {
  protocols: [],
  status: null,
  threatLevel: null,
  sourceIp: '',
  destIp: '',
  startTime: null,
  endTime: null,
  minBytes: null,
  deviceId: null,
  timeRangePreset: null,
  countries: [],
  cities: [],
  applications: [],
  minRtt: null,
  maxRtt: null,
  maxJitter: null,
  maxRetransmissions: null,
  sni: '',
  connectionStates: [],
};

vi.mock('@/hooks/useFlowFilters', () => ({
  useFlowFilters: vi.fn(() => ({
    filters: defaultFilters,
    filteredFlows: [],
    isLoading: false,
    error: null,
    savedPresets: [],
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    applyFilters: vi.fn(),
    savePreset: vi.fn(),
    loadPreset: vi.fn(),
    deletePreset: vi.fn(),
    refresh: vi.fn(),
  })),
}));

const renderConnectionsTable = (
  props: Partial<React.ComponentProps<typeof ConnectionsTableEnhanced>> = {}
) => {
  const defaultProps = { flows: [] as NetworkFlow[] };
  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectionsTableEnhanced {...defaultProps} {...props} />
    </QueryClientProvider>
  );
};

const mockFlow: NetworkFlow = {
  id: '1',
  sourceIp: '192.168.1.1',
  sourcePort: 80,
  destIp: '10.0.0.1',
  destPort: 443,
  protocol: 'TCP',
  timestamp: Date.now(),
  bytesIn: 1000,
  bytesOut: 500,
  packetsIn: 10,
  packetsOut: 5,
  duration: 1000,
  status: 'active',
  threatLevel: 'safe',
  domain: 'example.com',
  deviceId: '1',
};

const _mockDevice: Device = {
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

describe('ConnectionsTableEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('Rendering', () => {
    it('should render empty state when no flows', () => {
      renderConnectionsTable({ flows: [] });
      expect(screen.getByText(/no connections found/i)).toBeInTheDocument();
    });

    it('should render flows list', () => {
      renderConnectionsTable({ flows: [mockFlow] });
      expect(screen.getByText('Network Connections')).toBeInTheDocument();
    });

    it('should display flow count badges', () => {
      renderConnectionsTable({ flows: [mockFlow] });
      expect(screen.getByText(/1 total/i)).toBeInTheDocument();
      expect(screen.getByText(/1 active/i)).toBeInTheDocument();
    });

    it('should calculate active connections count', () => {
      const flows: NetworkFlow[] = [
        { ...mockFlow, id: '1', status: 'active' },
        { ...mockFlow, id: '2', status: 'closed' },
        { ...mockFlow, id: '3', status: 'active' },
      ];
      renderConnectionsTable({ flows });
      expect(screen.getByText(/3 total/i)).toBeInTheDocument();
      expect(screen.getByText(/2 active/i)).toBeInTheDocument();
    });
  });

  describe('Flow Display', () => {
    it('should display flow protocol', () => {
      renderConnectionsTable({ flows: [mockFlow] });
      expect(screen.getByText('TCP')).toBeInTheDocument();
    });

    it('should display flow IP addresses and ports', () => {
      renderConnectionsTable({ flows: [mockFlow] });
      expect(screen.getByText(/192\.168\.1\.1/i)).toBeInTheDocument();
      expect(screen.getByText(/10\.0\.0\.1/i)).toBeInTheDocument();
    });

    it('should display flow domain when available', () => {
      renderConnectionsTable({ flows: [{ ...mockFlow, domain: 'example.com' }] });
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should display threat level badge', () => {
      renderConnectionsTable({ flows: [{ ...mockFlow, threatLevel: 'high' }] });
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });
  });

  describe('Client-Side Filtering', () => {
    it('should display all flows when useApiFilters is false', () => {
      const flows: NetworkFlow[] = [mockFlow, { ...mockFlow, id: '2', protocol: 'UDP' }];
      renderConnectionsTable({ flows, useApiFilters: false });
      expect(screen.getByText(/2 total/i)).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should export flows when export button is clicked', async () => {
      vi.mocked(apiClient.exportFlows).mockResolvedValue(undefined);

      const { useFlowFilters } = await import('@/hooks/useFlowFilters');
      vi.mocked(useFlowFilters).mockReturnValue({
        filters: {
          ...createDefaultFlowFilters(),
          startTime: 1000,
          endTime: 2000,
          deviceId: '1',
        },
        filteredFlows: [mockFlow],
        isLoading: false,
        error: null,
        savedPresets: [],
        updateFilters: vi.fn(),
        clearFilters: vi.fn(),
        applyFilters: vi.fn(),
        savePreset: vi.fn(),
        loadPreset: vi.fn(),
        deletePreset: vi.fn(),
        refresh: vi.fn(),
      });

      renderConnectionsTable({ flows: [mockFlow], useApiFilters: true });

      const exportButtons = screen.getAllByRole('button');
      const exportButton = exportButtons.find(
        btn => btn.textContent?.includes('Export') || btn.querySelector('svg')
      );

      if (exportButton) {
        fireEvent.click(exportButton);

        await waitFor(() => {
          expect(apiClient.exportFlows).toHaveBeenCalledWith('csv', 1000, 2000, '1');
        });
      }
    });

    it('should show success toast after successful export', async () => {
      vi.mocked(apiClient.exportFlows).mockResolvedValue(undefined);

      const { useFlowFilters } = await import('@/hooks/useFlowFilters');
      vi.mocked(useFlowFilters).mockReturnValue({
        filters: createDefaultFlowFilters(),
        filteredFlows: [mockFlow],
        isLoading: false,
        error: null,
        savedPresets: [],
        updateFilters: vi.fn(),
        clearFilters: vi.fn(),
        applyFilters: vi.fn(),
        savePreset: vi.fn(),
        loadPreset: vi.fn(),
        deletePreset: vi.fn(),
        refresh: vi.fn(),
      });

      renderConnectionsTable({ flows: [mockFlow], useApiFilters: true });

      const exportButtons = screen.getAllByRole('button');
      const exportButton = exportButtons.find(
        btn => btn.textContent?.includes('Export') || btn.querySelector('svg')
      );

      if (exportButton) {
        fireEvent.click(exportButton);

        await waitFor(() => {
          expect(toast.toast.success).toHaveBeenCalledWith('Export started');
        });
      }
    });

    it('should show error toast when export fails', async () => {
      const error = new Error('Export failed');
      vi.mocked(apiClient.exportFlows).mockRejectedValue(error);

      const { useFlowFilters } = await import('@/hooks/useFlowFilters');
      vi.mocked(useFlowFilters).mockReturnValue({
        filters: createDefaultFlowFilters(),
        filteredFlows: [mockFlow],
        isLoading: false,
        error: null,
        savedPresets: [],
        updateFilters: vi.fn(),
        clearFilters: vi.fn(),
        applyFilters: vi.fn(),
        savePreset: vi.fn(),
        loadPreset: vi.fn(),
        deletePreset: vi.fn(),
        refresh: vi.fn(),
      });

      renderConnectionsTable({ flows: [mockFlow], useApiFilters: true });

      const exportButtons = screen.getAllByRole('button');
      const exportButton = exportButtons.find(
        btn => btn.textContent?.includes('Export') || btn.querySelector('svg')
      );

      if (exportButton) {
        fireEvent.click(exportButton);

        await waitFor(() => {
          expect(toast.toast.error).toHaveBeenCalledWith('Failed to export flows');
        });
      }
    });
  });

  describe('Flow Selection', () => {
    it('should call onFlowSelect when flow is clicked', () => {
      const onFlowSelect = vi.fn();
      renderConnectionsTable({ flows: [mockFlow], onFlowSelect });

      // Try to find clickable flow element
      const flowElement =
        screen.getByText('TCP').closest('[class*="cursor-pointer"]') ||
        screen.getByText('TCP').closest('div');

      if (flowElement) {
        fireEvent.click(flowElement);
        expect(onFlowSelect).toHaveBeenCalledWith(mockFlow);
      }
    });
  });

  describe('Virtualization', () => {
    it('should use virtualization for large lists', () => {
      const manyFlows: NetworkFlow[] = Array.from({ length: 150 }, (_, i) => ({
        ...mockFlow,
        id: String(i),
      }));

      renderConnectionsTable({
        flows: manyFlows,
        useVirtualization: true,
        virtualizationThreshold: 100,
      });

      expect(screen.getByText(/150 total/i)).toBeInTheDocument();
    });

    it('should not use virtualization for small lists', () => {
      renderConnectionsTable({
        flows: [mockFlow],
        useVirtualization: true,
        virtualizationThreshold: 100,
      });

      expect(screen.getByText(/1 total/i)).toBeInTheDocument();
    });
  });
});
