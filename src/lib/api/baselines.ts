import type { HttpClient } from './httpClient';
import type { DeviceBaseline } from '../types';

export class BaselinesApi {
  constructor(private http: HttpClient) {}

  async getBaselines(): Promise<DeviceBaseline[]> {
    return this.http.request('/api/baselines');
  }

  async getDeviceBaseline(deviceId: string): Promise<DeviceBaseline> {
    return this.http.request(`/api/baselines/${deviceId}`);
  }
}
