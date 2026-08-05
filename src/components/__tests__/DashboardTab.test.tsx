/**
 * Unit tests for DashboardTab component
 * Tests widget rendering, edit mode, add/remove flows, and localStorage persistence
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardTab } from '@/components/dashboard/DashboardTab';
import type { Threat } from '@/lib/types';

vi.mock('@/components/TrafficChart', () => ({
  TrafficChart: () => <div data-testid="traffic-chart">Traffic chart</div>,
}));

vi.mock('@/components/ConnectionsTable', () => ({
  ConnectionsTable: () => <div data-testid="connections-table">Connections table</div>,
}));

const noop = () => {};

const defaultProps = {
  activeFlowsCount: 5,
  totalFlows: 20,
  useRealApi: false,
  summaryStats: null,
  totalBytes: 1_000_000,
  totalDevices: 10,
  activeDevicesCount: 8,
  avgThreatScore: 20,
  activeThreats: [] as Threat[],
  onDismissThreat: noop,
  analyticsData: [],
  USE_REAL_API: false,
  isConnected: false,
  flows: [],
  devices: [],
};

describe('DashboardTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the three default widgets', () => {
    render(<DashboardTab {...defaultProps} />);

    expect(screen.getByText('Active Connections')).toBeInTheDocument();
    expect(screen.getByTestId('traffic-chart')).toBeInTheDocument();
    expect(screen.getByTestId('connections-table')).toBeInTheDocument();
  });

  it('hides remove controls until edit mode is enabled', () => {
    render(<DashboardTab {...defaultProps} />);

    expect(screen.queryByLabelText(/Remove .* widget/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));

    expect(screen.getAllByLabelText(/Remove .* widget/).length).toBeGreaterThan(0);
  });

  it('removes a widget and persists the change', async () => {
    render(<DashboardTab {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByLabelText('Remove Traffic chart widget'));

    await waitFor(() => {
      expect(screen.queryByTestId('traffic-chart')).not.toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem('netinsight_dashboard_layout')!);
    expect(stored.widgetIds).not.toContain('traffic-chart');
  });

  it('re-adds a removed widget from the add-widget dialog', async () => {
    render(<DashboardTab {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByLabelText('Remove Traffic chart widget'));
    await waitFor(() => expect(screen.queryByTestId('traffic-chart')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByTestId('traffic-chart')).toBeInTheDocument();
    });
  });

  it('shows the active threats banner when there are undismissed threats', () => {
    const threat: Threat = {
      id: 't1',
      timestamp: Date.now(),
      type: 'malware',
      severity: 'high',
      description: 'Test threat',
      dismissed: false,
    } as Threat;

    render(<DashboardTab {...defaultProps} activeThreats={[threat]} />);

    expect(screen.getByText('Active Threats')).toBeInTheDocument();
  });
});
