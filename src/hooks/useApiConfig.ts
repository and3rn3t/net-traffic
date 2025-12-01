/**
 * Hook to access API configuration
 * Provides consistent access to API-related environment variables
 */
export function useApiConfig() {
  // Environment variables are build-time constants, not runtime state
  // Using useState here would be incorrect as env vars don't change at runtime
  const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  return {
    useRealApi,
    apiBaseUrl,
    // Alias for backward compatibility
    USE_REAL_API: useRealApi,
    API_BASE_URL: apiBaseUrl,
  };
}

/**
 * Direct constant access (for use outside React components)
 * Use this in non-component files like hooks, utilities, etc.
 */
export const API_CONFIG = {
  USE_REAL_API: import.meta.env.VITE_USE_REAL_API === 'true',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
} as const;
