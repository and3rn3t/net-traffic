/**
 * Unit tests for ErrorBoundary component
 * Tests error catching, recovery, and user interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Suppress console.error for error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
  vi.clearAllMocks();
});

describe('ErrorBoundary', () => {
  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText(/component error/i)).not.toBeInTheDocument();
    });

    it('should render custom fallback when provided', () => {
      const fallback = <div>Custom fallback</div>;
      render(
        <ErrorBoundary fallback={fallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    });
  });

  describe('Error Catching', () => {
    it('should catch errors and display error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component error/i)).toBeInTheDocument();
      // Error message appears in AlertDescription - use getAllByText since it might appear multiple times
      const errorMessages = screen.getAllByText(/test error message/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error message' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('should track error count', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // First error
      expect(screen.getByText(/component error/i)).toBeInTheDocument();

      // Reset and throw again
      const errorBoundary = screen.getByText(/try again/i).closest('button');
      if (errorBoundary) {
        fireEvent.click(errorBoundary);
      }

      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error count
      expect(screen.getByText(/this error has occurred/i)).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should reset error boundary when Try Again is clicked', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component error/i)).toBeInTheDocument();

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      // Wait for reset to complete
      await waitFor(
        () => {
          // After reset, should render children again
          expect(screen.queryByText(/component error/i)).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should reset when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component error/i)).toBeInTheDocument();

      // Change resetKeys
      rerender(
        <ErrorBoundary resetKeys={['key2']}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/component error/i)).not.toBeInTheDocument();
    });

    it('should reset when resetOnPropsChange is true and children change', () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange={true}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component error/i)).toBeInTheDocument();

      // Change children
      rerender(
        <ErrorBoundary resetOnPropsChange={true}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/component error/i)).not.toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('should reload page when Reload Page is clicked', () => {
      // Mock window.location.reload by replacing it
      const originalReload = window.location.reload;
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadSpy },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      fireEvent.click(reloadButton);

      expect(reloadSpy).toHaveBeenCalled();

      reloadSpy.mockRestore();
    });

    it('should navigate home when Go Home is clicked', () => {
      // Mock window.location.href
      const originalLocation = globalThis.location;
      delete (globalThis as any).location;
      (globalThis as any).location = { href: '' };

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const goHomeButton = screen.getByRole('button', { name: /go home/i });
      fireEvent.click(goHomeButton);

      expect(globalThis.location.href).toBe('/');

      // Restore
      globalThis.location = originalLocation;
    });

    it('should log error details when Log Details is clicked in development', () => {
      // Set development mode
      import.meta.env.DEV = true;

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const logButton = screen.getByRole('button', { name: /log details/i });
      fireEvent.click(logButton);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Development Mode', () => {
    it('should show component stack in development mode', () => {
      import.meta.env.DEV = true;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component stack/i)).toBeInTheDocument();
    });

    it('should show error stack in development mode', () => {
      import.meta.env.DEV = true;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/error stack/i)).toBeInTheDocument();
    });

    it('should not show debug info in production mode', () => {
      import.meta.env.DEV = false;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/component stack/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/error stack/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Tracking Integration', () => {
    it('should call error tracker if available', () => {
      const mockErrorTracker = {
        captureException: vi.fn(),
      };
      (window as any).errorTracker = mockErrorTracker;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(mockErrorTracker.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error message' }),
        expect.objectContaining({
          contexts: expect.objectContaining({
            react: expect.objectContaining({
              componentStack: expect.any(String),
            }),
          }),
        })
      );

      delete (window as any).errorTracker;
    });
  });
});
