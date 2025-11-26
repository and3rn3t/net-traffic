import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { NetworkFlow } from '@/lib/types';
import type { FlowFilters } from '@/components/FlowFilters';

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
  });

  const [filteredFlows, setFilteredFlows] = useState<NetworkFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);

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

      return params;
    },
    [limit]
  );

  // Fetch flows with current filters
  const fetchFilteredFlows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = filtersToApiParams(filters);

      // If multiple protocols selected, we need to fetch for each and merge
      let allFlows: NetworkFlow[] = [];

      if (filters.protocols.length > 1) {
        // Fetch for each protocol and merge results
        const promises = filters.protocols.map(protocol =>
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
          params.minBytes
        );
      }

      // Apply additional client-side filtering for protocols (if multiple selected)
      let filtered = allFlows;

      if (filters.protocols.length > 1) {
        filtered = allFlows.filter(flow => filters.protocols.includes(flow.protocol));
      }

      setFilteredFlows(filtered);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch filtered flows';
      setError(errorMessage);
      console.error('Error fetching filtered flows:', err);
      setFilteredFlows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, filtersToApiParams, limit]);

  // Auto-fetch when filters change (if autoFetch is enabled)
  useEffect(() => {
    if (autoFetch) {
      fetchFilteredFlows();
    }
  }, [autoFetch, fetchFilteredFlows]);

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
    };
    setFilters(cleared);
    setError(null);
  }, []);

  // Apply filters (manual trigger)
  const applyFilters = useCallback(() => {
    fetchFilteredFlows();
  }, [fetchFilteredFlows]);

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
    refresh: fetchFilteredFlows,
  };
}
