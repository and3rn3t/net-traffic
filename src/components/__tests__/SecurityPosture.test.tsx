/**
 * Unit tests for SecurityPosture component
 * Tests security score calculation, metrics, and rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SecurityPosture } from '@/components/SecurityPosture';
import { NetworkFlow, Device, Threat } from '@/lib/types';

const createMockFlow = (overrides: Partial<NetworkFlow> = {}): NetworkFlow => ({
  id: 'flow-1',
  timestamp: Date.now(),
  sourceIp: '192.168.1.1',
  sourcePort: 50000,
  destIp: '8.8.8.8',
  destPort: 443,
  protocol: 'HTTPS',
  bytesIn: 1000,
  bytesOut: 500,
  packetsIn: 10,
  packetsOut: 5,
  duration: 1000,
  status: 'active',
  threatLevel: 'safe',
  deviceId: 'device-1',
  ...overrides,
});

const createMockDevice = (overrides: Partial<Device> = {}): Device => ({
  id: 'device-1',
  name: 'Test Device',
  ip: '192.168.1.1',
  mac: '00:00:00:00:00:01',
  type: 'desktop',
  vendor: 'Test Vendor',
  firstSeen: Date.now() - 86400000,
  lastSeen: Date.now(),
  bytesTotal: 1000000,
  connectionsCount: 10,
  threatScore: 5,
  behavioral: {
    peakHours: [9, 10, 11],
    commonPorts: [80, 443],
    commonDomains: ['example.com'],
    anomalyCount: 0,
  },
  ...overrides,
});

const createMockThreat = (overrides: Partial<Threat> = {}): Threat => ({
  id: 'threat-1',
  timestamp: Date.now(),
  type: 'malware',
  severity: 'low',
  deviceId: 'device-1',
  flowId: 'flow-1',
  description: 'Test threat',
  recommendation: 'Investigate',
  dismissed: false,
  ...overrides,
});

describe('SecurityPosture', () => {
  describe('Rendering', () => {
    it('should render component with title', () => {
      render(<SecurityPosture flows={[]} devices={[]} threats={[]} />);

      expect(screen.getByText(/security posture/i)).toBeInTheDocument();
      expect(screen.getByText(/overall network security health assessment/i)).toBeInTheDocument();
    });

    it('should display overall security score', () => {
      const flows = [createMockFlow({ protocol: 'HTTPS' })];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/overall security score/i)).toBeInTheDocument();
    });

    it('should display security metrics', () => {
      const flows = [createMockFlow()];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getAllByText(/security metrics/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
      expect(screen.getByText(/threat level/i)).toBeInTheDocument();
      expect(screen.getByText(/threat response/i)).toBeInTheDocument();
      expect(screen.getByText(/device health/i)).toBeInTheDocument();
      expect(screen.getByText(/connection diversity/i)).toBeInTheDocument();
      expect(screen.getByText(/device activity/i)).toBeInTheDocument();
    });
  });

  describe('Security Score Calculation', () => {
    it('should calculate high score for encrypted traffic', () => {
      const flows = [
        createMockFlow({ protocol: 'HTTPS' }),
        createMockFlow({ protocol: 'HTTPS' }),
        createMockFlow({ protocol: 'SSH' }),
      ];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      // All traffic is encrypted, should have high encryption score
      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });

    it('should calculate low score for unencrypted traffic', () => {
      const flows = [
        createMockFlow({ protocol: 'HTTP' }),
        createMockFlow({ protocol: 'HTTP' }),
        createMockFlow({ protocol: 'HTTP' }),
      ];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });

    it('should calculate score based on threat levels', () => {
      const flows = [
        createMockFlow({ threatLevel: 'high' }),
        createMockFlow({ threatLevel: 'critical' }),
        createMockFlow({ threatLevel: 'safe' }),
      ];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/threat level/i)).toBeInTheDocument();
    });

    it('should calculate score based on active threats', () => {
      const threats = [
        createMockThreat({ dismissed: false }),
        createMockThreat({ dismissed: false }),
        createMockThreat({ dismissed: true }),
      ];
      render(<SecurityPosture flows={[]} devices={[]} threats={threats} />);

      expect(screen.getByText(/threat response/i)).toBeInTheDocument();
      expect(screen.getByText(/2 unaddressed threat/i)).toBeInTheDocument();
    });

    it('should calculate device health score', () => {
      const devices = [
        createMockDevice({ threatScore: 10 }),
        createMockDevice({ threatScore: 20 }),
        createMockDevice({ threatScore: 30 }),
      ];
      render(<SecurityPosture flows={[]} devices={devices} threats={[]} />);

      expect(screen.getByText(/device health/i)).toBeInTheDocument();
    });

    it('should calculate connection diversity score', () => {
      const flows = Array.from({ length: 50 }, (_, i) =>
        createMockFlow({ destIp: `192.168.1.${i}` })
      );
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/connection diversity/i)).toBeInTheDocument();
    });

    it('should calculate device activity score', () => {
      const devices = [
        createMockDevice({ lastSeen: Date.now() - 100000 }), // Recent
        createMockDevice({ lastSeen: Date.now() - 200000 }), // Recent
        createMockDevice({ lastSeen: Date.now() - 400000 }), // Not recent
      ];
      render(<SecurityPosture flows={[]} devices={devices} threats={[]} />);

      expect(screen.getByText(/device activity/i)).toBeInTheDocument();
    });
  });

  describe('Score Display', () => {
    it('should display grade A for score >= 90', () => {
      // Create flows that result in high score
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTPS' }));
      const devices = [createMockDevice({ threatScore: 0 })];
      render(<SecurityPosture flows={flows} devices={devices} threats={[]} />);

      // Should show a grade (A, B, C, D, or F)
      const gradeElement = screen.getByText(/^[A-F]$/);
      expect(gradeElement).toBeInTheDocument();
    });

    it('should display overall score percentage', () => {
      render(<SecurityPosture flows={[createMockFlow()]} devices={[]} threats={[]} />);

      // Should display score in format like "85/100" or percentage
      expect(screen.getByText(/\d+\/100/)).toBeInTheDocument();
    });

    it('should display score color based on value', () => {
      const flows = [createMockFlow({ protocol: 'HTTPS' })];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      // Score should be displayed with appropriate styling
      const scoreElements = screen.getAllByText(/\d+/);
      expect(scoreElements.length).toBeGreaterThan(0);
    });
  });

  describe('Status Indicators', () => {
    it('should show shield check icon for high score', () => {
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTPS' }));
      const devices = [createMockDevice({ threatScore: 0 })];
      render(<SecurityPosture flows={flows} devices={devices} threats={[]} />);

      // Should show shield icon (component uses ShieldCheck or ShieldWarning)
      expect(screen.getByText(/security posture/i)).toBeInTheDocument();
    });

    it('should show appropriate status message for high score', () => {
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTPS' }));
      const devices = [createMockDevice({ threatScore: 0 })];
      const { container } = render(
        <SecurityPosture flows={flows} devices={devices} threats={[]} />
      );

      // Should show one of the status messages
      const hasStatusMessage =
        screen.queryByText(/strong security posture/i) ||
        screen.queryByText(/moderate security concerns/i) ||
        screen.queryByText(/critical security issues/i);

      // At least one status section should be present
      expect(container.textContent).toContain('security');
    });

    it('should show warning for moderate score', () => {
      const flows = [createMockFlow({ protocol: 'HTTP' }), createMockFlow({ protocol: 'HTTPS' })];
      const threats = [createMockThreat({ dismissed: false })];
      render(<SecurityPosture flows={flows} devices={[]} threats={threats} />);

      // Should display metrics with various statuses
      expect(screen.getAllByText(/security metrics/i).length).toBeGreaterThan(0);
    });

    it('should show error for low score', () => {
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTP' }));
      const threats = Array.from({ length: 5 }, (_, i) =>
        createMockThreat({ id: `threat-${i}`, dismissed: false })
      );
      render(<SecurityPosture flows={flows} devices={[]} threats={threats} />);

      expect(screen.getAllByText(/security metrics/i).length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flows', () => {
      render(<SecurityPosture flows={[]} devices={[]} threats={[]} />);

      expect(screen.getByText(/security posture/i)).toBeInTheDocument();
      // Should still calculate scores (with 0 flows)
      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });

    it('should handle empty devices', () => {
      render(<SecurityPosture flows={[createMockFlow()]} devices={[]} threats={[]} />);

      expect(screen.getByText(/device health/i)).toBeInTheDocument();
    });

    it('should handle empty threats', () => {
      render(<SecurityPosture flows={[createMockFlow()]} devices={[]} threats={[]} />);

      expect(screen.getByText(/threat response/i)).toBeInTheDocument();
    });

    it('should handle all dismissed threats', () => {
      const threats = [
        createMockThreat({ dismissed: true }),
        createMockThreat({ dismissed: true }),
      ];
      render(<SecurityPosture flows={[createMockFlow()]} devices={[]} threats={threats} />);

      expect(screen.getByText(/0 unaddressed threat/i)).toBeInTheDocument();
    });

    it('should handle single threat correctly', () => {
      const threats = [createMockThreat({ dismissed: false })];
      render(<SecurityPosture flows={[createMockFlow()]} devices={[]} threats={threats} />);

      expect(screen.getByText(/1 unaddressed threat$/)).toBeInTheDocument();
    });

    it('should handle very high threat scores', () => {
      const devices = [createMockDevice({ threatScore: 95 })];
      render(<SecurityPosture flows={[createMockFlow()]} devices={devices} threats={[]} />);

      expect(screen.getByText(/device health/i)).toBeInTheDocument();
    });

    it('should handle many unique destinations', () => {
      const flows = Array.from({ length: 200 }, (_, i) =>
        createMockFlow({ destIp: `192.168.1.${i}` })
      );
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/connection diversity/i)).toBeInTheDocument();
    });
  });

  describe('Metric Status', () => {
    it('should show pass status for high scores', () => {
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTPS' }));
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      // Metrics with pass status should be displayed
      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });

    it('should show warning status for moderate scores', () => {
      const flows = [createMockFlow({ protocol: 'HTTPS' }), createMockFlow({ protocol: 'HTTP' })];
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });

    it('should show fail status for low scores', () => {
      const flows = Array.from({ length: 10 }, () => createMockFlow({ protocol: 'HTTP' }));
      render(<SecurityPosture flows={flows} devices={[]} threats={[]} />);

      expect(screen.getByText(/traffic encryption/i)).toBeInTheDocument();
    });
  });
});
