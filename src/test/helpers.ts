/**
 * Test helper utilities
 * Provides common mocks and test data factories
 */

import { FlowFilters } from '@/components/FlowFilters';

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
