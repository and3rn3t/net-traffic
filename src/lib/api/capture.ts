import type { HttpClient } from './httpClient';
import type { CaptureStatus } from '../types';

export class CaptureApi {
  constructor(private http: HttpClient) {}

  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    capture_running: boolean;
    active_flows: number;
    active_devices: number;
    services?: {
      storage: boolean;
      packet_capture: boolean;
      device_service: boolean;
      threat_service: boolean;
      analytics: boolean;
    };
    capture?: {
      running: boolean;
      interface: string;
      packets_captured: number;
      flows_detected: number;
    };
    database?: {
      active_flows: number;
      active_devices: number;
    };
    websocket?: {
      active_connections: number;
    };
  }> {
    return this.http.request('/api/health');
  }

  async getCaptureStatus(): Promise<CaptureStatus> {
    return this.http.request<CaptureStatus>('/api/capture/status');
  }

  async startCapture(): Promise<void> {
    return this.http.request('/api/capture/start', { method: 'POST' });
  }

  async stopCapture(): Promise<void> {
    return this.http.request('/api/capture/stop', { method: 'POST' });
  }
}
