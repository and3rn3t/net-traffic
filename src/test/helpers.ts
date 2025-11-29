/**
 * Test helper utilities
 * Provides common mocks and test data factories
 */

import { FlowFilters } from '@/components/FlowFilters';
import { NetworkFlow, Device } from '@/lib/types';

/**
 * Creates a default FlowFilters object with all required properties
 * Use this in tests to ensure type safety
 */
export function createDefaultFlowFilters(): FlowFilters {
  return {
    protocols: [],
    status: null,
    threatLevel: null,
    sourceIp: '',
    destIp: '',
    startTime: null,
    endTime: null,
    minBytes: null,
    deviceId: null,
    timeRangePreset: null,
    countries: [],
    cities: [],
    applications: [],
    minRtt: null,
    maxRtt: null,
    maxJitter: null,
    maxRetransmissions: null,
    sni: '',
    connectionStates: [],
  };
}

/**
 * List of all API client methods that should be mocked in tests
 * Use this as a reference when creating apiClient mocks
 */
export const API_CLIENT_METHODS = [
  'healthCheck',
  'getDevices',
  'getDevice',
  'getFlows',
  'getFlow',
  'getThreats',
  'dismissThreat',
  'getAnalytics',
  'getProtocolStats',
  'getCaptureStatus',
  'startCapture',
  'stopCapture',
  'getSummaryStats',
  'getGeographicStats',
  'getTopDomains',
  'getTopDevices',
  'getBandwidthTimeline',
  'getRttTrends',
  'getJitterAnalysis',
  'getRetransmissionReport',
  'getConnectionQualitySummary',
  'getApplicationBreakdown',
  'getApplicationTrends',
  'getDeviceApplicationProfile',
  'getDeviceAnalytics',
  'updateDevice',
  'search',
  'exportFlows',
  'getMaintenanceStats',
  'runCleanup',
  'connectWebSocket',
  'on',
  'off',
] as const;

/**
 * Creates a complete mock NetworkFlow with all optional fields
 * Use this in tests to ensure type safety and completeness
 */
export function createMockNetworkFlow(overrides: Partial<NetworkFlow> = {}): NetworkFlow {
  return {
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
    // Optional fields with defaults
    country: 'US',
    city: 'New York',
    asn: 15169,
    domain: 'example.com',
    sni: 'example.com',
    tcpFlags: ['SYN', 'ACK'],
    ttl: 64,
    connectionState: 'established',
    rtt: 25.5,
    retransmissions: 0,
    jitter: 2.1,
    application: 'HTTPS',
    userAgent: 'Mozilla/5.0',
    httpMethod: 'GET',
    url: 'https://example.com',
    dnsQueryType: 'A',
    dnsResponseCode: 'NOERROR',
    ...overrides,
  };
}

/**
 * Creates a complete mock Device with all optional fields
 * Use this in tests to ensure type safety and completeness
 */
export function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
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
      applications: ['HTTPS', 'HTTP'],
    },
    // Optional fields with defaults
    os: 'Windows 10',
    ipv6Support: true,
    avgRtt: 25.5,
    connectionQuality: 'good',
    applications: ['HTTPS', 'HTTP', 'DNS'],
    ...overrides,
  };
}
