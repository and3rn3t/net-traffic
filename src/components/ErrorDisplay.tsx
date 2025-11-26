/**
 * User-friendly error display component with recovery actions
 */
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Warning, ArrowClockwise, House } from '@phosphor-icons/react';
import { getErrorInfo, ErrorInfo } from '@/utils/errorMessages';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorDisplayProps {
  error: Error | string;
  context?: string;
  onDismiss?: () => void;
  showTechnicalDetails?: boolean;
}

export function ErrorDisplay({
  error,
  context,
  onDismiss,
  showTechnicalDetails = false,
}: ErrorDisplayProps) {
  const errorInfo: ErrorInfo = getErrorInfo(error, context);

  const getSeverityStyles = () => {
    switch (errorInfo.severity) {
      case 'error':
        return 'border-destructive/50 bg-destructive/10';
      case 'warning':
        return 'border-warning/50 bg-warning/10';
      case 'info':
        return 'border-primary/50 bg-primary/10';
    }
  };

  return (
    <Card className={`border ${getSeverityStyles()}`}>
      <CardContent className="p-4">
        <Alert variant={errorInfo.severity === 'error' ? 'destructive' : 'default'}>
          <Warning className="h-4 w-4" />
          <AlertTitle>{errorInfo.title}</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{errorInfo.description}</p>

            {showTechnicalDetails && errorInfo.technicalDetails && (
              <details className="mt-3">
                <summary className="text-xs cursor-pointer text-muted-foreground">
                  Technical Details
                </summary>
                <pre className="text-xs mt-2 p-2 bg-muted rounded border overflow-auto max-h-32 font-mono">
                  {errorInfo.technicalDetails}
                </pre>
              </details>
            )}

            {errorInfo.recoveryActions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {errorInfo.recoveryActions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'default'}
                    size="sm"
                    onClick={() => {
                      action.action();
                      onDismiss?.();
                    }}
                    className="gap-2"
                  >
                    {action.label === 'Retry' || action.label === 'Retry Connection' ? (
                      <ArrowClockwise size={14} />
                    ) : action.label === 'Go Home' ? (
                      <House size={14} />
                    ) : null}
                    {action.label}
                  </Button>
                ))}
                {onDismiss && (
                  <Button variant="ghost" size="sm" onClick={onDismiss}>
                    Dismiss
                  </Button>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
