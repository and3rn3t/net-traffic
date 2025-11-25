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
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
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
  async getFlows(limit: number = 100, deviceId?: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (deviceId) params.append('device_id', deviceId);
    if (status) params.append('status', status);

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

// Export types
export type { ApiConfig };
