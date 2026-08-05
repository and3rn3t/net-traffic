/**
 * Unit tests for useDashboardLayout hook
 * Tests default layout, add/remove widgets, and localStorage persistence
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';

const STORAGE_KEY = 'netinsight_dashboard_layout';

describe('useDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the three shipped widgets when nothing is stored', () => {
    const { result } = renderHook(() => useDashboardLayout());

    expect(result.current.widgetIds).toEqual(['metrics', 'traffic-chart', 'connections-table']);
    expect(result.current.layout).toHaveLength(3);
  });

  it('persists added widgets to localStorage', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => {
      result.current.addWidget('metrics');
    });
    // Adding an already-present widget is a no-op.
    expect(result.current.widgetIds).toEqual(['metrics', 'traffic-chart', 'connections-table']);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.widgetIds).toEqual(['metrics', 'traffic-chart', 'connections-table']);
  });

  it('removes a widget from state and layout', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => {
      result.current.removeWidget('traffic-chart');
    });

    expect(result.current.widgetIds).toEqual(['metrics', 'connections-table']);
    expect(result.current.layout.map(item => item.i)).toEqual(['metrics', 'connections-table']);
  });

  it('restores a previously persisted layout on next mount', () => {
    const { result, unmount } = renderHook(() => useDashboardLayout());

    act(() => {
      result.current.removeWidget('connections-table');
    });
    unmount();

    const { result: secondMount } = renderHook(() => useDashboardLayout());
    expect(secondMount.current.widgetIds).toEqual(['metrics', 'traffic-chart']);
  });

  it('falls back to defaults when stored data has a stale schema version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, widgetIds: ['metrics'], layout: [] })
    );

    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.widgetIds).toEqual(['metrics', 'traffic-chart', 'connections-table']);
  });

  it('resetToDefault restores the shipped layout', () => {
    const { result } = renderHook(() => useDashboardLayout());

    act(() => {
      result.current.removeWidget('metrics');
      result.current.removeWidget('traffic-chart');
    });
    expect(result.current.widgetIds).toEqual(['connections-table']);

    act(() => {
      result.current.resetToDefault();
    });
    expect(result.current.widgetIds).toEqual(['metrics', 'traffic-chart', 'connections-table']);
  });
});
