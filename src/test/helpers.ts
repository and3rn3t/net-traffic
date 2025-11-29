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
