/**
 * Enhanced Error Boundary component for component isolation
 * Provides better error handling with recovery options
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to error tracking service (if available)
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (
        resetKeys &&
        prevProps.resetKeys &&
        resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
      ) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorCount } = this.state;
      const isDevelopment = import.meta.env.DEV;

      return (
        <Card className="m-4 border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Component Error
            </CardTitle>
            <CardDescription>
              An error occurred in this component. The application is still running.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Details</AlertTitle>
              <AlertDescription>
                <p className="font-mono text-sm mt-2">{error?.message || 'Unknown error'}</p>
                {errorCount > 1 && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    This error has occurred {errorCount} time(s)
                  </p>
                )}
              </AlertDescription>
            </Alert>

            {isDevelopment && errorInfo && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Component Stack:</h4>
                <pre className="text-xs bg-muted p-3 rounded border overflow-auto max-h-48 font-mono">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}

            {isDevelopment && error?.stack && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Error Stack:</h4>
                <pre className="text-xs bg-muted p-3 rounded border overflow-auto max-h-48 font-mono">
                  {error.stack}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={this.resetErrorBoundary} variant="default" className="gap-2">
                <RefreshCw size={16} />
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="gap-2">
                <RefreshCw size={16} />
                Reload Page
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                <Home size={16} />
                Go Home
              </Button>
              {isDevelopment && (
                <Button
                  onClick={() => {
                    console.error('Error details:', error, errorInfo);
                  }}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <Bug size={16} />
                  Log Details
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
