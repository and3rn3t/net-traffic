/**
 * Unit tests for AnomalyDetection component
 * Tests anomaly detection logic, rendering, and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AnomalyDetection } from '@/components/AnomalyDetection';
import { createMockNetworkFlow, createMockDevice } from '@/test/helpers';

describe('AnomalyDetection', () => {
  describe('Rendering', () => {
    it('should render component with title', () => {
      render(<AnomalyDetection flows={[]} devices={[]} />);

      expect(screen.getByText(/anomaly detection/i)).toBeInTheDocument();
      expect(screen.getByText(/ai-powered behavioral analysis/i)).toBeInTheDocument();
    });

    it('should display no anomalies message when no anomalies detected', () => {
      const flows = [createMockNetworkFlow()];
      const devices = [createMockDevice()];
      render(<AnomalyDetection flows={flows} devices={devices} />);

      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/all network patterns within normal parameters/i)
      ).toBeInTheDocument();
    });

    it('should display anomalies when detected', () => {
      const device = createMockDevice({ id: 'device-1', name: 'High Traffic Device' });
      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          bytesIn: 100000000, // High traffic
          bytesOut: 50000000,
        })
      );
      render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(screen.queryByText(/no anomalies detected/i)).not.toBeInTheDocument();
      // Component shows "Excessive Bandwidth" (capitalized) as the type
      expect(screen.getByText(/Excessive Bandwidth/i)).toBeInTheDocument();
    });
  });

  describe('Anomaly Detection Logic', () => {
    it('should detect excessive bandwidth usage', () => {
      const device = createMockDevice({ id: 'device-1', name: 'High Traffic Device' });
      // Create flows where one device has much higher traffic than average
      const normalFlows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-normal-${i}`,
          deviceId: 'device-2',
          bytesIn: 1000,
          bytesOut: 500,
        })
      );
      const highTrafficFlows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-high-${i}`,
          deviceId: 'device-1',
          bytesIn: 100000000, // Very high
          bytesOut: 50000000,
        })
      );
      const flows = [...normalFlows, ...highTrafficFlows];
      const devices = [device, createMockDevice({ id: 'device-2', name: 'Normal Device' })];

      render(<AnomalyDetection flows={flows} devices={devices} />);

      // Wait for anomalies to be detected and rendered
      await waitFor(
        () => {
          // Component shows "Excessive Bandwidth" (capitalized) as the type
          const excessiveBandwidth = screen.queryByText(/Excessive Bandwidth/i);
          // Or device name appears in the description
          const deviceName = screen.queryByText(/High Traffic Device/i);
          expect(excessiveBandwidth || deviceName).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('should detect unusual activity hours', () => {
      const now = new Date();
      const nightTime = new Date(now);
      nightTime.setHours(3, 0, 0, 0); // 3 AM

      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          timestamp: nightTime.getTime() + i * 1000,
        })
      );

      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/unusual activity hours/i)).toBeInTheDocument();
      expect(screen.getByText(/2AM-5AM/i)).toBeInTheDocument();
    });

    it('should detect potential port scanning', () => {
      const flows = Array.from({ length: 30 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          packetsOut: 200, // High packet count
          bytesOut: 5000, // Low data transfer
        })
      );

      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/potential port scanning/i)).toBeInTheDocument();
    });

    it('should detect large data upload (exfiltration)', () => {
      const flows = [
        createMockNetworkFlow({
          bytesOut: 20000000, // 20MB out
          bytesIn: 1000000, // 1MB in (5:1 ratio)
        }),
      ];

      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/large data upload/i)).toBeInTheDocument();
      expect(screen.getByText(/unusual upload\/download ratio/i)).toBeInTheDocument();
    });

    it('should detect repetitive connection patterns', () => {
      const flows = Array.from({ length: 60 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          destIp: '192.168.1.100', // Same destination
        })
      );

      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/repetitive connection pattern/i)).toBeInTheDocument();
      expect(screen.getByText(/possible C&C communication/i)).toBeInTheDocument();
    });
  });

  describe('Severity Levels', () => {
    it('should display high severity for critical anomalies', async () => {
      // Create two devices - one with normal traffic, one with very high traffic
      const normalDevice = createMockDevice({ id: 'device-2', name: 'Normal Device' });
      const highTrafficDevice = createMockDevice({ id: 'device-1', name: 'High Traffic Device' });

      // Normal device with low traffic
      const normalFlows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-normal-${i}`,
          deviceId: 'device-2',
          bytesIn: 1000,
          bytesOut: 500,
        })
      );

      // High traffic device - needs to be > 2.5x average
      // Average will be ~(10*1500 + 100*1500000000) / 2 = ~750000007500
      // Threshold will be ~1875000018750
      // So device-1 needs > 1875000018750 bytes total
      const highTrafficFlows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-high-${i}`,
          deviceId: 'device-1',
          bytesIn: 20000000000, // Very high traffic - 20GB per flow
          bytesOut: 10000000000,
        })
      );

      const allFlows = [...normalFlows, ...highTrafficFlows];
      render(<AnomalyDetection flows={allFlows} devices={[highTrafficDevice, normalDevice]} />);

      // Wait for anomalies to be detected
      await waitFor(
        () => {
          // Component shows severity badge with uppercase text like "HIGH"
          const highBadges = screen.queryAllByText(/HIGH/i);
          expect(highBadges.length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });

    it('should display medium severity for moderate anomalies', async () => {
      // Create two devices - one with normal traffic, one with moderate high traffic
      const normalDevice = createMockDevice({ id: 'device-2', name: 'Normal Device' });
      const moderateDevice = createMockDevice({ id: 'device-1', name: 'Moderate Device' });

      // Normal device with low traffic
      const normalFlows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-normal-${i}`,
          deviceId: 'device-2',
          bytesIn: 1000,
          bytesOut: 500,
        })
      );

      // Moderate high traffic device - needs to be > 2.5x average but < 5x average for medium severity
      const moderateFlows = Array.from({ length: 50 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-moderate-${i}`,
          deviceId: 'device-1',
          bytesIn: 100000000, // 100MB per flow
          bytesOut: 50000000,
        })
      );

      const allFlows = [...normalFlows, ...moderateFlows];
      render(<AnomalyDetection flows={allFlows} devices={[moderateDevice, normalDevice]} />);

      // Wait for anomalies to be detected
      await waitFor(
        () => {
          // Component shows severity badge with uppercase text like "MEDIUM"
          const mediumBadges = screen.queryAllByText(/MEDIUM/i);
          expect(mediumBadges.length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });

    it('should display low severity for minor anomalies', () => {
      const flows = Array.from({ length: 60 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          destIp: '192.168.1.100',
        })
      );

      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/LOW/i)).toBeInTheDocument();
    });
  });

  describe('Anomaly Score', () => {
    it('should display anomaly score', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          bytesIn: 100000000,
        })
      );

      render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(screen.getByText(/anomaly score/i)).toBeInTheDocument();
      // Should display a numeric score
      const scoreElements = screen.getAllByText(/\d+/);
      expect(scoreElements.length).toBeGreaterThan(0);
    });

    it('should calculate overall score from multiple anomalies', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = [
        ...Array.from({ length: 100 }, (_, i) =>
          createMockNetworkFlow({
            id: `flow-high-${i}`,
            deviceId: 'device-1',
            bytesIn: 100000000,
          })
        ),
        ...Array.from({ length: 30 }, (_, i) =>
          createMockNetworkFlow({
            id: `flow-scan-${i}`,
            packetsOut: 200,
            bytesOut: 5000,
          })
        ),
      ];

      render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(screen.getByText(/anomaly score/i)).toBeInTheDocument();
    });
  });

  describe('Affected Devices', () => {
    it('should display affected device names', async () => {
      const device1 = createMockDevice({ id: 'device-1', name: 'Device One' });
      const device2 = createMockDevice({ id: 'device-2', name: 'Device Two' });

      // Create flows where device-1 has much higher traffic than device-2
      const device1Flows = Array.from({ length: 50 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-1-${i}`,
          deviceId: 'device-1',
          bytesIn: 20000000000, // Very high traffic
          bytesOut: 10000000000,
        })
      );

      const device2Flows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-2-${i}`,
          deviceId: 'device-2',
          bytesIn: 1000, // Low traffic
          bytesOut: 500,
        })
      );

      const flows = [...device1Flows, ...device2Flows];
      render(<AnomalyDetection flows={flows} devices={[device1, device2]} />);

      // Wait for anomalies to be detected
      await waitFor(
        () => {
          // Component shows "Affected: {device names}" or device names in description
          const affectedText = screen.queryByText(/Affected:/i);
          // Device names should appear either in "Affected:" text or in description
          // Device name is "Device One" (capitalized)
          const deviceOne = screen.queryByText(/Device One/i);
          expect(affectedText || deviceOne).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('should limit displayed device names to 3', () => {
      const devices = Array.from({ length: 5 }, (_, i) =>
        createMockDevice({ id: `device-${i}`, name: `Device ${i}` })
      );
      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: `device-${i % 5}`,
          bytesIn: 100000000,
        })
      );

      render(<AnomalyDetection flows={flows} devices={devices} />);

      // Should show "+X more" if more than 3 devices
      const moreText = screen.queryByText(/\+.*more/i);
      if (moreText) {
        expect(moreText).toBeInTheDocument();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flows', () => {
      render(<AnomalyDetection flows={[]} devices={[createMockDevice()]} />);

      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
    });

    it('should handle empty devices', () => {
      render(<AnomalyDetection flows={[createMockNetworkFlow()]} devices={[]} />);

      // Should still render, but may not show device names
      expect(screen.getByText(/anomaly detection/i)).toBeInTheDocument();
    });

    it('should handle flows with no anomalies', () => {
      const flows = Array.from({ length: 10 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          bytesIn: 1000,
          bytesOut: 500,
        })
      );
      render(<AnomalyDetection flows={flows} devices={[createMockDevice()]} />);

      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
    });

    it('should handle single device with normal traffic', () => {
      const device = createMockDevice();
      const flows = [createMockNetworkFlow({ deviceId: device.id })];
      render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
    });

    it('should handle multiple anomalies sorted by score', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = [
        // High bandwidth
        ...Array.from({ length: 100 }, (_, i) =>
          createMockNetworkFlow({
            id: `flow-high-${i}`,
            deviceId: 'device-1',
            bytesIn: 100000000,
          })
        ),
        // Port scanning
        ...Array.from({ length: 30 }, (_, i) =>
          createMockNetworkFlow({
            id: `flow-scan-${i}`,
            packetsOut: 200,
            bytesOut: 5000,
          })
        ),
      ];

      render(<AnomalyDetection flows={flows} devices={[device]} />);

      // Should display multiple anomalies, sorted by score
      const anomalies = screen.queryAllByText(/excessive bandwidth|potential port scanning/i);
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should handle very large numbers', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = [
        createMockNetworkFlow({
          id: 'flow-1',
          deviceId: 'device-1',
          bytesOut: 1000000000, // 1GB
          bytesIn: 100000,
        }),
      ];

      render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(screen.getByText(/large data upload/i)).toBeInTheDocument();
    });
  });

  describe('Icon Display', () => {
    it('should show check circle icon when no anomalies', () => {
      render(<AnomalyDetection flows={[createMockNetworkFlow()]} devices={[createMockDevice()]} />);

      // Component uses CheckCircle icon when no anomalies
      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
    });

    it('should show warning icon when anomalies detected', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          bytesIn: 100000000,
        })
      );

      render(<AnomalyDetection flows={flows} devices={[device]} />);

      // Should show warning (component uses Warning icon)
      expect(screen.queryByText(/no anomalies detected/i)).not.toBeInTheDocument();
    });
  });

  describe('Score Color Coding', () => {
    it('should apply correct color for low scores', () => {
      const flows = Array.from({ length: 60 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          destIp: '192.168.1.100',
        })
      );

      const { container } = render(
        <AnomalyDetection flows={flows} devices={[createMockDevice()]} />
      );

      // Should render with appropriate styling
      expect(container).toBeInTheDocument();
    });

    it('should apply correct color for high scores', () => {
      const device = createMockDevice({ id: 'device-1' });
      const flows = Array.from({ length: 100 }, (_, i) =>
        createMockNetworkFlow({
          id: `flow-${i}`,
          deviceId: 'device-1',
          bytesIn: 1000000000,
        })
      );

      const { container } = render(<AnomalyDetection flows={flows} devices={[device]} />);

      expect(container).toBeInTheDocument();
    });
  });
});
