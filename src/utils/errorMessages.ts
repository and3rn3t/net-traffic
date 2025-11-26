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
  const errorObj = typeof error === 'string' ? null : error;

  // Network/Connection errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('unavailable') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError')
  ) {
    return {
      title: 'Connection Problem',
      description:
        'Unable to connect to the backend service. Please check your network connection and ensure the backend is running.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry Connection',
          action: () => window.location.reload(),
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

  // Authentication/Authorization errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return {
      title: 'Authentication Required',
      description: 'Your session has expired or you are not authorized to access this resource.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Reload Page',
          action: () => window.location.reload(),
          variant: 'default',
        },
      ],
      technicalDetails: errorMessage,
    };
  }

  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return {
      title: 'Server Error',
      description:
        'The backend service encountered an error. This is usually temporary. Please try again in a moment.',
      severity: 'error',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
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
            setTimeout(() => window.location.reload(), 5000);
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
            window.location.href = '/';
          },
          variant: 'default',
        },
        {
          label: 'Go Back',
          action: () => {
            window.history.back();
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
        action: () => window.location.reload(),
        variant: 'default',
      },
      {
        label: 'Reload Page',
        action: () => window.location.reload(),
        variant: 'outline',
      },
    ],
    technicalDetails: errorMessage,
  };
}
