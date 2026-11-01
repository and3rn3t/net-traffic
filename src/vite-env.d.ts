/// <reference types="vite/client" />

interface Window {
  /** Optional external error tracker (e.g. Sentry-style); ErrorBoundary reports to it when present. */
  errorTracker?: {
    captureException(error: Error, context?: Record<string, unknown>): void;
  };
}
