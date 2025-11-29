/**
 * Unit tests for useFlowFilters hook
 * Tests filter state management, preset saving/loading, and API integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useFlowFilters } from '@/hooks/useFlowFilters';
import { apiClient } from '@/lib/api';
import { createDefaultFlowFilters } from '@/test/helpers';
import type { FlowFilters } from '@/components/FlowFilters';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiClient: {
    getFlows: vi.fn(),
  },
}));

// Mock useDebounce to return value immediately in tests
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useFlowFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    localStorage.clear();
    vi.stubEnv('VITE_USE_REAL_API', 'true');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with default empty filters', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      expect(result.current.filters).toEqual({
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
    });

    it('should initialize with empty saved presets', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      expect(result.current.savedPresets).toEqual([]);
    });

    it('should not be loading initially when autoFetch is disabled', () => {
      const { result } = renderHook(() => useFlowFilters({ autoFetch: false }), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Filter Updates', () => {
    it('should update protocols filter', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({ protocols: ['TCP', 'UDP'] });
      });

      expect(result.current.filters.protocols).toEqual(['TCP', 'UDP']);
    });

    it('should update status filter', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({ status: 'active' });
      });

      expect(result.current.filters.status).toBe('active');
    });

    it('should update threat level filter', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({ threatLevel: 'high' });
      });

      expect(result.current.filters.threatLevel).toBe('high');
    });

    it('should update IP address filters', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({
          sourceIp: '192.168.1.1',
          destIp: '10.0.0.1',
        });
      });

      expect(result.current.filters.sourceIp).toBe('192.168.1.1');
      expect(result.current.filters.destIp).toBe('10.0.0.1');
    });

    it('should update multiple filters at once', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({
          protocols: ['TCP'],
          status: 'active',
          threatLevel: 'high',
          sourceIp: '192.168.1.1',
        });
      });

      expect(result.current.filters.protocols).toEqual(['TCP']);
      expect(result.current.filters.status).toBe('active');
      expect(result.current.filters.threatLevel).toBe('high');
      expect(result.current.filters.sourceIp).toBe('192.168.1.1');
    });
  });

  describe('Clear Filters', () => {
    it('should clear all filters', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      // Set some filters
      act(() => {
        result.current.updateFilters({
          protocols: ['TCP', 'UDP'],
          status: 'active',
          threatLevel: 'high',
          sourceIp: '192.168.1.1',
        });
      });

      // Clear filters
      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
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
    });
  });

  describe('Preset Management', () => {
    it('should save a preset', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({
          protocols: ['TCP'],
          status: 'active',
        });
      });

      act(() => {
        result.current.savePreset('My Preset');
      });

      expect(result.current.savedPresets).toHaveLength(1);
      expect(result.current.savedPresets[0].name).toBe('My Preset');
      expect(result.current.savedPresets[0].filters.protocols).toEqual(['TCP']);
      expect(result.current.savedPresets[0].filters.status).toBe('active');
    });

    it('should load a preset', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      const presetFilters: FlowFilters = {
        ...createDefaultFlowFilters(),
        protocols: ['UDP'],
        status: 'closed',
        threatLevel: 'low',
      };

      act(() => {
        result.current.loadPreset(presetFilters);
      });

      expect(result.current.filters).toEqual(presetFilters);
    });

    it('should delete a preset', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      // Save two presets
      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
        result.current.savePreset('Preset 1');
      });

      act(() => {
        result.current.updateFilters({ protocols: ['UDP'] });
        result.current.savePreset('Preset 2');
      });

      expect(result.current.savedPresets).toHaveLength(2);

      // Delete one
      act(() => {
        result.current.deletePreset('Preset 1');
      });

      expect(result.current.savedPresets).toHaveLength(1);
      expect(result.current.savedPresets[0].name).toBe('Preset 2');
    });

    it('should persist presets to localStorage', () => {
      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
        result.current.savePreset('Persisted Preset');
      });

      // Check localStorage
      const stored = localStorage.getItem('netinsight_flow_filter_presets');
      expect(stored).toBeTruthy();

      const presets = JSON.parse(stored!);
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Persisted Preset');
    });

    it('should load presets from localStorage on mount', () => {
      const preset = {
        name: 'Loaded Preset',
        filters: {
          protocols: ['HTTP'],
          status: 'active',
          threatLevel: null,
          sourceIp: '',
          destIp: '',
          startTime: null,
          endTime: null,
          minBytes: null,
          deviceId: null,
          timeRangePreset: null,
        },
      };

      localStorage.setItem('netinsight_flow_filter_presets', JSON.stringify([preset]));

      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      expect(result.current.savedPresets).toHaveLength(1);
      expect(result.current.savedPresets[0].name).toBe('Loaded Preset');
    });
  });

  describe('API Integration', () => {
    it('should fetch flows when autoFetch is enabled and API is available', async () => {
      const mockFlows = [
        {
          id: '1',
          protocol: 'TCP',
          sourceIp: '192.168.1.1',
          destIp: '10.0.0.1',
          timestamp: new Date().toISOString(),
        },
      ];

      vi.mocked(apiClient.getFlows).mockResolvedValue(mockFlows);

      const { result } = renderHook(() => useFlowFilters({ autoFetch: true }), {
        wrapper,
      });

      // Trigger fetch by updating filters
      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
        result.current.applyFilters();
      });

      await waitFor(() => {
        expect(result.current.filteredFlows).toEqual(mockFlows);
      });
    });

    it('should not fetch when autoFetch is disabled', async () => {
      const { result } = renderHook(() => useFlowFilters({ autoFetch: false }), {
        wrapper,
      });

      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
      });

      // Wait a bit to ensure no API call
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(apiClient.getFlows).not.toHaveBeenCalled();
    });

    it('should not fetch when API is disabled', async () => {
      vi.stubEnv('VITE_USE_REAL_API', 'false');

      const { result } = renderHook(() => useFlowFilters({ autoFetch: true }), {
        wrapper,
      });

      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(apiClient.getFlows).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.getFlows).mockRejectedValue(error);

      const { result } = renderHook(() => useFlowFilters({ autoFetch: true }), {
        wrapper,
      });

      act(() => {
        result.current.updateFilters({ protocols: ['TCP'] });
        result.current.applyFilters();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('Filter to API Parameters Conversion', () => {
    it('should convert single protocol filter to API params', async () => {
      const mockFlows: unknown[] = [];
      vi.mocked(apiClient.getFlows).mockResolvedValue(mockFlows);

      const { result } = renderHook(() => useFlowFilters(), { wrapper });

      act(() => {
        result.current.updateFilters({
          protocols: ['TCP'],
          status: 'active',
          threatLevel: 'high',
          sourceIp: '192.168.1.1',
          destIp: '10.0.0.1',
        });
        result.current.applyFilters();
      });

      await waitFor(() => {
        expect(apiClient.getFlows).toHaveBeenCalledWith(
          100, // limit
          0, // offset
          undefined, // deviceId
          'active', // status
          'TCP', // protocol
          undefined, // startTime
          undefined, // endTime
          '192.168.1.1', // sourceIp
          '10.0.0.1', // destIp
          'high', // threatLevel
          undefined // minBytes
        );
      });
    });
  });
});
