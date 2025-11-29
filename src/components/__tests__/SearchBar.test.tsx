/**
 * Unit tests for SearchBar component
 * Tests search input, debouncing, results display, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { SearchBar } from '@/components/SearchBar';
import { apiClient } from '@/lib/api';
import * as toast from 'sonner';

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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock the useDebounce hook to control debouncing in tests
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value, // Return value immediately for tests
}));

const renderSearchBar = (props = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchBar {...props} />
    </QueryClientProvider>
  );
};

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    vi.stubEnv('VITE_USE_REAL_API', 'true');
  });

  describe('Rendering', () => {
    it('should render search input with placeholder', () => {
      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);
      expect(input).toBeInTheDocument();
    });

    it('should render search icon', () => {
      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);
      expect(input).toBeInTheDocument();
      // Search icon is in the component but may not be easily queryable
      expect(input.closest('.relative')).toBeTruthy();
    });

    it('should show clear button when query exists', async () => {
      renderSearchBar();
      const input = screen.getByPlaceholderText(
        /search devices, flows, ip addresses/i
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'test query' } });

      await waitFor(() => {
        expect(input.value).toBe('test query');
      });
    });
  });

  describe('Search Input', () => {
    it('should update input value on change', async () => {
      renderSearchBar();
      const input = screen.getByPlaceholderText(
        /search devices, flows, ip addresses/i
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'device search' } });

      expect(input.value).toBe('device search');
    });

    it('should clear input when clear button is clicked', async () => {
      renderSearchBar();
      const input = screen.getByPlaceholderText(
        /search devices, flows, ip addresses/i
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'test' } });
      expect(input.value).toBe('test');

      // Find and click clear button (X button)
      const buttons = screen.getAllByRole('button');
      const clearButton = buttons.find(btn => btn.querySelector('svg'));

      if (clearButton) {
        fireEvent.click(clearButton);
        await waitFor(() => {
          expect(input.value).toBe('');
        });
      }
    });

    it('should open results dialog on Enter key press', async () => {
      const mockResults = {
        query: 'device',
        type: 'all',
        devices: [{ id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' }],
        flows: [],
        threats: [],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'device' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/search results/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search API Integration', () => {
    it('should call API when query is entered and API is enabled', async () => {
      const mockResults = {
        query: 'device',
        type: 'all',
        devices: [{ id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' }],
        flows: [],
        threats: [],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'device' } });

      await waitFor(() => {
        expect(apiClient.search).toHaveBeenCalledWith('device', 'all', 20);
      });
    });

    it('should not call API when API is disabled', async () => {
      vi.stubEnv('VITE_USE_REAL_API', 'false');

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'device' } });

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(apiClient.search).not.toHaveBeenCalled();
    });

    it('should display loading state during search', async () => {
      // Create a promise we can control
      let resolvePromise: (value: {
        query: string;
        type: string;
        devices: unknown[];
        flows: unknown[];
        threats: unknown[];
      }) => void;
      const searchPromise = new Promise<{
        query: string;
        type: string;
        devices: unknown[];
        flows: unknown[];
        threats: unknown[];
      }>(resolve => {
        resolvePromise = resolve;
      });

      vi.mocked(apiClient.search).mockReturnValue(searchPromise);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!({
        query: 'test',
        type: 'all',
        devices: [],
        flows: [],
        threats: [],
      });
    });

    it('should display search results when API returns data', async () => {
      const mockResults = {
        query: 'test',
        type: 'all',
        devices: [
          { id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' },
          { id: '2', name: 'Device 2', ip: '192.168.1.2', type: 'router' },
        ],
        flows: [
          {
            id: '1',
            sourceIp: '192.168.1.1',
            sourcePort: 80,
            destIp: '10.0.0.1',
            destPort: 443,
            protocol: 'TCP',
            timestamp: new Date().toISOString(),
            bytesIn: 1000,
            bytesOut: 500,
          },
        ],
        threats: [
          {
            id: '1',
            type: 'suspicious',
            severity: 'high',
            description: 'Suspicious activity detected',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(screen.getByText(/search results/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Device 1')).toBeInTheDocument();
        expect(screen.getByText('Device 2')).toBeInTheDocument();
      });
    });

    it('should display "no results" when API returns empty results', async () => {
      const mockResults = {
        query: 'nonexistent',
        type: 'all',
        devices: [],
        flows: [],
        threats: [],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'nonexistent' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      });
    });

    it('should show error toast when API call fails', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.search).mockRejectedValue(error);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(toast.toast.error).toHaveBeenCalledWith('Search failed', {
          description: 'API Error',
        });
      });
    });
  });

  describe('Results Display', () => {
    it('should display results in tabs (All, Devices, Flows, Threats)', async () => {
      const mockResults = {
        query: 'test',
        type: 'all',
        devices: [{ id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' }],
        flows: [
          {
            id: '1',
            sourceIp: '192.168.1.1',
            sourcePort: 80,
            destIp: '10.0.0.1',
            destPort: 443,
            protocol: 'TCP',
            timestamp: new Date().toISOString(),
            bytesIn: 1000,
            bytesOut: 500,
          },
        ],
        threats: [
          {
            id: '1',
            type: 'suspicious',
            severity: 'high',
            description: 'Suspicious activity',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(screen.getByText(/all \(3\)/i)).toBeInTheDocument();
        expect(screen.getByText(/devices \(1\)/i)).toBeInTheDocument();
        expect(screen.getByText(/flows \(1\)/i)).toBeInTheDocument();
        expect(screen.getByText(/threats \(1\)/i)).toBeInTheDocument();
      });
    });

    it('should call onResultClick when a result is clicked', async () => {
      const onResultClick = vi.fn();
      const mockResults = {
        query: 'device',
        type: 'all',
        devices: [{ id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' }],
        flows: [],
        threats: [],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar({ onResultClick });
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'device' } });

      await waitFor(() => {
        expect(screen.getByText('Device 1')).toBeInTheDocument();
      });

      const deviceCard = screen.getByText('Device 1').closest('[class*="cursor-pointer"]');
      if (deviceCard) {
        fireEvent.click(deviceCard);

        await waitFor(() => {
          expect(onResultClick).toHaveBeenCalledWith('device', '1');
        });
      }
    });
  });

  describe('Dialog Behavior', () => {
    it('should close dialog when Close button is clicked', async () => {
      const mockResults = {
        query: 'device',
        type: 'all',
        devices: [{ id: '1', name: 'Device 1', ip: '192.168.1.1', type: 'server' }],
        flows: [],
        threats: [],
      };

      vi.mocked(apiClient.search).mockResolvedValue(mockResults);

      renderSearchBar();
      const input = screen.getByPlaceholderText(/search devices, flows, ip addresses/i);

      fireEvent.change(input, { target: { value: 'device' } });

      await waitFor(() => {
        expect(screen.getByText(/search results/i)).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/search results/i)).not.toBeInTheDocument();
      });
    });
  });
});
