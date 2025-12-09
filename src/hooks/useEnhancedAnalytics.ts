/**
 * Hook for fetching enhanced analytics data from the API
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

interface SummaryStats {
  total_devices: number;
  active_devices: number;
  total_flows: number;
  active_flows: number;
  total_bytes: number;
  total_threats: number;
  active_threats: number;
  critical_threats: number;
  oldest_flow_timestamp: number;
  newest_flow_timestamp: number;
  capture_duration_hours: number;
}

interface TopDomain {
  domain: string;
  connections: number;
  bytes: number;
  unique_devices: number;
}

interface TopDevice {
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: string;
  bytes: number;
  connections: number;
  threats: number;
}

interface GeographicStat {
  country: string;
  connections: number;
  bytes: number;
  threats: number;
}

interface BandwidthTimeline {
  timestamp: number;
  bytes_in: number;
  bytes_out: number;
  packets: number;
  connections: number;
}

interface ConnectionQualitySummary {
  total_flows: number;
  flows_with_metrics: number;
  quality_score: number;
  avg_rtt: number;
  avg_jitter: number;
  avg_retransmissions: number;
  quality_distribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

export function useEnhancedAnalytics(options: { autoFetch?: boolean; hours?: number } = {}) {
  const { autoFetch = true, hours = 24 } = options;

  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
  const [topDevices, setTopDevices] = useState<TopDevice[]>([]);
  const [geographicStats, setGeographicStats] = useState<GeographicStat[]>([]);
  const [bandwidthTimeline, setBandwidthTimeline] = useState<BandwidthTimeline[]>([]);
  const [connectionQualitySummary, setConnectionQualitySummary] =
    useState<ConnectionQualitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryStats = useCallback(async () => {
    if (!USE_REAL_API) return null;
    try {
      const stats = await apiClient.getSummaryStats();
      setSummaryStats(stats);
      return stats;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch summary stats');
      return null;
    }
  }, []);

  const fetchTopDomains = useCallback(
    async (limit: number = 20, hoursBack: number = hours) => {
      if (!USE_REAL_API) return [];
      try {
        const domains = await apiClient.getTopDomains(limit, hoursBack);
        setTopDomains(domains);
        return domains;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch top domains');
        return [];
      }
    },
    [hours]
  );

  const fetchTopDevices = useCallback(
    async (
      limit: number = 10,
      hoursBack: number = hours,
      sortBy: 'bytes' | 'connections' | 'threats' = 'bytes'
    ) => {
      if (!USE_REAL_API) return [];
      try {
        const devices = await apiClient.getTopDevices(limit, hoursBack, sortBy);
        setTopDevices(devices);
        return devices;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch top devices');
        return [];
      }
    },
    [hours]
  );

  const fetchGeographicStats = useCallback(
    async (hoursBack: number = hours) => {
      if (!USE_REAL_API) return [];
      try {
        const stats = await apiClient.getGeographicStats(hoursBack);
        setGeographicStats(stats);
        return stats;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch geographic stats');
        return [];
      }
    },
    [hours]
  );

  const fetchBandwidthTimeline = useCallback(
    async (hoursBack: number = hours, intervalMinutes: number = 5) => {
      if (!USE_REAL_API) return [];
      try {
        const timeline = await apiClient.getBandwidthTimeline(hoursBack, intervalMinutes);
        setBandwidthTimeline(timeline);
        return timeline;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bandwidth timeline');
        return [];
      }
    },
    [hours]
  );

  const fetchConnectionQualitySummary = useCallback(
    async (hoursBack: number = hours, deviceId?: string) => {
      if (!USE_REAL_API) return null;
      try {
        setIsLoading(true);
        const summary = await apiClient.getConnectionQualitySummary(hoursBack, deviceId);
        setConnectionQualitySummary(summary);
        return summary;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch connection quality summary');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [hours]
  );

  const fetchAll = useCallback(async () => {
    if (!USE_REAL_API) return;
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchSummaryStats(),
        fetchTopDomains(20, hours),
        fetchTopDevices(10, hours),
        fetchGeographicStats(hours),
        fetchBandwidthTimeline(hours),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
    }
  }, [
    hours,
    fetchSummaryStats,
    fetchTopDomains,
    fetchTopDevices,
    fetchGeographicStats,
    fetchBandwidthTimeline,
  ]);

  useEffect(() => {
    if (autoFetch && USE_REAL_API) {
      fetchAll();
    }
  }, [autoFetch, fetchAll]);

  return {
    summaryStats,
    topDomains,
    topDevices,
    geographicStats,
    bandwidthTimeline,
    connectionQualitySummary,
    isLoading,
    error,
    fetchSummaryStats,
    fetchTopDomains,
    fetchTopDevices,
    fetchGeographicStats,
    fetchBandwidthTimeline,
    fetchConnectionQualitySummary,
    refresh: fetchAll,
  };
}
