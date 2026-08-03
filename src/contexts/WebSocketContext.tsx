import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { apiClient } from '@/lib/api';

interface WebSocketContextType {
  /** Subscribe to a specific WS message type (dispatched by ApiClient's shared connection). Returns an unsubscribe function. */
  subscribe: (eventType: string, callback: (data: unknown) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { readonly children: ReactNode }) {
  const subscribe = useCallback((eventType: string, callback: (data: unknown) => void) => {
    return apiClient.on(eventType, callback);
  }, []);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Declaratively subscribe to a WS message type for the lifetime of the
 * calling component - replaces reaching into `apiClient.on(...)` directly.
 * The callback doesn't need to be memoized: the latest version is always
 * used, but the subscription itself is only re-created if `eventType` changes.
 */
export function useWebSocketSubscription(
  eventType: string,
  callback: (data: unknown) => void
): void {
  const { subscribe } = useWebSocket();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return subscribe(eventType, data => callbackRef.current(data));
  }, [subscribe, eventType]);
}
