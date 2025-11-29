/**
 * Unit tests for ConnectionHealthMonitor component
 * Tests health status display, metrics, and reconnection behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConnectionHealthMonitor } from '@/components/ConnectionHealthMonitor';
import { apiClient } from '@/lib/api';
import * as toast from 'sonner';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiClient: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

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
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    it('should display disconnected status when not connected', () => {
      renderHealthMonitor({ isConnected: false });
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
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

      renderHealthMonitor();

      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalled();
      });
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

      renderHealthMonitor();

      await waitFor(() => {
        expect(screen.getByText(/healthy/i)).toBeInTheDocument();
      });
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

      // Mock high latency
      globalThis.performance.now = vi.fn(() => 1500); // 1500ms latency

      renderHealthMonitor();

      await waitFor(() => {
        expect(screen.getByText(/degraded/i)).toBeInTheDocument();
      });
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

      renderHealthMonitor({ enableMetrics: true });

      await waitFor(() => {
        expect(screen.getByText(/latency/i)).toBeInTheDocument();
      });
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

      renderHealthMonitor();

      await waitFor(() => {
        expect(screen.getByText(/10/)).toBeInTheDocument();
      });
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

      renderHealthMonitor();

      await waitFor(() => {
        expect(screen.getByText(/5/)).toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      renderHealthMonitor({ error: 'Connection failed', onRetry });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should check health again when retry is clicked', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
      };

      vi.mocked(apiClient.healthCheck).mockResolvedValue(mockHealth);

      renderHealthMonitor({ error: 'Connection failed' });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(apiClient.healthCheck).toHaveBeenCalledTimes(2); // Once on mount, once on retry
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

      renderHealthMonitor();

      await waitFor(() => {
        expect(screen.getByText(/storage/i)).toBeInTheDocument();
        expect(screen.getByText(/packet capture/i)).toBeInTheDocument();
      });
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

      // Change to connected
      rerender(<ConnectionHealthMonitor isConnected={true} error={null} />);

      await waitFor(() => {
        expect(toast.toast.success).toHaveBeenCalled();
      });
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

      // Mock high latency
      globalThis.performance.now = vi.fn(() => 1500);

      renderHealthMonitor();

      await waitFor(() => {
        expect(toast.toast.warning).toHaveBeenCalled();
      });
    });

    it('should show error notification when status changes to offline', async () => {
      renderHealthMonitor({ isConnected: true, error: null });

      // Change to offline
      const { rerender } = renderHealthMonitor({ isConnected: true, error: null });
      rerender(<ConnectionHealthMonitor isConnected={false} error="Connection failed" />);

      await waitFor(() => {
        expect(toast.toast.error).toHaveBeenCalled();
      });
    });
  });
});
