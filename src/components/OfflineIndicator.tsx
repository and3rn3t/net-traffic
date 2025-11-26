/**
 * Offline mode indicator component
 * Shows when the application is offline and provides cached data info
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { WifiSlash, Database, Clock } from '@phosphor-icons/react';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { formatDistanceToNow } from 'date-fns';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean; // Show indicator even when online (for testing)
}

export function OfflineIndicator({ showWhenOnline = false }: OfflineIndicatorProps) {
  const { isOnline, lastOnlineTime } = useOfflineDetection({
    onOnline: () => {
      console.log('Connection restored');
    },
    onOffline: () => {
      console.log('Connection lost');
    },
  });

  if (isOnline && !showWhenOnline) {
    return null;
  }

  return (
    <Alert variant={isOnline ? 'default' : 'destructive'} className="m-4">
      <WifiSlash className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Badge variant="outline" className="bg-success/20 text-success border-success/50">
                  Online
                </Badge>
                <span className="text-sm">
                  {lastOnlineTime &&
                    `Last connected ${formatDistanceToNow(lastOnlineTime, { addSuffix: true })}`}
                </span>
              </>
            ) : (
              <>
                <Badge variant="destructive">Offline</Badge>
                <span className="text-sm">
                  You are currently offline. Some features may be unavailable.
                </span>
              </>
            )}
          </div>
          {!isOnline && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Database size={14} />
                <span>Using cached data</span>
              </div>
              {lastOnlineTime && (
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Last sync: {formatDistanceToNow(lastOnlineTime, { addSuffix: true })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
