import type { HttpClient } from './httpClient';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: 'admin' | 'operator' | 'viewer';
  disabled: boolean;
}

export class AuthApi {
  constructor(private http: HttpClient) {}

  async login(
    username: string,
    password: string
  ): Promise<{ access_token: string; token_type: string }> {
    const response = await fetch(`${this.http.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }).toString(),
      signal: AbortSignal.timeout(this.http.timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<AuthUser> {
    return this.http.request<AuthUser>('/api/auth/me');
  }
}
