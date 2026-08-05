/**
 * ApiClient facade: composes the per-domain API modules below and exposes
 * every method directly (e.g. `apiClient.getDevices()`), preserving the
 * exact public surface the previous single-file api.ts had - no call site
 * in the app needs to change.
 */
import type { Device, NetworkFlow, Threat, AnalyticsData, ProtocolStats } from '../types';
import type { AlertRule, AlertRuleInput, TriggeredAlert, DeviceBaseline } from '../types';
import type { CaptureStatus } from '../types';
import { HttpClient, type ApiConfig } from './httpClient';
import { WsClient } from './wsClient';
import { DevicesApi } from './devices';
import { FlowsApi } from './flows';
import { ThreatsApi } from './threats';
import { AnalyticsApi } from './analytics';
import { CaptureApi } from './capture';
import { AuthApi, type AuthUser } from './auth';
import { FilterPresetsApi } from './filterPresets';
import { AlertsApi } from './alerts';
import { BaselinesApi } from './baselines';
import { SearchApi } from './search';
import { MaintenanceApi } from './maintenance';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export class ApiClient {
  private http: HttpClient;
  private ws: WsClient;
  private devicesApi: DevicesApi;
  private flowsApi: FlowsApi;
  private threatsApi: ThreatsApi;
  private analyticsApi: AnalyticsApi;
  private captureApi: CaptureApi;
  private authApi: AuthApi;
  private filterPresetsApi: FilterPresetsApi;
  private alertsApi: AlertsApi;
  private baselinesApi: BaselinesApi;
  private searchApi: SearchApi;
  private maintenanceApi: MaintenanceApi;

  constructor(config: ApiConfig = { baseURL: API_BASE_URL, timeout: 30000 }) {
    this.http = new HttpClient(config);
    this.ws = new WsClient(this.http.baseURL);
    this.devicesApi = new DevicesApi(this.http);
    this.flowsApi = new FlowsApi(this.http);
    this.threatsApi = new ThreatsApi(this.http);
    this.analyticsApi = new AnalyticsApi(this.http);
    this.captureApi = new CaptureApi(this.http);
    this.authApi = new AuthApi(this.http);
    this.filterPresetsApi = new FilterPresetsApi(this.http);
    this.alertsApi = new AlertsApi(this.http);
    this.baselinesApi = new BaselinesApi(this.http);
    this.searchApi = new SearchApi(this.http);
    this.maintenanceApi = new MaintenanceApi(this.http);
  }

  // Auth token management
  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.http.setUnauthorizedHandler(handler);
  }

  setAuthToken(token: string | null): void {
    this.http.setAuthToken(token);
  }

  getAuthToken(): string | null {
    return this.http.getAuthToken();
  }

  // Health / capture
  healthCheck() {
    return this.captureApi.healthCheck();
  }

  getCaptureStatus(): Promise<CaptureStatus> {
    return this.captureApi.getCaptureStatus();
  }

  startCapture(): Promise<void> {
    return this.captureApi.startCapture();
  }

  stopCapture(): Promise<void> {
    return this.captureApi.stopCapture();
  }

  // Devices
  getDevices(): Promise<Device[]> {
    return this.devicesApi.getDevices();
  }

  getDevice(deviceId: string): Promise<Device> {
    return this.devicesApi.getDevice(deviceId);
  }

  updateDevice(
    deviceId: string,
    update: { name?: string; type?: string; notes?: string; tags?: string[] }
  ): Promise<Device> {
    return this.devicesApi.updateDevice(deviceId, update);
  }

  getDeviceAnalytics(deviceId: string, hours: number = 24) {
    return this.devicesApi.getDeviceAnalytics(deviceId, hours);
  }

  getDeviceApplicationProfile(deviceId: string, hours: number = 24) {
    return this.devicesApi.getDeviceApplicationProfile(deviceId, hours);
  }

  // Flows
  getFlows(
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
    return this.flowsApi.getFlows(
      limit,
      offset,
      deviceId,
      status,
      protocol,
      startTime,
      endTime,
      sourceIp,
      destIp,
      threatLevel,
      minBytes,
      country,
      city,
      application,
      minRtt,
      maxRtt,
      maxJitter,
      maxRetransmissions,
      sni,
      connectionState
    );
  }

  getFlow(flowId: string): Promise<NetworkFlow> {
    return this.flowsApi.getFlow(flowId);
  }

  exportFlows(
    format: 'json' | 'csv' = 'json',
    startTime?: number,
    endTime?: number,
    deviceId?: string
  ): Promise<void> {
    return this.flowsApi.exportFlows(format, startTime, endTime, deviceId);
  }

  // Threats
  getThreats(activeOnly: boolean = true): Promise<Threat[]> {
    return this.threatsApi.getThreats(activeOnly);
  }

  dismissThreat(threatId: string): Promise<void> {
    return this.threatsApi.dismissThreat(threatId);
  }

  // Analytics
  getAnalytics(hours: number = 24): Promise<AnalyticsData[]> {
    return this.analyticsApi.getAnalytics(hours);
  }

  getProtocolStats(): Promise<ProtocolStats[]> {
    return this.analyticsApi.getProtocolStats();
  }

  getSummaryStats() {
    return this.analyticsApi.getSummaryStats();
  }

  getGeographicStats(hours: number = 24) {
    return this.analyticsApi.getGeographicStats(hours);
  }

  getTopDomains(limit: number = 20, hours: number = 24) {
    return this.analyticsApi.getTopDomains(limit, hours);
  }

  getDnsStats(limit: number = 20, hours: number = 24) {
    return this.analyticsApi.getDnsStats(limit, hours);
  }

  getTopDevices(
    limit: number = 10,
    hours: number = 24,
    sortBy: 'bytes' | 'connections' | 'threats' = 'bytes'
  ) {
    return this.analyticsApi.getTopDevices(limit, hours, sortBy);
  }

  getBandwidthTimeline(hours: number = 24, intervalMinutes: number = 5) {
    return this.analyticsApi.getBandwidthTimeline(hours, intervalMinutes);
  }

  getRttTrends(
    hours: number = 24,
    deviceId?: string,
    country?: string,
    intervalMinutes: number = 15
  ) {
    return this.analyticsApi.getRttTrends(hours, deviceId, country, intervalMinutes);
  }

  getJitterAnalysis(hours: number = 24, deviceId?: string) {
    return this.analyticsApi.getJitterAnalysis(hours, deviceId);
  }

  getRetransmissionReport(hours: number = 24, deviceId?: string) {
    return this.analyticsApi.getRetransmissionReport(hours, deviceId);
  }

  getConnectionQualitySummary(hours: number = 24, deviceId?: string) {
    return this.analyticsApi.getConnectionQualitySummary(hours, deviceId);
  }

  getApplicationBreakdown(hours: number = 24, deviceId?: string, limit: number = 20) {
    return this.analyticsApi.getApplicationBreakdown(hours, deviceId, limit);
  }

  getApplicationTrends(hours: number = 24, application?: string, intervalMinutes: number = 15) {
    return this.analyticsApi.getApplicationTrends(hours, application, intervalMinutes);
  }

  // Auth
  login(username: string, password: string) {
    return this.authApi.login(username, password);
  }

  getCurrentUser(): Promise<AuthUser> {
    return this.authApi.getCurrentUser();
  }

  // Saved filter presets
  createFilterPreset(name: string, filters: Record<string, unknown>) {
    return this.filterPresetsApi.createFilterPreset(name, filters);
  }

  listFilterPresets() {
    return this.filterPresetsApi.listFilterPresets();
  }

  deleteFilterPreset(presetId: string): Promise<void> {
    return this.filterPresetsApi.deleteFilterPreset(presetId);
  }

  // Configurable alert rules
  getAlertRules(): Promise<AlertRule[]> {
    return this.alertsApi.getAlertRules();
  }

  createAlertRule(rule: AlertRuleInput): Promise<AlertRule> {
    return this.alertsApi.createAlertRule(rule);
  }

  updateAlertRule(ruleId: string, rule: Partial<AlertRuleInput>): Promise<AlertRule> {
    return this.alertsApi.updateAlertRule(ruleId, rule);
  }

  deleteAlertRule(ruleId: string): Promise<void> {
    return this.alertsApi.deleteAlertRule(ruleId);
  }

  getTriggeredAlerts(limit = 100, acknowledged?: boolean): Promise<TriggeredAlert[]> {
    return this.alertsApi.getTriggeredAlerts(limit, acknowledged);
  }

  acknowledgeAlert(alertId: string): Promise<void> {
    return this.alertsApi.acknowledgeAlert(alertId);
  }

  // Baselines
  getBaselines(): Promise<DeviceBaseline[]> {
    return this.baselinesApi.getBaselines();
  }

  getDeviceBaseline(deviceId: string): Promise<DeviceBaseline> {
    return this.baselinesApi.getDeviceBaseline(deviceId);
  }

  // Search
  search(query: string, type: 'all' | 'devices' | 'flows' | 'threats' = 'all', limit: number = 50) {
    return this.searchApi.search(query, type, limit);
  }

  // Maintenance
  getMaintenanceStats() {
    return this.maintenanceApi.getMaintenanceStats();
  }

  runCleanup(days?: number) {
    return this.maintenanceApi.runCleanup(days);
  }

  // WebSocket
  connectWebSocket(onMessage: (data: unknown) => void): () => void {
    return this.ws.connectWebSocket(onMessage);
  }

  disconnectWebSocket(): void {
    this.ws.disconnectWebSocket();
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    return this.ws.on(event, callback);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
