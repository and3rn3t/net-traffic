import type { HttpClient } from './httpClient';
import type { AlertRule, AlertRuleInput, TriggeredAlert } from '../types';

export class AlertsApi {
  constructor(private http: HttpClient) {}

  async getAlertRules(): Promise<AlertRule[]> {
    return this.http.request('/api/alerts/rules');
  }

  async createAlertRule(rule: AlertRuleInput): Promise<AlertRule> {
    return this.http.request('/api/alerts/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateAlertRule(ruleId: string, rule: Partial<AlertRuleInput>): Promise<AlertRule> {
    return this.http.request(`/api/alerts/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(rule),
    });
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    await this.http.request(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' });
  }

  async getTriggeredAlerts(limit = 100, acknowledged?: boolean): Promise<TriggeredAlert[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (acknowledged !== undefined) params.append('acknowledged', acknowledged.toString());
    return this.http.request(`/api/alerts/triggered?${params.toString()}`);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.http.request(`/api/alerts/triggered/${alertId}/acknowledge`, { method: 'POST' });
  }
}
