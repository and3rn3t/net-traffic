/**
 * API Client for NetInsight Backend
 * Connects frontend to Raspberry Pi 5 backend service
 */

import type {
  Device,
  NetworkFlow,
  Threat,
  AnalyticsData,
  ProtocolStats,
  CaptureStatus,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
}

export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private wsPingInterval: NodeJS.Timeout | null = null;

  constructor(config: ApiConfig = { baseURL: API_BASE_URL, timeout: 30000 }) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 2
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
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
          // For 4xx errors, always include status code in message for proper detection
          const errorMessage =
            response.status >= 400 && response.status < 500
              ? `HTTP ${response.status}${error.message ? `: ${error.message}` : ''}`
              : error.message || `HTTP ${response.status}`;

          // Don't retry on client errors (4xx) - including 429 rate limit
          // Throw immediately without retrying
          if (response.status >= 400 && response.status < 500) {
            throw new Error(errorMessage);
          }

          // Retry on server errors (5xx)
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(errorMessage);
        }

        return await response.json();
      } catch (error) {
        // Check if this is a 4xx error that was thrown (should not retry)
        // 4xx errors are thrown immediately and should not be retried
        // Check error message for HTTP 4xx pattern
        if (error instanceof Error && /HTTP 4\d{2}/.test(error.message)) {
          throw error; // Don't retry 4xx errors - exit function immediately
        }

        // If fetch rejects (network error), response will be undefined
        if (error instanceof Error && error.name === 'TimeoutError') {
          // Retry timeout errors
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error('Request timeout - backend may be unavailable');
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw error instanceof Error ? error : new Error(String(error));
        }

        // Otherwise, wait and retry (for network errors, etc.)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Request failed after retries');
  }

  // Health check
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
    return this.request('/api/health');
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return this.request<Device[]>('/api/devices');
  }

  async getDevice(deviceId: string): Promise<Device> {
    return this.request<Device>(`/api/devices/${deviceId}`);
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
    minBytes?: number,
    // New enhanced filters
    country?: string,
    city?: string,
    application?: string,
    minRtt?: number,
    maxRtt?: number,
    maxJitter?: number,
    maxRetransmissions?: number,
    sni?: string,
    connectionState?: string
  ): Promise<NetworkFlow[]> {
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
    // New enhanced filters
    if (country) params.append('country', country);
    if (city) params.append('city', city);
    if (application) params.append('application', application);
    if (minRtt !== undefined) params.append('min_rtt', minRtt.toString());
    if (maxRtt !== undefined) params.append('max_rtt', maxRtt.toString());
    if (maxJitter !== undefined) params.append('max_jitter', maxJitter.toString());
    if (maxRetransmissions !== undefined)
      params.append('max_retransmissions', maxRetransmissions.toString());
    if (sni) params.append('sni', sni);
    if (connectionState) params.append('connection_state', connectionState);

    return this.request<NetworkFlow[]>(`/api/flows?${params.toString()}`);
  }

  async getFlow(flowId: string): Promise<NetworkFlow> {
    return this.request<NetworkFlow>(`/api/flows/${flowId}`);
  }

  // Threats
  async getThreats(activeOnly: boolean = true): Promise<Threat[]> {
    return this.request<Threat[]>(`/api/threats?active_only=${activeOnly}`);
  }

  async dismissThreat(threatId: string): Promise<void> {
    return this.request(`/api/threats/${threatId}/dismiss`, { method: 'POST' });
  }

  // Analytics
  async getAnalytics(hours: number = 24): Promise<AnalyticsData[]> {
    return this.request<AnalyticsData[]>(`/api/analytics?hours=${hours}`);
  }

  async getProtocolStats(): Promise<ProtocolStats[]> {
    return this.request<ProtocolStats[]>('/api/protocols');
  }

  // Capture control
  async getCaptureStatus(): Promise<CaptureStatus> {
    return this.request<CaptureStatus>('/api/capture/status');
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

  // Network Quality Analytics
  async getRttTrends(
    hours: number = 24,
    deviceId?: string,
    country?: string,
    intervalMinutes: number = 15
  ): Promise<
    Array<{
      timestamp: number;
      avg_rtt: number;
      min_rtt: number;
      max_rtt: number;
      count: number;
    }>
  > {
    const params = new URLSearchParams({
      hours: hours.toString(),
      interval_minutes: intervalMinutes.toString(),
    });
    if (deviceId) params.append('device_id', deviceId);
    if (country) params.append('country', country);
    return this.request(`/api/analytics/rtt-trends?${params.toString()}`);
  }

  async getJitterAnalysis(
    hours: number = 24,
    deviceId?: string
  ): Promise<{
    avg_jitter: number;
    min_jitter: number;
    max_jitter: number;
    count: number;
    distribution: Array<{ range: string; count: number }>;
  }> {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/api/analytics/jitter?${params.toString()}`);
  }

  async getRetransmissionReport(
    hours: number = 24,
    deviceId?: string
  ): Promise<{
    total_flows: number;
    flows_with_retransmissions: number;
    total_retransmissions: number;
    total_packets: number;
    retransmission_rate: number;
    by_protocol: Array<{
      protocol: string;
      flows: number;
      retransmissions: number;
      rate: number;
    }>;
  }> {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/api/analytics/retransmissions?${params.toString()}`);
  }

  async getConnectionQualitySummary(
    hours: number = 24,
    deviceId?: string
  ): Promise<{
    total_flows: number;
    flows_with_metrics: number;
    quality_score: number;
    avg_rtt: number;
    avg_jitter: number;
    avg_retransmissions: number;
    quality_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  }> {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/api/analytics/connection-quality?${params.toString()}`);
  }

  // Application Analytics
  async getApplicationBreakdown(
    hours: number = 24,
    deviceId?: string,
    limit: number = 20
  ): Promise<
    Array<{
      application: string;
      connections: number;
      bytes: number;
      packets: number;
      unique_devices: number;
      avg_rtt: number | null;
      traffic_percentage: number;
    }>
  > {
    const params = new URLSearchParams({
      hours: hours.toString(),
      limit: limit.toString(),
    });
    if (deviceId) params.append('device_id', deviceId);
    return this.request(`/api/analytics/applications?${params.toString()}`);
  }

  async getApplicationTrends(
    hours: number = 24,
    application?: string,
    intervalMinutes: number = 15
  ): Promise<
    Array<{
      timestamp: number;
      applications: Array<{
        application: string;
        connections: number;
        bytes: number;
      }>;
    }>
  > {
    const params = new URLSearchParams({
      hours: hours.toString(),
      interval_minutes: intervalMinutes.toString(),
    });
    if (application) params.append('application', application);
    return this.request(`/api/analytics/applications/trends?${params.toString()}`);
  }

  async getDeviceApplicationProfile(
    deviceId: string,
    hours: number = 24
  ): Promise<{
    device_id: string;
    total_applications: number;
    total_connections: number;
    total_bytes: number;
    applications: Array<{
      application: string;
      connections: number;
      bytes: number;
      avg_duration: number;
      traffic_percentage: number;
    }>;
  }> {
    return this.request(`/api/analytics/devices/${deviceId}/applications?hours=${hours}`);
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
  ): Promise<Device> {
    return this.request<Device>(`/api/devices/${deviceId}`, {
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
    devices: Device[];
    flows: NetworkFlow[];
    threats: Threat[];
  }> {
    return this.request(`/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
  }

  // Maintenance
  async getMaintenanceStats(): Promise<{
    database_size?: number;
    total_flows?: number;
    oldest_flow_timestamp?: number;
    retention_days?: number;
    last_cleanup?: number;
  }> {
    return this.request('/api/maintenance/stats');
  }

  async runCleanup(): Promise<void> {
    return this.request('/api/maintenance/cleanup', { method: 'POST' });
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

  // WebSocket connection for real-time updates with improved resilience
  connectWebSocket(onMessage: (data: unknown) => void): () => void {
    // Clear any existing reconnect timeout
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    // If already connected, return disconnect function
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return () => this.disconnectWebSocket();
    }

    const wsUrl = this.baseURL.replace(/^http/, 'ws') + '/ws';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.wsReconnectAttempts = 0;

        // Clear any existing ping interval
        if (this.wsPingInterval) {
          clearInterval(this.wsPingInterval);
        }

        // Send ping to keep connection alive
        this.wsPingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send('ping');
            } catch (error) {
              console.error('Failed to send WebSocket ping:', error);
            }
          } else {
            if (this.wsPingInterval) {
              clearInterval(this.wsPingInterval);
              this.wsPingInterval = null;
            }
          }
        }, 30000); // Ping every 30 seconds
      };

      this.ws.onmessage = event => {
        try {
          // Ignore pong responses
          if (event.data === 'pong') {
            return;
          }

          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = error => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = event => {
        console.log(
          `WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`
        );

        // Clear ping interval
        if (this.wsPingInterval) {
          clearInterval(this.wsPingInterval);
          this.wsPingInterval = null;
        }

        // Attempt to reconnect with exponential backoff
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, max 60s
          const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts - 1), 60000);

          console.log(
            `Scheduling WebSocket reconnect in ${delay / 1000}s... (attempt ${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`
          );

          this.wsReconnectTimeout = setTimeout(() => {
            // Only reconnect if not already connected
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
              console.log(
                `Attempting WebSocket reconnect (${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`
              );
              this.connectWebSocket(onMessage);
            }
          }, delay);
        } else {
          console.error(
            `Max WebSocket reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
          );
          // Reset attempts after a longer delay to allow future manual retries
          setTimeout(() => {
            this.wsReconnectAttempts = 0;
          }, 300000); // Reset after 5 minutes
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }

    return () => this.disconnectWebSocket();
  }

  disconnectWebSocket(): void {
    // Clear reconnect timeout
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    // Clear ping interval
    if (this.wsPingInterval) {
      clearInterval(this.wsPingInterval);
      this.wsPingInterval = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reset reconnect attempts
    this.wsReconnectAttempts = 0;
  }

  // Subscribe to specific event types
  on(event: string, callback: (data: unknown) => void): () => void {
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
