import type { HttpClient } from './httpClient';

export class MaintenanceApi {
  constructor(private http: HttpClient) {}

  async getMaintenanceStats(): Promise<{
    database_size?: number;
    total_flows?: number;
    oldest_flow_timestamp?: number;
    retention_days?: number;
    last_cleanup?: number;
  }> {
    return this.http.request('/api/maintenance/stats');
  }

  async runCleanup(days?: number): Promise<{
    status: string;
    retention_days: number;
    flows_deleted?: number;
    devices_deleted?: number;
  }> {
    const params = days ? `?days=${days}` : '';
    return this.http.request(`/api/maintenance/cleanup${params}`, { method: 'POST' });
  }
}
