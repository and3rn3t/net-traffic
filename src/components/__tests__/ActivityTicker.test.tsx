/**
 * Unit tests for ActivityTicker widget
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ActivityTicker } from '@/components/dashboard/ActivityTicker';

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

describe('ActivityTicker', () => {
  beforeEach(() => {
    listeners.clear();
  });

  it('shows a waiting placeholder with no events yet', () => {
    render(
      <WebSocketProvider>
        <ActivityTicker />
      </WebSocketProvider>
    );

    expect(screen.getByText('Waiting for activity...')).toBeInTheDocument();
  });

  it('renders an event once one arrives over the WS feed', () => {
    render(
      <WebSocketProvider>
        <ActivityTicker />
      </WebSocketProvider>
    );

    act(() => {
      emit('threat_update', {
        threat: {
          id: 't1',
          timestamp: Date.now(),
          severity: 'high',
          description: 'Suspicious scan detected',
        },
      });
    });

    expect(screen.getByText('Suspicious scan detected')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });
});
