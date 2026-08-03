/**
 * WebSocket connection management: connect/reconnect with exponential
 * backoff, keep-alive ping, and a pub-sub layer (`on()`) for type-specific
 * subscribers on top of the single shared connection.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private wsListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private wsPingInterval: NodeJS.Timeout | null = null;

  constructor(private readonly baseURL: string) {}

  // WebSocket connection for real-time updates with improved resilience
  connectWebSocket(onMessage: (data: unknown) => void): () => void {
    // Clear any existing reconnect timeout
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    // If already connected, return disconnect function
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return () => this.disconnectWebSocket();
    }

    // Convert http/https to ws/wss for WebSocket
    let wsUrl: string;
    if (this.baseURL.startsWith('https://')) {
      wsUrl = this.baseURL.replace(/^https/, 'wss') + '/ws';
    } else {
      wsUrl = this.baseURL.replace(/^http/, 'ws') + '/ws';
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.wsReconnectAttempts = 0;

        // Clear any existing ping interval
        if (this.wsPingInterval) {
          clearInterval(this.wsPingInterval);
        }

        // Send ping to keep connection alive
        this.wsPingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send('ping');
            } catch (error) {
              console.error('Failed to send WebSocket ping:', error);
            }
          } else {
            if (this.wsPingInterval) {
              clearInterval(this.wsPingInterval);
              this.wsPingInterval = null;
            }
          }
        }, 30000); // Ping every 30 seconds
      };

      this.ws.onmessage = event => {
        try {
          // Ignore pong responses
          if (event.data === 'pong') {
            return;
          }

          const data = JSON.parse(event.data);
          onMessage(data);

          // Dispatch to any type-specific subscribers registered via on()
          if (data && typeof data === 'object' && typeof data.type === 'string') {
            const listeners = this.wsListeners.get(data.type);
            if (listeners) {
              for (const listener of listeners) {
                listener(data);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = error => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = event => {
        console.log(
          `WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`
        );

        // Clear ping interval
        if (this.wsPingInterval) {
          clearInterval(this.wsPingInterval);
          this.wsPingInterval = null;
        }

        // Attempt to reconnect with exponential backoff
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, max 60s
          const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts - 1), 60000);

          console.log(
            `Scheduling WebSocket reconnect in ${delay / 1000}s... (attempt ${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`
          );

          this.wsReconnectTimeout = setTimeout(() => {
            // Only reconnect if not already connected
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
              console.log(
                `Attempting WebSocket reconnect (${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`
              );
              this.connectWebSocket(onMessage);
            }
          }, delay);
        } else {
          console.error(
            `Max WebSocket reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
          );
          // Reset attempts after a longer delay to allow future manual retries
          setTimeout(() => {
            this.wsReconnectAttempts = 0;
          }, 300000); // Reset after 5 minutes
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }

    return () => this.disconnectWebSocket();
  }

  disconnectWebSocket(): void {
    // Clear reconnect timeout
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    // Clear ping interval
    if (this.wsPingInterval) {
      clearInterval(this.wsPingInterval);
      this.wsPingInterval = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reset reconnect attempts
    this.wsReconnectAttempts = 0;
  }

  // Subscribe to specific event types
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, new Set());
    }

    this.wsListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.wsListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
}
