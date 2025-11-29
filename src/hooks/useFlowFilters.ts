import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { NetworkFlow } from '@/lib/types';
import type { FlowFilters } from '@/components/FlowFilters';
import { useDebounce } from './useDebounce';

interface UseFlowFiltersOptions {
  autoFetch?: boolean;
  limit?: number;
  devices?: Array<{ id: string; name: string }>;
}

interface SavedPreset {
  name: string;
  filters: FlowFilters;
}

const PRESET_STORAGE_KEY = 'netinsight_flow_filter_presets';

export function useFlowFilters(options: UseFlowFiltersOptions = {}) {
  const { autoFetch = true, limit = 100 } = options;

  const [filters, setFilters] = useState<FlowFilters>({
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
    // New enhanced filters
    countries: [],
    cities: [],
    applications: [],
    minRtt: null,
    maxRtt: null,
    maxJitter: null,
    maxRetransmissions: null,
    sni: '',
    connectionStates: [],
  });

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Debounce filters to avoid excessive API calls
  // Debounce text inputs (IP addresses) more aggressively
  const debouncedFilters = useDebounce(
    {
      ...filters,
      sourceIp: filters.sourceIp,
      destIp: filters.destIp,
    },
    500 // 500ms debounce for text inputs
  );

  // Use React Query for caching and automatic request management
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  // Load saved presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored) {
        const presets = JSON.parse(stored) as SavedPreset[];
        setSavedPresets(presets);
      }
    } catch (e) {
      console.error('Failed to load saved presets:', e);
    }
  }, []);

  // Save presets to localStorage
  const savePresetsToStorage = useCallback((presets: SavedPreset[]) => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save presets:', e);
    }
  }, []);

  // Convert FlowFilters to API parameters
  const filtersToApiParams = useCallback(
    (f: FlowFilters) => {
      const params: {
        limit: number;
        offset: number;
        protocol?: string;
        status?: string;
        startTime?: number;
        endTime?: number;
        sourceIp?: string;
        destIp?: string;
        threatLevel?: string;
        minBytes?: number;
        deviceId?: string;
        country?: string;
        city?: string;
        application?: string;
        minRtt?: number;
        maxRtt?: number;
        maxJitter?: number;
        maxRetransmissions?: number;
        sni?: string;
        connectionState?: string;
      } = {
        limit,
        offset: 0,
      };

      // Protocol - use first one for now (API supports single protocol)
      // In the future, we could make multiple requests and merge
      if (f.protocols.length === 1) {
        params.protocol = f.protocols[0];
      }

      if (f.status) {
        params.status = f.status;
      }

      if (f.startTime) {
        params.startTime = f.startTime;
      }

      if (f.endTime) {
        params.endTime = f.endTime;
      }

      if (f.sourceIp) {
        params.sourceIp = f.sourceIp.trim();
      }

      if (f.destIp) {
        params.destIp = f.destIp.trim();
      }

      if (f.threatLevel) {
        params.threatLevel = f.threatLevel;
      }

      if (f.minBytes) {
        params.minBytes = f.minBytes;
      }

      if (f.deviceId) {
        params.deviceId = f.deviceId;
      }

      // New enhanced filters - use first value from arrays for now
      if (f.countries.length > 0) {
        params.country = f.countries[0];
      }
      if (f.cities.length > 0) {
        params.city = f.cities[0];
      }
      if (f.applications.length > 0) {
        params.application = f.applications[0];
      }
      if (f.minRtt !== null) {
        params.minRtt = f.minRtt;
      }
      if (f.maxRtt !== null) {
        params.maxRtt = f.maxRtt;
      }
      if (f.maxJitter !== null) {
        params.maxJitter = f.maxJitter;
      }
      if (f.maxRetransmissions !== null) {
        params.maxRetransmissions = f.maxRetransmissions;
      }
      if (f.sni) {
        params.sni = f.sni;
      }
      if (f.connectionStates.length > 0) {
        params.connectionState = f.connectionStates[0];
      }

      return params;
    },
    [limit]
  );

  // Fetch flows function for React Query
  const fetchFilteredFlows = useCallback(async () => {
    const params = filtersToApiParams(debouncedFilters);

    // If multiple protocols selected, we need to fetch for each and merge
    let allFlows: NetworkFlow[] = [];

    if (debouncedFilters.protocols.length > 1) {
      // Fetch for each protocol and merge results
      const promises = debouncedFilters.protocols.map(protocol =>
        apiClient.getFlows(
          params.limit || limit,
          params.offset || 0,
          params.deviceId,
          params.status,
          protocol,
          params.startTime,
          params.endTime,
          params.sourceIp,
          params.destIp,
          params.threatLevel,
          params.minBytes
        )
      );
      const results = await Promise.all(promises);
      // Merge and deduplicate by flow ID
      const flowMap = new Map<string, NetworkFlow>();
      results.flat().forEach(flow => {
        if (!flowMap.has(flow.id)) {
          flowMap.set(flow.id, flow);
        }
      });
      allFlows = Array.from(flowMap.values());
    } else {
      // Single protocol or no protocol filter
      allFlows = await apiClient.getFlows(
        params.limit || limit,
        params.offset || 0,
        params.deviceId,
        params.status,
        params.protocol,
        params.startTime,
        params.endTime,
        params.sourceIp,
        params.destIp,
        params.threatLevel,
        params.minBytes,
        // New enhanced filters - use first value from arrays
        debouncedFilters.countries.length > 0 ? debouncedFilters.countries[0] : undefined,
        debouncedFilters.cities.length > 0 ? debouncedFilters.cities[0] : undefined,
        debouncedFilters.applications.length > 0 ? debouncedFilters.applications[0] : undefined,
        debouncedFilters.minRtt ?? undefined,
        debouncedFilters.maxRtt ?? undefined,
        debouncedFilters.maxJitter ?? undefined,
        debouncedFilters.maxRetransmissions ?? undefined,
        debouncedFilters.sni || undefined,
        debouncedFilters.connectionStates.length > 0
          ? debouncedFilters.connectionStates[0]
          : undefined
      );
    }

    // Apply additional client-side filtering for protocols (if multiple selected)
    let filtered = allFlows;

    if (debouncedFilters.protocols.length > 1) {
      filtered = allFlows.filter(flow => debouncedFilters.protocols.includes(flow.protocol));
    }

    return filtered;
  }, [debouncedFilters, filtersToApiParams, limit]);

  // Use React Query for caching and automatic request management
  const {
    data: filteredFlows = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['flows', 'filtered', debouncedFilters, limit],
    queryFn: fetchFilteredFlows,
    enabled: (autoFetch && shouldFetch && USE_REAL_API) || false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
  });

  // Extract error message from React Query error
  let error: string | null = null;
  if (queryError) {
    error = queryError instanceof Error ? queryError.message : 'Failed to fetch filtered flows';
  }

  // Auto-fetch when debounced filters change (if autoFetch is enabled)
  useEffect(() => {
    if (autoFetch && USE_REAL_API) {
      setShouldFetch(true);
    }
  }, [autoFetch, USE_REAL_API]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<FlowFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    const cleared: FlowFilters = {
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
      // New enhanced filters
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
    setFilters(cleared);
  }, []);

  // Apply filters (manual trigger)
  const applyFilters = useCallback(() => {
    setShouldFetch(true);
    refetch();
  }, [refetch]);

  // Save filter preset
  const savePreset = useCallback(
    (name: string) => {
      const newPreset: SavedPreset = {
        name,
        filters: { ...filters },
      };
      const updated = [...savedPresets, newPreset];
      setSavedPresets(updated);
      savePresetsToStorage(updated);
    },
    [filters, savedPresets, savePresetsToStorage]
  );

  // Load filter preset
  const loadPreset = useCallback((preset: FlowFilters) => {
    setFilters(preset);
  }, []);

  // Delete preset
  const deletePreset = useCallback(
    (name: string) => {
      const updated = savedPresets.filter(p => p.name !== name);
      setSavedPresets(updated);
      savePresetsToStorage(updated);
    },
    [savedPresets, savePresetsToStorage]
  );

  return {
    filters,
    filteredFlows,
    isLoading,
    error,
    savedPresets,
    updateFilters,
    clearFilters,
    applyFilters,
    savePreset,
    loadPreset,
    deletePreset,
    refresh: refetch,
  };
}
