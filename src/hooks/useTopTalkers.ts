/**
 * Top talkers: devices ranked by bandwidth, polled via TanStack Query,
 * with rank-change tracking against the previous fetch.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { API_CONFIG } from '@/hooks/useApiConfig';

const USE_REAL_API = API_CONFIG.USE_REAL_API;
const REFETCH_INTERVAL_MS = 15000;

export interface TopTalker {
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: string;
  bytes: number;
  connections: number;
  threats: number;
  rank: number;
  /** Positive = moved up the leaderboard since the last fetch, negative = moved down, 0 = new/unchanged. */
  rankChange: number;
}

export function useTopTalkers(limit: number = 5) {
  const previousRanksRef = useRef<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<string, number>>(new Map());

  const query = useQuery({
    queryKey: ['top-talkers', limit],
    queryFn: () => apiClient.getTopDevices(limit, 24, 'bytes'),
    enabled: USE_REAL_API,
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
  });

  useEffect(() => {
    if (!query.data) return;
    const previousRanks = previousRanksRef.current;
    const changes = new Map<string, number>();
    query.data.forEach((device, index) => {
      const previousRank = previousRanks.get(device.device_id);
      if (previousRank !== undefined) {
        changes.set(device.device_id, previousRank - index);
      }
    });
    setRankChanges(changes);
    previousRanksRef.current = new Map(
      query.data.map((device, index) => [device.device_id, index])
    );
  }, [query.data]);

  const talkers: TopTalker[] = (query.data ?? []).map((device, index) => ({
    ...device,
    rank: index,
    rankChange: rankChanges.get(device.device_id) ?? 0,
  }));

  return { talkers, isLoading: query.isLoading, error: query.error };
}
