import type { HttpClient } from './httpClient';

export class FilterPresetsApi {
  constructor(private http: HttpClient) {}

  async createFilterPreset(
    name: string,
    filters: Record<string, unknown>
  ): Promise<{
    id: string;
    userId: string;
    name: string;
    filters: Record<string, unknown>;
    createdAt: number;
  }> {
    return this.http.request('/api/filter-presets', {
      method: 'POST',
      body: JSON.stringify({ name, filters }),
    });
  }

  async listFilterPresets(): Promise<
    Array<{
      id: string;
      userId: string;
      name: string;
      filters: Record<string, unknown>;
      createdAt: number;
    }>
  > {
    return this.http.request('/api/filter-presets');
  }

  async deleteFilterPreset(presetId: string): Promise<void> {
    await this.http.request(`/api/filter-presets/${presetId}`, { method: 'DELETE' });
  }
}
