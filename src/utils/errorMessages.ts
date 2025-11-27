/**
 * User-friendly error messages with recovery actions
 * Provides consistent error handling across the application
 */

export interface ErrorRecoveryAction {
  label: string;
  action: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
}

export interface ErrorInfo {
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  recoveryActions: ErrorRecoveryAction[];
  technicalDetails?: string;
}

export function getErrorInfo(error: Error | string, context?: string): ErrorInfo {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Network/Connection errors - More specific messages
  if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
    return {
      title: 'Connection Timeout',
      description:
        'The backend service did not respond in time. This could mean the service is overloaded or unreachable. Please check your network connection and try again.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry Connection',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
        {
          label: 'Check Backend Status',
          action: () => {
            // Could open a status page or documentation
            console.log('Open backend status check');
          },
          variant: 'outline',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  if (
    errorMessage.includes('unavailable') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('ERR_CONNECTION_REFUSED') ||
    errorMessage.includes('ERR_NETWORK_CHANGED')
  ) {
    return {
      title: 'Backend Unavailable',
      description:
        'Unable to connect to the backend service. Please verify:\n• The backend service is running\n• The API URL is correct in your environment settings\n• Your network connection is active\n• Firewall settings allow the connection',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry Connection',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
        {
          label: 'Check Configuration',
          action: () => {
            // Could open settings or show configuration help
            console.log('Open configuration help');
          },
          variant: 'outline',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // WebSocket connection errors
  if (
    errorMessage.includes('WebSocket') ||
    errorMessage.includes('ws://') ||
    errorMessage.includes('wss://')
  ) {
    return {
      title: 'WebSocket Connection Failed',
      description:
        'Unable to establish real-time connection. The application will continue to work with polling updates instead.',
      severity: 'warning',
      recoveryActions: [
        {
          label: 'Retry Connection',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Authentication/Authorization errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return {
      title: 'Authentication Required',
      description: 'Your session has expired or you are not authorized to access this resource.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Reload Page',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Server errors - More specific
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return {
      title: 'Server Error',
      description:
        'The backend service encountered an internal error. This is usually temporary. Please try again in a moment. If the problem persists, the backend may need to be restarted.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
        {
          label: 'Report Issue',
          action: () => {
            // Could open issue tracker or support
            console.log('Report issue');
          },
          variant: 'outline',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Service unavailable
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return {
      title: 'Service Unavailable',
      description:
        'The backend service is temporarily unavailable. It may be starting up, undergoing maintenance, or overloaded. Please try again in a few moments.',
      severity: 'warning',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Bad gateway
  if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
    return {
      title: 'Bad Gateway',
      description:
        'The backend service received an invalid response from an upstream server. This usually indicates a configuration issue with the backend.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => globalThis.location.reload(),
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Rate limiting
  if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
    return {
      title: 'Too Many Requests',
      description: 'You have made too many requests. Please wait a moment before trying again.',
      severity: 'warning',
      recoveryActions: [
        {
          label: 'Wait and Retry',
          action: () => {
            setTimeout(() => globalThis.location.reload(), 5000);
          },
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Not found errors
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return {
      title: 'Resource Not Found',
      description: 'The requested resource could not be found. It may have been removed or moved.',
      severity: 'warning',
      recoveryActions: [
        {
          label: 'Go Home',
          action: () => {
            globalThis.location.href = '/';
          },
          variant: 'default',
        },
        {
          label: 'Go Back',
          action: () => {
            globalThis.history.back();
          },
          variant: 'outline',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Generic error
  return {
    title: 'An Error Occurred',
    description:
      context ||
      'Something went wrong. The application is still running, but this feature may not work correctly.',
    severity: 'error',
    recoveryActions: [
      {
        label: 'Try Again',
        action: () => globalThis.location.reload(),
        variant: 'default',
      },
      {
        label: 'Reload Page',
        action: () => globalThis.location.reload(),
        variant: 'outline',
      },
    ],
    technicalDetails: errorMessage,
  };
}
