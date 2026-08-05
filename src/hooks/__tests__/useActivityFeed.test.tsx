/**
 * Unit tests for useActivityFeed hook
 * Verifies device/threat/alert WS events are captured into the ring buffer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import type { Device, Threat, TriggeredAlert } from '@/lib/types';

const listeners = new Map<string, Set<(data: unknown) => void>>();

function emit(eventType: string, data: unknown) {
  listeners.get(eventType)?.forEach(cb => cb(data));
}

vi.mock('@/lib/api', () => ({
  apiClient: {
    on: (eventType: string, callback: (data: unknown) => void) => {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set());
      listeners.get(eventType)!.add(callback);
      return () => listeners.get(eventType)?.delete(callback);
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WebSocketProvider>{children}</WebSocketProvider>
);

describe('useActivityFeed', () => {
  beforeEach(() => {
    listeners.clear();
  });

  it('starts with an empty event list', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });
    expect(result.current.events).toEqual([]);
  });

  it('captures a new-device event from device_update', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });
    const device = {
      id: 'd1',
      name: 'Laptop',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    } as Device;

    act(() => emit('device_update', { device }));

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('device');
    expect(result.current.events[0].message).toContain('New device detected');
  });

  it('captures a threat_update event with severity', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });
    const threat = {
      id: 't1',
      timestamp: Date.now(),
      severity: 'high',
      description: 'Suspicious scan detected',
    } as Threat;

    act(() => emit('threat_update', { threat }));

    expect(result.current.events[0]).toMatchObject({
      type: 'threat',
      severity: 'high',
      message: 'Suspicious scan detected',
    });
  });

  it('captures an alert_triggered event', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });
    const alert = {
      id: 'a1',
      timestamp: Date.now(),
      severity: 'critical',
      description: 'RTT threshold exceeded',
    } as TriggeredAlert;

    act(() => emit('alert_triggered', { alert }));

    expect(result.current.events[0]).toMatchObject({
      type: 'alert',
      severity: 'critical',
      message: 'RTT threshold exceeded',
    });
  });

  it('keeps the most recent 50 events, newest first', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });

    act(() => {
      for (let i = 0; i < 55; i++) {
        emit('threat_update', {
          threat: { id: `t${i}`, timestamp: i, severity: 'low', description: `Threat ${i}` },
        });
      }
    });

    expect(result.current.events).toHaveLength(50);
    expect(result.current.events[0].message).toBe('Threat 54');
  });

  it('ignores malformed payloads', () => {
    const { result } = renderHook(() => useActivityFeed(), { wrapper });

    act(() => {
      emit('device_update', null);
      emit('threat_update', { threat: 'not-an-object' });
      emit('alert_triggered', {});
    });

    expect(result.current.events).toEqual([]);
  });
});
