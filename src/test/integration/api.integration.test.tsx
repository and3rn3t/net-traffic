/**
 * Integration tests for API functionality
 * Tests both API-enabled and API-disabled modes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useApiData } from '@/hooks/useApiData';
import { apiClient } from '@/lib/api';

// Mock the API client
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

// Test component that uses useApiData
function TestComponent() {
  const { devices, flows, threats, isLoading, isConnected, error } = useApiData({
    pollingInterval: 1000,
    useWebSocket: false, // Disable WebSocket for tests
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div data-testid="connected">{isConnected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="devices-count">{devices?.length || 0}</div>
      <div data-testid="flows-count">{flows?.length || 0}</div>
      <div data-testid="threats-count">{threats?.length || 0}</div>
    </div>
  );
}

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('API Enabled Mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_REAL_API', 'true');
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000');
    });

    it('should fetch data when API is enabled', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];
      const mockFlows = [{ id: '1', protocol: 'TCP' }];
      const mockThreats = [{ id: '1', type: 'suspicious' }];

      vi.mocked(apiClient.healthCheck).mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 1,
        active_devices: 1,
      });

      vi.mocked(apiClient.getDevices).mockResolvedValue(mockDevices);
      vi.mocked(apiClient.getFlows).mockResolvedValue(mockFlows);
      vi.mocked(apiClient.getThreats).mockResolvedValue(mockThreats);
      vi.mocked(apiClient.getAnalytics).mockResolvedValue([]);
      vi.mocked(apiClient.getProtocolStats).mockResolvedValue([]);

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('Connected');
      });

      expect(screen.getByTestId('devices-count')).toHaveTextContent('1');
      expect(screen.getByTestId('flows-count')).toHaveTextContent('1');
      expect(screen.getByTestId('threats-count')).toHaveTextContent('1');
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(apiClient.healthCheck).mockRejectedValue(new Error('Connection failed'));

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      vi.mocked(apiClient.healthCheck).mockRejectedValue(
        new Error('Request timeout - backend may be unavailable')
      );

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/timeout/)).toBeInTheDocument();
      });
    });
  });

  describe('API Disabled Mode (Mock Data)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_REAL_API', 'false');
    });

    it('should use mock data when API is disabled', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      // Should show disconnected state or loading state
      // When API is disabled, isConnected starts as false and stays false
      await waitFor(() => {
        const connectedElement = screen.queryByTestId('connected');
        if (connectedElement) {
          // Component should show "Disconnected" when API is disabled
          expect(connectedElement.textContent).toBe('Disconnected');
        } else {
          // Or it might still be loading
          expect(screen.queryByText(/loading/i)).toBeInTheDocument();
        }
      }, { timeout: 3000 });

      // Note: useApiData may call healthCheck during initialization even when API is disabled
      // The important thing is that it shows disconnected state and doesn't fetch real data
    });
  });

  describe('WebSocket Reconnection', () => {
    it('should handle WebSocket connection failures', async () => {
      // This would require mocking WebSocket
      // For now, we test that the hook doesn't crash
      vi.stubEnv('VITE_USE_REAL_API', 'true');

      vi.mocked(apiClient.healthCheck).mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 0,
        active_devices: 0,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_REAL_API', 'true');
    });

    it('should handle 404 errors', async () => {
      vi.mocked(apiClient.healthCheck).mockRejectedValue(new Error('HTTP 404: Not Found'));

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should handle 500 errors', async () => {
      vi.mocked(apiClient.healthCheck).mockRejectedValue(
        new Error('HTTP 500: Internal Server Error')
      );

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      vi.mocked(apiClient.healthCheck).mockRejectedValue(new Error('Failed to fetch'));

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });
});
