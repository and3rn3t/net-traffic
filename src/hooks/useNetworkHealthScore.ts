/**
 * Network health score: client-side blend of connection quality
 * (server-computed 0-100), active-threat severity, and device anomaly
 * counts into a single 0-100 score with a factor breakdown.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { API_CONFIG } from '@/hooks/useApiConfig';
import type { Device, Threat } from '@/lib/types';

const USE_REAL_API = API_CONFIG.USE_REAL_API;
const POLL_INTERVAL_MS = 30000;

const THREAT_SEVERITY_PENALTY: Record<Threat['severity'], number> = {
  low: 2,
  medium: 6,
  high: 12,
  critical: 20,
};

const ANOMALY_PENALTY_PER_COUNT = 5;

export type HealthSeverity = 'excellent' | 'good' | 'fair' | 'poor';

export interface HealthScoreFactor {
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface NetworkHealthScore {
  score: number;
  severity: HealthSeverity;
  factors: HealthScoreFactor[];
}

function severityForScore(score: number): HealthSeverity {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function useNetworkHealthScore(
  activeThreats: Threat[],
  devices: Device[]
): NetworkHealthScore {
  const query = useQuery({
    queryKey: ['connection-quality-summary'],
    queryFn: () => apiClient.getConnectionQualitySummary(24),
    enabled: USE_REAL_API,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const qualityScore = query.data?.quality_score ?? 100;

  const threatPenalty = activeThreats.reduce(
    (total, threat) => total + (THREAT_SEVERITY_PENALTY[threat.severity] ?? 0),
    0
  );
  const threatScore = Math.max(0, 100 - threatPenalty);

  const anomalyCount = devices.reduce((total, device) => total + device.behavioral.anomalyCount, 0);
  const anomalyScore = Math.max(0, 100 - anomalyCount * ANOMALY_PENALTY_PER_COUNT);

  const factors: HealthScoreFactor[] = [
    {
      label: 'Connection quality',
      score: qualityScore,
      weight: 0.4,
      detail: `${qualityScore.toFixed(0)}/100 from RTT, jitter, and retransmissions`,
    },
    {
      label: 'Active threats',
      score: threatScore,
      weight: 0.35,
      detail: `${activeThreats.length} active threat${activeThreats.length === 1 ? '' : 's'}`,
    },
    {
      label: 'Device anomalies',
      score: anomalyScore,
      weight: 0.25,
      detail: `${anomalyCount} anomal${anomalyCount === 1 ? 'y' : 'ies'} detected`,
    },
  ];

  const score = Math.round(
    factors.reduce((total, factor) => total + factor.score * factor.weight, 0)
  );

  return { score, severity: severityForScore(score), factors };
}
