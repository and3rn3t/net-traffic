import type { HttpClient } from './httpClient';
import type { NetworkFlow } from '../types';

export class FlowsApi {
  constructor(private http: HttpClient) {}

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

    return this.http.request<NetworkFlow[]>(`/api/flows?${params.toString()}`);
  }

  async getFlow(flowId: string): Promise<NetworkFlow> {
    return this.http.request<NetworkFlow>(`/api/flows/${flowId}`);
  }

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
    const response = await fetch(`${this.http.baseURL}${url}`, {
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
}
