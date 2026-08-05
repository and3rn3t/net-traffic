/**
 * Unit tests for CommandPalette component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette } from '@/components/CommandPalette';
import type { Device } from '@/lib/types';

const mockDevice: Device = {
  id: 'device-1',
  name: 'Kitchen Laptop',
  ip: '192.168.1.42',
  mac: 'AA:BB:CC:DD:EE:FF',
  type: 'laptop',
  vendor: 'Acme',
  firstSeen: Date.now(),
  lastSeen: Date.now(),
  bytesTotal: 1000,
  connectionsCount: 5,
  threatScore: 0,
  behavioral: {
    peakHours: [],
    commonPorts: [],
    commonDomains: [],
    anomalyCount: 0,
  },
};

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

describe('CommandPalette', () => {
  const onTabChange = vi.fn();
  const onToggleCapture = vi.fn();

  beforeEach(() => {
    onTabChange.mockClear();
    onToggleCapture.mockClear();
  });

  it('opens on Cmd+K and lists navigation, device, and action items', async () => {
    render(
      <CommandPalette
        activeTab="dashboard"
        onTabChange={onTabChange}
        devices={[mockDevice]}
        isCapturing={true}
        onToggleCapture={onToggleCapture}
      />
    );

    openPalette();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });

    expect(screen.getByText('Go to Devices')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Laptop')).toBeInTheDocument();
    expect(screen.getByText('Pause packet capture')).toBeInTheDocument();
  });

  it('does not list the currently active tab', async () => {
    render(
      <CommandPalette
        activeTab="dashboard"
        onTabChange={onTabChange}
        devices={[]}
        isCapturing={false}
        onToggleCapture={onToggleCapture}
      />
    );

    openPalette();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });

    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
  });

  it('navigates and closes when a tab item is selected', async () => {
    render(
      <CommandPalette
        activeTab="dashboard"
        onTabChange={onTabChange}
        devices={[]}
        isCapturing={false}
        onToggleCapture={onToggleCapture}
      />
    );

    openPalette();

    const item = await screen.findByText('Go to Devices');
    fireEvent.click(item);

    expect(onTabChange).toHaveBeenCalledWith('devices');
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
    });
  });

  it('toggles packet capture when the action is selected', async () => {
    render(
      <CommandPalette
        activeTab="dashboard"
        onTabChange={onTabChange}
        devices={[]}
        isCapturing={false}
        onToggleCapture={onToggleCapture}
      />
    );

    openPalette();

    const item = await screen.findByText('Resume packet capture');
    fireEvent.click(item);

    expect(onToggleCapture).toHaveBeenCalledTimes(1);
  });
});
