/**
 * Unit tests for useNetworkHealthScore hook
 * Tests factor blending, severity banding, and empty-state defaults
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useNetworkHealthScore } from '@/hooks/useNetworkHealthScore';
import { apiClient } from '@/lib/api';
import type { Device, Threat } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getConnectionQualitySummary: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function makeDevice(anomalyCount: number): Device {
  return {
    behavioral: { peakHours: [], commonPorts: [], commonDomains: [], anomalyCount },
  } as unknown as Device;
}

describe('useNetworkHealthScore', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(apiClient.getConnectionQualitySummary).mockReset();
  });

  it('scores a healthy network near 100 with an excellent severity', async () => {
    vi.mocked(apiClient.getConnectionQualitySummary).mockResolvedValue({
      total_flows: 10,
      flows_with_metrics: 10,
      quality_score: 95,
      avg_rtt: 10,
      avg_jitter: 1,
      avg_retransmissions: 0,
      avg_duration: 1,
      avg_packet_size: 1000,
      avg_bandwidth_utilization: 0.5,
      protocol_efficiency: {},
      quality_distribution: { excellent: 10, good: 0, fair: 0, poor: 0 },
    });

    const { result } = renderHook(() => useNetworkHealthScore([], []), { wrapper });

    await waitFor(() => expect(result.current.score).toBeGreaterThanOrEqual(90));
    expect(result.current.severity).toBe('excellent');
  });

  it('lowers the score and severity when there are critical threats', async () => {
    vi.mocked(apiClient.getConnectionQualitySummary).mockResolvedValue({
      total_flows: 10,
      flows_with_metrics: 10,
      quality_score: 90,
      avg_rtt: 10,
      avg_jitter: 1,
      avg_retransmissions: 0,
      avg_duration: 1,
      avg_packet_size: 1000,
      avg_bandwidth_utilization: 0.5,
      protocol_efficiency: {},
      quality_distribution: { excellent: 10, good: 0, fair: 0, poor: 0 },
    });

    const threats: Threat[] = Array.from({ length: 4 }, (_, i) => ({
      id: `t${i}`,
      timestamp: Date.now(),
      type: 'anomaly',
      severity: 'critical',
      deviceId: 'd1',
      flowId: 'f1',
      description: 'Critical threat',
      recommendation: '',
      dismissed: false,
    }));

    const { result } = renderHook(() => useNetworkHealthScore(threats, []), { wrapper });

    await waitFor(() => expect(result.current.score).toBeLessThan(90));
    const threatFactor = result.current.factors.find(f => f.label === 'Active threats');
    expect(threatFactor?.score).toBe(20); // 100 - 4*20, floored at 0
  });

  it('factors device anomaly counts into the anomaly score', async () => {
    vi.mocked(apiClient.getConnectionQualitySummary).mockResolvedValue({
      total_flows: 10,
      flows_with_metrics: 10,
      quality_score: 100,
      avg_rtt: 0,
      avg_jitter: 0,
      avg_retransmissions: 0,
      avg_duration: 1,
      avg_packet_size: 1000,
      avg_bandwidth_utilization: 0.5,
      protocol_efficiency: {},
      quality_distribution: { excellent: 10, good: 0, fair: 0, poor: 0 },
    });

    const devices = [makeDevice(5), makeDevice(3)];

    const { result } = renderHook(() => useNetworkHealthScore([], devices), { wrapper });

    await waitFor(() => {
      const anomalyFactor = result.current.factors.find(f => f.label === 'Device anomalies');
      expect(anomalyFactor?.score).toBe(60); // 100 - 8*5
    });
  });

  it('defaults to a perfect quality score before the connection-quality fetch resolves', () => {
    vi.mocked(apiClient.getConnectionQualitySummary).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useNetworkHealthScore([], []), { wrapper });

    expect(result.current.score).toBe(100);
    expect(result.current.severity).toBe('excellent');
  });
});
