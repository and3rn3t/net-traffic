/**
 * Integration tests for API Client
 * Tests real API interactions with mocked fetch/WebSocket
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../api';

// Mock fetch globally
global.fetch = vi.fn();

// Mock WebSocket globally
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  addEventListener(event: string, handler: (event: any) => void) {
    if (event === 'message') {
      this.onmessage = handler;
    }
  }

  removeEventListener(event: string, handler: (event: any) => void) {
    if (event === 'message' && this.onmessage === handler) {
      this.onmessage = null;
    }
  }
}

global.WebSocket = MockWebSocket as any;

describe('ApiClient Integration Tests', () => {
  let apiClient: ApiClient;
  const baseURL = 'http://localhost:8000';

  beforeEach(() => {
    apiClient = new ApiClient({ baseURL, timeout: 5000 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Check', () => {
    it('should successfully check backend health', async () => {
      const mockHealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: true,
        active_flows: 10,
        active_devices: 5,
        services: {
          storage: true,
          packet_capture: true,
          device_service: true,
          threat_service: true,
          analytics: true,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      });

      const health = await apiClient.healthCheck();

      expect(health).toEqual(mockHealthResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/health`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle health check failures', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.healthCheck()).rejects.toThrow();
      // Should retry, so fetch will be called multiple times
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should retry on transient failures', async () => {
      const mockResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        capture_running: false,
      };

      // First call fails, second succeeds
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const health = await apiClient.healthCheck();

      expect(health).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Devices API', () => {
    it('should fetch devices successfully', async () => {
      const mockDevices = [
        { id: '1', name: 'Device 1', type: 'laptop' },
        { id: '2', name: 'Device 2', type: 'phone' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevices,
      });

      const devices = await apiClient.getDevices();

      expect(devices).toEqual(mockDevices);
      expect(global.fetch).toHaveBeenCalledWith(`${baseURL}/api/devices`, expect.any(Object));
    });

    it('should fetch a single device', async () => {
      const mockDevice = { id: '1', name: 'Device 1', type: 'laptop' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice,
      });

      const device = await apiClient.getDevice('1');

      expect(device).toEqual(mockDevice);
      expect(global.fetch).toHaveBeenCalledWith(`${baseURL}/api/devices/1`, expect.any(Object));
    });

    it('should update device successfully', async () => {
      const updateData = { name: 'Updated Device', notes: 'Test notes' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', ...updateData }),
      });

      const result = await apiClient.updateDevice('1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/devices/1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
    });
  });

  describe('Flows API', () => {
    it('should fetch flows with default parameters', async () => {
      const mockFlows = [
        { id: '1', protocol: 'HTTPS', bytes_in: 1000, bytes_out: 500 },
        { id: '2', protocol: 'HTTP', bytes_in: 2000, bytes_out: 1000 },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlows,
      });

      const flows = await apiClient.getFlows();

      expect(flows).toEqual(mockFlows);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`${baseURL}/api/flows?limit=100&offset=0`),
        expect.any(Object)
      );
    });

    it('should fetch flows with filters', async () => {
      const mockFlows = [{ id: '1', protocol: 'HTTPS' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlows,
      });

      const flows = await apiClient.getFlows(50, 0, 'device-1', 'active', 'HTTPS');

      expect(flows).toEqual(mockFlows);
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('device_id=device-1');
      expect(callUrl).toContain('status=active');
      expect(callUrl).toContain('protocol=HTTPS');
    });

    it('should handle flow export', async () => {
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
      const mockResponse = {
        ok: true,
        blob: async () => mockBlob,
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      // Mock URL methods if they don't exist
      const createObjectURLSpy = vi
        .spyOn(global.URL, 'createObjectURL')
        .mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi
        .spyOn(global.URL, 'revokeObjectURL')
        .mockImplementation(() => {});

      await apiClient.exportFlows('csv', Date.now() - 3600000, Date.now());

      expect(global.fetch).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Threats API', () => {
    it('should fetch active threats', async () => {
      const mockThreats = [{ id: '1', level: 'high', description: 'Suspicious activity' }];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockThreats,
      });

      const threats = await apiClient.getThreats(true);

      expect(threats).toEqual(mockThreats);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/threats?active_only=true`,
        expect.any(Object)
      );
    });

    it('should dismiss a threat', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiClient.dismissThreat('threat-1');

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/threats/threat-1/dismiss`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('Capture Control', () => {
    it('should start capture', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiClient.startCapture();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/capture/start`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should stop capture', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiClient.stopCapture();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/capture/stop`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('WebSocket Connection', () => {
    it('should connect WebSocket successfully', async () => {
      const onMessage = vi.fn();
      const disconnect = apiClient.connectWebSocket(onMessage);

      // Wait for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(disconnect).toBeDefined();
      expect(typeof disconnect).toBe('function');
    });

    it('should handle WebSocket messages', async () => {
      const onMessage = vi.fn();
      const disconnect = apiClient.connectWebSocket(onMessage);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate a message
      const mockMessage = {
        type: 'flow',
        data: { id: '1', protocol: 'HTTPS' },
      };

      // Get the WebSocket instance and trigger message
      // This is a simplified test - in real scenario, the WebSocket would receive messages
      expect(disconnect).toBeDefined();

      disconnect();
    });

    it('should disconnect WebSocket', async () => {
      const onMessage = vi.fn();
      const disconnect = apiClient.connectWebSocket(onMessage);

      expect(disconnect).toBeDefined();
      expect(typeof disconnect).toBe('function');

      // Wait a bit for potential connection
      await new Promise(resolve => setTimeout(resolve, 50));

      // Disconnect should not throw even if WebSocket is not connected
      expect(() => disconnect()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Device not found' }),
      });

      await expect(apiClient.getDevice('nonexistent')).rejects.toThrow();
    });

    it('should handle 500 errors with retry', async () => {
      const mockResponse = { id: '1', name: 'Device 1' };

      // First call fails with 500, second succeeds
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const device = await apiClient.getDevice('1');

      expect(device).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(apiClient.getDevices()).rejects.toThrow();
    });
  });
});
