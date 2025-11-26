/**
 * API Client for NetInsight Backend
 * Connects frontend to Raspberry Pi 5 backend service
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private wsListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: ApiConfig = { baseURL: API_BASE_URL, timeout: 30000 }) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Request timeout - backend may be unavailable');
      }
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    capture_running: boolean;
    active_flows: number;
    active_devices: number;
  }> {
    return this.request('/api/health');
  }

  // Devices
  async getDevices(): Promise<any[]> {
    return this.request('/api/devices');
  }

  async getDevice(deviceId: string): Promise<any> {
    return this.request(`/api/devices/${deviceId}`);
  }

  // Flows
  async getFlows(
    limit: number = 100,
    offset: number = 0,
    deviceId?: string,
    status?: string,
    protocol?: string,
    startTime?: number,
    endTime?: number,
    sourceIp?: string,
    destIp?: string,
    threatLevel?: string,
    minBytes?: number
  ): Promise<any[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (deviceId) params.append('device_id', deviceId);
    if (status) params.append('status', status);
    if (protocol) params.append('protocol', protocol);
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    if (sourceIp) params.append('source_ip', sourceIp);
    if (destIp) params.append('dest_ip', destIp);
    if (threatLevel) params.append('threat_level', threatLevel);
    if (minBytes) params.append('min_bytes', minBytes.toString());

    return this.request(`/api/flows?${params.toString()}`);
  }

  async getFlow(flowId: string): Promise<any> {
    return this.request(`/api/flows/${flowId}`);
  }

  // Threats
  async getThreats(activeOnly: boolean = true): Promise<any[]> {
    return this.request(`/api/threats?active_only=${activeOnly}`);
  }

  async dismissThreat(threatId: string): Promise<void> {
    return this.request(`/api/threats/${threatId}/dismiss`, { method: 'POST' });
  }

  // Analytics
  async getAnalytics(hours: number = 24): Promise<any[]> {
    return this.request(`/api/analytics?hours=${hours}`);
  }

  async getProtocolStats(): Promise<any[]> {
    return this.request('/api/protocols');
  }

  // Capture control
  async getCaptureStatus(): Promise<any> {
    return this.request('/api/capture/status');
  }

  async startCapture(): Promise<void> {
    return this.request('/api/capture/start', { method: 'POST' });
  }

  async stopCapture(): Promise<void> {
    return this.request('/api/capture/stop', { method: 'POST' });
  }

  // Enhanced endpoints

  // Summary Statistics
  async getSummaryStats(): Promise<{
    total_devices: number;
    active_devices: number;
    total_flows: number;
    active_flows: number;
    total_bytes: number;
    total_threats: number;
    active_threats: number;
    critical_threats: number;
    oldest_flow_timestamp: number;
    newest_flow_timestamp: number;
    capture_duration_hours: number;
  }> {
    return this.request('/api/stats/summary');
  }

  // Geographic Statistics
  async getGeographicStats(hours: number = 24): Promise<
    Array<{
      country: string;
      connections: number;
      bytes: number;
      threats: number;
    }>
  > {
    return this.request(`/api/stats/geographic?hours=${hours}`);
  }

  // Top Domains
  async getTopDomains(
    limit: number = 20,
    hours: number = 24
  ): Promise<
    Array<{
      domain: string;
      connections: number;
      bytes: number;
      unique_devices: number;
    }>
  > {
    return this.request(`/api/stats/top/domains?limit=${limit}&hours=${hours}`);
  }

  // Top Devices
  async getTopDevices(
    limit: number = 10,
    hours: number = 24,
    sortBy: 'bytes' | 'connections' | 'threats' = 'bytes'
  ): Promise<
    Array<{
      device_id: string;
      device_name: string;
      device_ip: string;
      device_type: string;
      bytes: number;
      connections: number;
      threats: number;
    }>
  > {
    return this.request(`/api/stats/top/devices?limit=${limit}&hours=${hours}&sort_by=${sortBy}`);
  }

  // Bandwidth Timeline
  async getBandwidthTimeline(
    hours: number = 24,
    intervalMinutes: number = 5
  ): Promise<
    Array<{
      timestamp: number;
      bytes_in: number;
      bytes_out: number;
      packets: number;
      connections: number;
    }>
  > {
    return this.request(`/api/stats/bandwidth?hours=${hours}&interval_minutes=${intervalMinutes}`);
  }

  // Device Analytics
  async getDeviceAnalytics(
    deviceId: string,
    hours: number = 24
  ): Promise<{
    device: {
      id: string;
      name: string;
      ip: string;
      type: string;
    };
    summary: {
      total_bytes_in: number;
      total_bytes_out: number;
      total_bytes: number;
      connections: number;
      threats: number;
    };
    protocols: Array<{
      protocol: string;
      bytes: number;
      connections: number;
    }>;
    top_domains: Array<{
      domain: string;
      bytes: number;
    }>;
    top_ports: Array<{
      port: number;
      connections: number;
    }>;
  }> {
    return this.request(`/api/devices/${deviceId}/analytics?hours=${hours}`);
  }

  // Update Device
  async updateDevice(
    deviceId: string,
    update: { name?: string; type?: string; notes?: string }
  ): Promise<any> {
    return this.request(`/api/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  // Search
  async search(
    query: string,
    type: 'all' | 'devices' | 'flows' | 'threats' = 'all',
    limit: number = 50
  ): Promise<{
    query: string;
    type: string;
    devices: any[];
    flows: any[];
    threats: any[];
  }> {
    return this.request(`/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
  }

  // Export Flows
  async exportFlows(
    format: 'json' | 'csv' = 'json',
    startTime?: number,
    endTime?: number,
    deviceId?: string
  ): Promise<void> {
    const params = new URLSearchParams({ format });
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    if (deviceId) params.append('device_id', deviceId);

    const url = `/api/export/flows?${params.toString()}`;

    // Fetch as blob for both formats
    const response = await fetch(`${this.baseURL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const extension = format === 'csv' ? 'csv' : 'json';
    link.download = `flows_export_${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.URL.revokeObjectURL(downloadUrl);
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): () => void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.disconnectWebSocket;
    }

    const wsUrl = this.baseURL.replace(/^http/, 'ws') + '/ws';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.wsReconnectAttempts = 0;

        // Send ping to keep connection alive
        const pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      this.ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = error => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');

        // Attempt to reconnect
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
          console.log(
            `Reconnecting WebSocket in ${delay}ms... (attempt ${this.wsReconnectAttempts})`
          );

          setTimeout(() => {
            if (this.ws?.readyState !== WebSocket.OPEN) {
              this.connectWebSocket(onMessage);
            }
          }, delay);
        } else {
          console.error('Max WebSocket reconnect attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }

    return this.disconnectWebSocket;
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Subscribe to specific event types
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, new Set());
    }

    this.wsListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.wsListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
