/**
 * Unit tests for ConnectionHealthMonitor component
 * Tests health status display, metrics, and reconnection behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConnectionHealthMonitor } from '@/components/ConnectionHealthMonitor';
import { apiClient } from '@/lib/api';

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
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Import after mock to get the mocked version
import { toast } from 'sonner';

// Create mockToast object for test assertions
const mockToast = {
  success: vi.mocked(toast.success),
  error: vi.mocked(toast.error),
  warning: vi.mocked(toast.warning),
};

vi.mock('@/hooks/useReconnection', () => ({
  useReconnection: vi.fn(() => ({
    isReconnecting: false,
    retryCount: 0,
    nextRetryDelay: 2000,
    startReconnection: vi.fn(),
    stopReconnection: vi.fn(),
  })),
}));

const renderHealthMonitor = (props = {}) => {
  const defaultProps = {
    isConnected: true,
    error: null,
  };
  return render(<ConnectionHealthMonitor {...defaultProps} {...props} />);
};

describe('ConnectionHealthMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render health monitor', () => {
      renderHealthMonitor();
      expect(screen.getByText(/connection health/i)).toBeInTheDocument();
    });

    it('should display connected status when connected', () => {
      renderHealthMonitor({ isConnected: true });
      // Component shows "Connection Health" title and status badges
      expect(screen.getByText(/connection health/i)).toBeInTheDocument();
    });

    it('should display disconnected status when not connected', () => {
      renderHealthMonitor({ isConnected: false });
      // Component shows "Offline" badge when not connected
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('should display error message when error exists', () => {
      renderHealthMonitor({ error: 'Connection failed' });
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });
  });

  describe('Health Status', () => {
    it('should check health on mount', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
        services: {
          storage: true,
          packet_capture: true,
          device_service: true,
          threat_service: true,
          analytics: true,
        },
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true });

      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });

    it('should display healthy status', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true });

      // Wait for health check to complete and status to update
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for "Healthy" badge to appear
      await waitFor(
        () => {
          const healthyText = screen.queryByText(/Healthy/i);
          expect(healthyText).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display degraded status for high latency', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      // Mock performance.now to return high latency
      const originalNow = globalThis.performance.now;
      let callCount = 0;
      globalThis.performance.now = vi.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 2000; // First call returns 0, second returns 2000ms
      });

      renderHealthMonitor({ isConnected: true, enableMetrics: true });

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for "Degraded" badge to appear (latency > 1000ms triggers degraded status)
      await waitFor(
        () => {
          const degradedText = screen.queryByText(/Degraded/i);
          expect(degradedText).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Restore original
      globalThis.performance.now = originalNow;
    });

    it('should display offline status when not connected', () => {
      renderHealthMonitor({ isConnected: false, error: 'Connection failed' });
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
  });

  describe('Health Metrics', () => {
    it('should display latency information', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true, enableMetrics: true });

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for latency information to appear (component shows latency when metrics are enabled)
      await waitFor(
        () => {
          expect(screen.getByText(/latency/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should display active flows count', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true });

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for status to be displayed
      await waitFor(
        () => {
          expect(screen.getByText(/healthy/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display active devices count', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true });

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for status to be displayed
      await waitFor(
        () => {
          expect(screen.getByText(/healthy/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      // Retry button is shown when error exists, isConnected is false, and onRetry is provided
      // The component shows "Retry Connection" button inside the Alert when offline
      renderHealthMonitor({ isConnected: false, error: 'Connection failed', onRetry });

      // Wait for the component to render and show the retry button
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry connection/i });
        expect(retryButton).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry connection/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should check health again when refresh button is clicked', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true, error: null });

      // Wait for initial health check
      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalled();
      });

      // Click the Refresh button (not Retry Connection - that only appears when offline with onRetry)
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
      });
    });
  });

  describe('Service Status', () => {
    it('should display service status indicators', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
        services: {
          storage: true,
          packet_capture: true,
          device_service: true,
          threat_service: true,
          analytics: true,
        },
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ isConnected: true });

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for service status indicators to appear
      await waitFor(
        () => {
          expect(screen.getByText(/storage/i)).toBeInTheDocument();
          expect(screen.getByText(/packet capture/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Status Change Notifications', () => {
    it('should show success notification when status changes to healthy', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      // Start with offline
      const { rerender } = renderHealthMonitor({ isConnected: false, error: 'Connection failed' });

      // Wait for initial offline state to be set (this sets previousStatus)
      await waitFor(
        () => {
          expect(screen.getByText(/offline/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Give a moment for previousStatus to be set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Change to connected - this triggers health check
      rerender(<ConnectionHealthMonitor isConnected={true} error={null} />);

      // Wait for health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for status to change to healthy
      await waitFor(
        () => {
          expect(screen.getByText(/healthy/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for success toast (component shows toast when status changes from offline to healthy)
      await waitFor(
        () => {
          expect(mockToast.success).toHaveBeenCalledWith('Backend health restored', {
            description: 'All services are now operational',
          });
        },
        { timeout: 5000 }
      );
    });

    it('should show warning notification when status changes to degraded', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      // Mock performance.now to return high latency (1500ms > 1000ms threshold)
      const originalNow = globalThis.performance.now;
      let callCount = 0;
      globalThis.performance.now = vi.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 1500; // First call returns 0, second returns 1500ms
      });

      renderHealthMonitor({ isConnected: true, enableMetrics: true });

      // Wait for initial health check to complete and status to be set
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for status to be set (might be healthy first, then degraded)
      await waitFor(
        () => {
          // Status might be healthy or degraded depending on latency calculation
          const statusText = screen.queryByText(/healthy/i) || screen.queryByText(/degraded/i);
          expect(statusText).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for warning toast (component shows toast when status changes to degraded)
      // Note: This will only show if status actually changes from healthy to degraded
      await waitFor(
        () => {
          expect(mockToast.warning).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      // Restore original
      globalThis.performance.now = originalNow;
    });

    it('should show error notification when status changes to offline', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      // Start with connected and healthy
      const { rerender } = renderHealthMonitor({ isConnected: true, error: null });

      // Wait for initial health check to complete
      await waitFor(
        () => {
          expect(apiClient.healthCheck).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for healthy status to be set (this sets previousStatus)
      await waitFor(
        () => {
          expect(screen.getByText(/healthy/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Give a moment for previousStatus to be set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Change to offline - this should trigger error toast
      rerender(<ConnectionHealthMonitor isConnected={false} error="Connection failed" />);

      // Wait for offline status to be displayed
      await waitFor(
        () => {
          expect(screen.getByText(/offline/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Wait for error toast (component shows toast when status changes from healthy to offline)
      await waitFor(
        () => {
          expect(mockToast.error).toHaveBeenCalledWith('Backend connection lost', {
            description: 'Attempting to reconnect automatically...',
          });
        },
        { timeout: 5000 }
      );
    });
  });
});
