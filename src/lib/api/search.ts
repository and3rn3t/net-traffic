import type { HttpClient } from './httpClient';
import type { Device, NetworkFlow, Threat } from '../types';

export class SearchApi {
  constructor(private http: HttpClient) {}

  async search(
    query: string,
    type: 'all' | 'devices' | 'flows' | 'threats' = 'all',
    limit: number = 50
  ): Promise<{
    query: string;
    type: string;
    devices: Device[];
    flows: NetworkFlow[];
    threats: Threat[];
  }> {
    return this.http.request(
      `/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );
  }
}
