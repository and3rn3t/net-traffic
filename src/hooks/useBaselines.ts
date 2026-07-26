/**
 * Hook for fetching learned per-device behavioral baselines
 * (used by predictive/statistical anomaly detection).
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { DeviceBaseline } from '@/lib/types';
import { API_CONFIG } from '@/hooks/useApiConfig';

const USE_REAL_API = API_CONFIG.USE_REAL_API;

export function useBaselines() {
  const [baselines, setBaselines] = useState<DeviceBaseline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getBaselines();
      setBaselines(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch baselines';
      setError(errorMessage);
      console.error('Baselines fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { baselines, isLoading, error, refresh };
}
