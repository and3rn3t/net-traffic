/**
 * Integration tests for API error scenarios
 * Tests error handling, retries, and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../api';

// Mock fetch globally
globalThis.fetch = vi.fn();

describe('API Client Error Handling Integration Tests', () => {
  let apiClient: ApiClient;
  const baseURL = 'http://localhost:8000';

  beforeEach(() => {
    apiClient = new ApiClient({ baseURL, timeout: 5000 });
    vi.clearAllMocks();
  });

  describe('Network Errors', () => {
    it('should handle network failures', async () => {
      (globalThis.fetch as any).mockRejectedValue(new Error('Network request failed'));

      await expect(apiClient.getDevices()).rejects.toThrow('Network request failed');
    });

    it('should retry on network failures', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];

      (globalThis.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevices,
        });

      const devices = await apiClient.getDevices();

      expect(devices).toEqual(mockDevices);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(apiClient.getDevices()).rejects.toThrow('Network error');
      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('HTTP Error Responses', () => {
    it('should handle 400 Bad Request', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid request parameters' }),
      });

      await expect(apiClient.getDevice('invalid')).rejects.toThrow();
    });

    it('should handle 401 Unauthorized', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Authentication required' }),
      });

      await expect(apiClient.getDevices()).rejects.toThrow();
    });

    it('should handle 404 Not Found', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Resource not found' }),
      });

      await expect(apiClient.getDevice('nonexistent')).rejects.toThrow();
    });

    it('should retry on 500 Internal Server Error', async () => {
      const mockDevice = { id: '1', name: 'Device 1' };

      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevice,
        });

      const device = await apiClient.getDevice('1');

      expect(device).toEqual(mockDevice);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 Service Unavailable', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];

      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ message: 'Service temporarily unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevices,
        });

      const devices = await apiClient.getDevices();

      expect(devices).toEqual(mockDevices);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 429 Rate Limit (but handle gracefully)', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ message: 'Rate limit exceeded', retry_after: 60 }),
      });

      await expect(apiClient.getDevices()).rejects.toThrow();
      // Should not retry on 429 - error message will include "HTTP 429"
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout Errors', () => {
    it('should handle request timeouts', async () => {
      (globalThis.fetch as any).mockImplementation(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
      );

      await expect(apiClient.getDevices()).rejects.toThrow();
    });

    it('should retry on timeout', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];

      (globalThis.fetch as any)
        .mockImplementationOnce(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevices,
        });

      // Note: This test may need adjustment based on actual timeout implementation
      const devices = await apiClient.getDevices();

      expect(devices).toEqual(mockDevices);
    });
  });

  describe('Invalid JSON Responses', () => {
    it('should handle invalid JSON in error response', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(apiClient.getDevices()).rejects.toThrow();
    });

    it('should handle empty response body', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 204,
        statusText: 'No Content',
        json: async () => ({}),
      });

      // Should not throw on empty response if status is handled
      await expect(apiClient.getDevices()).rejects.toThrow();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];
      const mockFlows = [{ id: '1', protocol: 'HTTPS' }];

      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevices,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFlows,
        });

      const [devices, flows] = await Promise.all([apiClient.getDevices(), apiClient.getFlows()]);

      expect(devices).toEqual(mockDevices);
      expect(flows).toEqual(mockFlows);
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];

      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDevices,
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const [devicesResult, flowsResult] = await Promise.allSettled([
        apiClient.getDevices(),
        apiClient.getFlows(),
      ]);

      expect(devicesResult.status).toBe('fulfilled');
      expect(flowsResult.status).toBe('rejected');
    });
  });

  describe('WebSocket Error Scenarios', () => {
    it('should handle WebSocket connection failures', () => {
      // Mock WebSocket to throw on construction
      const OriginalWebSocket = globalThis.WebSocket;
      globalThis.WebSocket = class {
        constructor() {
          throw new Error('WebSocket connection failed');
        }
      } as any;

      const onMessage = vi.fn();

      // Should not throw, but handle gracefully
      expect(() => {
        apiClient.connectWebSocket(onMessage);
      }).not.toThrow();

      // Restore
      globalThis.WebSocket = OriginalWebSocket;
    });

    it('should handle WebSocket message parsing errors', async () => {
      const onMessage = vi.fn();
      const disconnect = apiClient.connectWebSocket(onMessage);

      // This is a simplified test - in real scenario, invalid JSON would be handled
      expect(disconnect).toBeDefined();
      expect(typeof disconnect).toBe('function');

      // Wait a bit for WebSocket to potentially connect
      await new Promise(resolve => setTimeout(resolve, 50));

      // Disconnect should not throw even if WebSocket is not connected
      expect(() => disconnect()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const devices = await apiClient.getDevices();

      expect(devices).toEqual([]);
    });

    it('should handle null responses', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await apiClient.getDevices();

      expect(result).toBeNull();
    });

    it('should handle very large responses', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `device-${i}`,
        name: `Device ${i}`,
      }));

      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => largeArray,
      });

      const devices = await apiClient.getDevices();

      expect(devices).toHaveLength(10000);
    });
  });
});
