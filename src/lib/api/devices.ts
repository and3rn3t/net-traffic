import type { HttpClient } from './httpClient';
import type { Device } from '../types';

export class DevicesApi {
  constructor(private http: HttpClient) {}

  async getDevices(): Promise<Device[]> {
    return this.http.request<Device[]>('/api/devices');
  }

  async getDevice(deviceId: string): Promise<Device> {
    return this.http.request<Device>(`/api/devices/${deviceId}`);
  }

  async updateDevice(
    deviceId: string,
    update: { name?: string; type?: string; notes?: string; tags?: string[] }
  ): Promise<Device> {
    return this.http.request<Device>(`/api/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

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
    return this.http.request(`/api/devices/${deviceId}/analytics?hours=${hours}`);
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
    return this.http.request(`/api/analytics/devices/${deviceId}/applications?hours=${hours}`);
  }
}
