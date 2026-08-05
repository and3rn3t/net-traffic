/**
 * Live activity feed: ring buffer of recent device/threat/alert events
 * sourced from the shared WebSocket pub/sub.
 */
import { useCallback, useState } from 'react';
import { useWebSocketSubscription } from '@/contexts/WebSocketContext';
import type { Device, Threat, TriggeredAlert } from '@/lib/types';

export type ActivityEventType = 'device' | 'threat' | 'alert';
export type ActivitySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityEventType;
  severity?: ActivitySeverity;
  message: string;
}

const MAX_EVENTS = 50;
const NEW_DEVICE_WINDOW_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const pushEvent = useCallback((event: ActivityEvent) => {
    setEvents(current => [event, ...current].slice(0, MAX_EVENTS));
  }, []);

  useWebSocketSubscription('device_update', (data: unknown) => {
    if (!isRecord(data) || !isRecord(data.device)) return;
    const device = data.device as unknown as Device;
    const isNew = Date.now() - device.firstSeen < NEW_DEVICE_WINDOW_MS;
    pushEvent({
      id: `device-${device.id}-${device.lastSeen}`,
      timestamp: device.lastSeen,
      type: 'device',
      message: isNew ? `New device detected: ${device.name}` : `Device updated: ${device.name}`,
    });
  });

  useWebSocketSubscription('threat_update', (data: unknown) => {
    if (!isRecord(data) || !isRecord(data.threat)) return;
    const threat = data.threat as unknown as Threat;
    pushEvent({
      id: `threat-${threat.id}`,
      timestamp: threat.timestamp,
      type: 'threat',
      severity: threat.severity,
      message: threat.description,
    });
  });

  useWebSocketSubscription('alert_triggered', (data: unknown) => {
    if (!isRecord(data) || !isRecord(data.alert)) return;
    const alert = data.alert as unknown as TriggeredAlert;
    pushEvent({
      id: `alert-${alert.id}`,
      timestamp: alert.timestamp,
      type: 'alert',
      severity: alert.severity,
      message: alert.description,
    });
  });

  return { events };
}
