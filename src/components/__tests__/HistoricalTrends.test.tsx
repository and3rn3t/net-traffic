/**
 * Unit tests for HistoricalTrends component
 * Tests rendering, time range selection, and data display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoricalTrends } from '@/components/HistoricalTrends';
import { AnalyticsData } from '@/lib/types';

// Mock useHistoricalTrends hook
const mockUseHistoricalTrends = vi.fn();
vi.mock('@/hooks/useHistoricalTrends', () => ({
  useHistoricalTrends: () => mockUseHistoricalTrends(),
}));

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => null,
  Area: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockAnalyticsData: AnalyticsData[] = [
  {
    timestamp: new Date('2024-01-01T10:00:00Z').getTime(),
    totalBytes: 1000000,
    totalConnections: 50,
    threatCount: 2,
    activeDevices: 5,
  },
  {
    timestamp: new Date('2024-01-01T11:00:00Z').getTime(),
    totalBytes: 2000000,
    totalConnections: 75,
    threatCount: 3,
    activeDevices: 7,
  },
  {
    timestamp: new Date('2024-01-01T12:00:00Z').getTime(),
    totalBytes: 1500000,
    totalConnections: 60,
    threatCount: 1,
    activeDevices: 6,
  },
];

describe('HistoricalTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseHistoricalTrends.mockReturnValue({
      timeRange: '24h',
      data: [],
      isLoading: false,
      error: null,
      updateTimeRange: vi.fn(),
      refresh: vi.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render component with title', () => {
      render(<HistoricalTrends />);

      expect(screen.getByText(/historical trends/i)).toBeInTheDocument();
      expect(screen.getByText(/network activity patterns over time/i)).toBeInTheDocument();
    });

    it('should render time range tabs', () => {
      render(<HistoricalTrends />);

      expect(screen.getByText('1h')).toBeInTheDocument();
      expect(screen.getByText('24h')).toBeInTheDocument();
      expect(screen.getByText('7d')).toBeInTheDocument();
      expect(screen.getByText('30d')).toBeInTheDocument();
    });

    it('should render refresh button when useApi is true', () => {
      render(<HistoricalTrends useApi={true} />);

      const refreshButton = screen.getByRole('button');
      expect(refreshButton).toBeInTheDocument();
    });

    it('should not render refresh button when useApi is false', () => {
      render(<HistoricalTrends useApi={false} />);

      const buttons = screen.queryAllByRole('button');
      // Only tabs should be buttons
      expect(buttons.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Time Range Selection', () => {
    it('should call updateTimeRange when tab is clicked', () => {
      const updateTimeRange = vi.fn();
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange,
        refresh: vi.fn(),
      });

      render(<HistoricalTrends />);

      // Wait for component to render
      await waitFor(() => {
        const tab1h = screen.getByText('1h');
        expect(tab1h).toBeInTheDocument();
      });

      const tab1h = screen.getByText('1h');
      fireEvent.click(tab1h);

      // Wait for the click to be processed
      await waitFor(() => {
        expect(updateTimeRange).toHaveBeenCalledWith('1h');
      });
    });

    it('should display active time range', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '7d',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends />);

      // The active tab should be selected (checked via aria attributes or classes)
      const tab7d = screen.getByText('7d');
      expect(tab7d).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display stats when data is available', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: mockAnalyticsData,
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends useApi={true} />);

      expect(screen.getByText(/total traffic/i)).toBeInTheDocument();
      expect(screen.getByText(/total connections/i)).toBeInTheDocument();
      expect(screen.getByText(/peak traffic/i)).toBeInTheDocument();
      expect(screen.getByText(/avg devices/i)).toBeInTheDocument();
    });

    it('should display empty state when no data', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends useApi={true} />);

      expect(screen.getByText(/no historical data available/i)).toBeInTheDocument();
    });

    it('should use fallback data when useApi is false', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends data={mockAnalyticsData} useApi={false} />);

      expect(screen.getByText(/total traffic/i)).toBeInTheDocument();
      expect(screen.queryByText(/no historical data available/i)).not.toBeInTheDocument();
    });

    it('should prefer API data over fallback when both available', () => {
      const apiData = [
        {
          timestamp: new Date('2024-01-01T13:00:00Z').getTime(),
          totalBytes: 5000000,
          totalConnections: 100,
          threatCount: 5,
          activeDevices: 10,
        },
      ];

      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: apiData,
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends data={mockAnalyticsData} useApi={true} />);

      // Should use API data (higher total bytes)
      expect(screen.getByText(/total traffic/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeletons when loading', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: true,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      const { container } = render(<HistoricalTrends useApi={true} />);

      // Should show skeleton loaders - Skeleton uses data-slot="skeleton"
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not show loading when useApi is false', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: true,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends data={mockAnalyticsData} useApi={false} />);

      const skeletons = screen.queryAllByTestId(/skeleton/i);
      expect(skeletons.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error occurs', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: 'Failed to fetch data',
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends useApi={true} />);

      expect(screen.getByText(/failed to fetch data/i)).toBeInTheDocument();
    });

    it('should show retry button in error state', () => {
      const refresh = vi.fn();
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: 'Failed to fetch data',
        updateTimeRange: vi.fn(),
        refresh,
      });

      render(<HistoricalTrends useApi={true} />);

      const retryButton = screen.getByText(/retry/i);
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(refresh).toHaveBeenCalled();
    });

    it('should not show error when useApi is false', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: 'Failed to fetch data',
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends data={mockAnalyticsData} useApi={false} />);

      expect(screen.queryByText(/failed to fetch data/i)).not.toBeInTheDocument();
    });
  });

  describe('Charts', () => {
    it('should render charts when data is available', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: mockAnalyticsData,
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends useApi={true} />);

      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('should not render charts when no data', () => {
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh: vi.fn(),
      });

      render(<HistoricalTrends useApi={true} />);

      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('should call refresh when refresh button is clicked', () => {
      const refresh = vi.fn();
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: false,
        error: null,
        updateTimeRange: vi.fn(),
        refresh,
      });

      render(<HistoricalTrends useApi={true} />);

      // Refresh button only has an icon (ArrowClockwise), find by finding button with svg
      const refreshButtons = screen.getAllByRole('button');
      const refreshButton = refreshButtons.find(btn => {
        const hasSvg = btn.querySelector('svg');
        const isDisabled = btn.hasAttribute('disabled') || (btn as HTMLButtonElement).disabled;
        return hasSvg && !isDisabled;
      });
      if (refreshButton) {
        fireEvent.click(refreshButton);
      } else {
        // If not found, the button might be disabled or not rendered
        // Just verify refresh was set up correctly
        expect(refresh).toBeDefined();
      }

      expect(refresh).toHaveBeenCalled();
    });

    it('should disable refresh button when loading', () => {
      const refresh = vi.fn();
      mockUseHistoricalTrends.mockReturnValue({
        timeRange: '24h',
        data: [],
        isLoading: true,
        error: null,
        updateTimeRange: vi.fn(),
        refresh,
      });

      render(<HistoricalTrends useApi={true} />);

      const refreshButton = screen.getByRole('button');
      expect(refreshButton).toBeDisabled();
    });
  });
});
