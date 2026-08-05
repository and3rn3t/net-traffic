/**
 * Live throughput gauge: current bandwidth (bytes/sec) polled from the
 * bandwidth timeline, refreshed early on flow completions, with a
 * peak-hold value that decays back down after a few seconds of quiet.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useWebSocketSubscription } from '@/contexts/WebSocketContext';
import { API_CONFIG } from '@/hooks/useApiConfig';

const USE_REAL_API = API_CONFIG.USE_REAL_API;
const POLL_INTERVAL_MS = 10000;
const FLOW_REFRESH_THROTTLE_MS = 3000;
const PEAK_HOLD_MS = 5000;
const PEAK_DECAY_TICK_MS = 1000;
const PEAK_DECAY_RATE = 0.95;

const THROUGHPUT_QUERY_KEY = ['throughput-gauge'];

export function useThroughputGauge() {
  const queryClient = useQueryClient();
  const lastInvalidateRef = useRef(0);

  const query = useQuery({
    queryKey: THROUGHPUT_QUERY_KEY,
    queryFn: () => apiClient.getBandwidthTimeline(1, 1),
    enabled: USE_REAL_API,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  // Nudge the poll forward on flow completions instead of computing a
  // separate live rate - partial-flow byte counts are too noisy to trust.
  useWebSocketSubscription('flow_update', () => {
    const now = Date.now();
    if (now - lastInvalidateRef.current < FLOW_REFRESH_THROTTLE_MS) return;
    lastInvalidateRef.current = now;
    queryClient.invalidateQueries({ queryKey: THROUGHPUT_QUERY_KEY });
  });

  const latestInterval = query.data?.at(-1);
  const bytesPerSecond = latestInterval
    ? (latestInterval.bytes_in + latestInterval.bytes_out) / 60
    : 0;

  const [peakBytesPerSecond, setPeakBytesPerSecond] = useState(0);
  const peakTimestampRef = useRef(0);

  useEffect(() => {
    if (bytesPerSecond > peakBytesPerSecond) {
      setPeakBytesPerSecond(bytesPerSecond);
      peakTimestampRef.current = Date.now();
    }
  }, [bytesPerSecond, peakBytesPerSecond]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPeakBytesPerSecond(current => {
        if (Date.now() - peakTimestampRef.current < PEAK_HOLD_MS) return current;
        const decayed = current * PEAK_DECAY_RATE;
        return decayed < bytesPerSecond ? bytesPerSecond : decayed;
      });
    }, PEAK_DECAY_TICK_MS);
    return () => clearInterval(interval);
  }, [bytesPerSecond]);

  return { bytesPerSecond, peakBytesPerSecond };
}
