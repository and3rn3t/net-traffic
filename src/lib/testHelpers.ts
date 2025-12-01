/**
 * Test helper functions for creating complete mock objects
 * Ensures all required fields are present for TypeScript type checking
 */
import { Device, NetworkFlow, Threat } from './types';

/**
 * Create a complete Device mock object for testing
 */
export function createMockDevice(overrides?: Partial<Device>): Device {
  const now = Date.now();
  return {
    id: 'test-device-1',
    name: 'Test Device',
    ip: '192.168.1.100',
    mac: '00:11:22:33:44:55',
    type: 'laptop',
    vendor: 'Apple',
    firstSeen: now - 86400000,
    lastSeen: now,
    bytesTotal: 1000000,
    connectionsCount: 10,
    threatScore: 0.0,
    behavioral: {
      peakHours: [9, 10, 11, 14, 15, 16],
      commonPorts: [443, 80, 53],
      commonDomains: ['example.com'],
      anomalyCount: 0,
    },
    ...overrides,
  };
}

/**
 * Create a complete NetworkFlow mock object for testing
 */
export function createMockNetworkFlow(overrides?: Partial<NetworkFlow>): NetworkFlow {
  const now = Date.now();
  return {
    id: 'test-flow-1',
    timestamp: now,
    sourceIp: '192.168.1.100',
    sourcePort: 54321,
    destIp: '8.8.8.8',
    destPort: 443,
    protocol: 'TCP',
    bytesIn: 1000,
    bytesOut: 500,
    packetsIn: 10,
    packetsOut: 5,
    duration: 5000,
    status: 'active',
    threatLevel: 'safe',
    deviceId: 'test-device-1',
    ...overrides,
  };
}

/**
 * Create a complete Threat mock object for testing
 */
export function createMockThreat(overrides?: Partial<Threat>): Threat {
  const now = Date.now();
  return {
    id: 'test-threat-1',
    timestamp: now,
    type: 'anomaly',
    severity: 'low',
    deviceId: 'test-device-1',
    flowId: 'test-flow-1',
    description: 'Test threat description',
    recommendation: 'Test recommendation',
    dismissed: false,
    ...overrides,
  };
}
