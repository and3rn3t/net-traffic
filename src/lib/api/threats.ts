import type { HttpClient } from './httpClient';
import type { Threat } from '../types';

export class ThreatsApi {
  constructor(private http: HttpClient) {}

  async getThreats(activeOnly: boolean = true): Promise<Threat[]> {
    return this.http.request<Threat[]>(`/api/threats?active_only=${activeOnly}`);
  }

  async dismissThreat(threatId: string): Promise<void> {
    return this.http.request(`/api/threats/${threatId}/dismiss`, { method: 'POST' });
  }
}
