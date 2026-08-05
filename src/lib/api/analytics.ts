import type { HttpClient } from './httpClient';
import type { AnalyticsData, ProtocolStats } from '../types';

export class AnalyticsApi {
  constructor(private http: HttpClient) {}

  async getAnalytics(hours: number = 24): Promise<AnalyticsData[]> {
    return this.http.request<AnalyticsData[]>(`/api/analytics?hours=${hours}`);
  }

  async getProtocolStats(): Promise<ProtocolStats[]> {
    return this.http.request<ProtocolStats[]>('/api/protocols');
  }

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
    return this.http.request('/api/stats/summary');
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
    return this.http.request(`/api/stats/geographic?hours=${hours}`);
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
    return this.http.request(`/api/stats/top/domains?limit=${limit}&hours=${hours}`);
  }

  // DNS Insights: query volume, response-code breakdown, top domains, unusual TLDs
  async getDnsStats(
    limit: number = 20,
    hours: number = 24
  ): Promise<{
    total_queries: number;
    failure_count: number;
    failure_rate: number;
    response_codes: Array<{ code: string; count: number }>;
    top_domains: Array<{ domain: string; query_count: number; failure_count: number }>;
    unusual_tlds: Array<{ tld: string; count: number }>;
  }> {
    return this.http.request(`/api/stats/dns?limit=${limit}&hours=${hours}`);
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
    return this.http.request(
      `/api/stats/top/devices?limit=${limit}&hours=${hours}&sort_by=${sortBy}`
    );
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
    return this.http.request(
      `/api/stats/bandwidth?hours=${hours}&interval_minutes=${intervalMinutes}`
    );
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
    return this.http.request(`/api/analytics/rtt-trends?${params.toString()}`);
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
    return this.http.request(`/api/analytics/jitter?${params.toString()}`);
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
    return this.http.request(`/api/analytics/retransmissions?${params.toString()}`);
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
    avg_duration: number;
    avg_packet_size: number;
    avg_bandwidth_utilization: number;
    protocol_efficiency: Record<string, { total: number; efficient: number }>;
    quality_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  }> {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (deviceId) params.append('device_id', deviceId);
    return this.http.request(`/api/analytics/connection-quality?${params.toString()}`);
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
    return this.http.request(`/api/analytics/applications?${params.toString()}`);
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
    return this.http.request(`/api/analytics/applications/trends?${params.toString()}`);
  }
}
