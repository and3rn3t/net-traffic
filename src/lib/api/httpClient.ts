/**
 * Core HTTP client: fetch-with-retry, auth token management, and the shared
 * ApiError type. Domain modules (devices.ts, flows.ts, etc.) call
 * `http.request<T>(...)` rather than duplicating retry/auth logic.
 */

/** API error carrying the HTTP status and backend request ID for log correlation. */
export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    message: string,
    status: number,
    requestId: string | null = null,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
}

const AUTH_TOKEN_STORAGE_KEY = 'netinsight_auth_token';

export class HttpClient {
  readonly baseURL: string;
  readonly timeout: number;
  private authToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
    if (typeof localStorage !== 'undefined') {
      this.authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  /** Register a callback invoked when a request fails with 401 (e.g. expired token). */
  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.onUnauthorized = handler;
  }

  /** Store (or clear) the JWT used for authenticated requests. */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retries: number = 2): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
            ...options.headers,
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: response.statusText }));
          // For 4xx errors, always include status code in message for proper detection
          const errorMessage =
            response.status >= 400 && response.status < 500
              ? `HTTP ${response.status}${error.message ? `: ${error.message}` : ''}`
              : error.message || `HTTP ${response.status}`;
          const requestId = response.headers?.get?.('X-Request-ID') ?? null;

          if (response.status === 401) {
            this.onUnauthorized?.();
          }

          // Don't retry on client errors (4xx) - including 429 rate limit
          // Throw immediately without retrying
          if (response.status >= 400 && response.status < 500) {
            throw new ApiError(errorMessage, response.status, requestId);
          }

          // Retry on server errors (5xx)
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw new ApiError(errorMessage, response.status, requestId);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return await response.json();
      } catch (error) {
        // 4xx errors are thrown immediately above and should not be retried
        if (error instanceof ApiError && error.status < 500) {
          throw error;
        }

        // If fetch rejects (network error), response will be undefined
        if (error instanceof Error && error.name === 'TimeoutError') {
          // Retry timeout errors
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error('Request timeout - backend may be unavailable', { cause: error });
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw error instanceof Error ? error : new Error(String(error));
        }

        // Otherwise, wait and retry (for network errors, etc.)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Request failed after retries');
  }
}
