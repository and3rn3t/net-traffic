/**
 * Enhanced TopUsers component using API endpoints
 * Falls back to calculating from devices/flows if API unavailable
 */
import { useMemo } from 'react';
import { Device, NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { Smartphone, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { TIME } from '@/lib/constants';

interface TopUsersEnhancedProps {
  devices?: Device[]; // Fallback data
  flows?: NetworkFlow[]; // Fallback data
  hours?: number;
  limit?: number;
  sortBy?: 'bytes' | 'connections' | 'threats';
}

export function TopUsersEnhanced({
  devices = [],
  flows = [],
  hours = 24,
  limit = 10,
  sortBy = 'bytes',
}: TopUsersEnhancedProps) {
  const { topDevices, isLoading, error, fetchTopDevices } = useEnhancedAnalytics({
    autoFetch: true,
    hours,
  });
  const { useRealApi } = useApiConfig();

  // Fallback: calculate from devices/flows (memoized)
  const fallbackTopUsers = useMemo(() => {
    const fallbackDeviceStats = devices.map(device => {
      const deviceFlows = flows.filter(f => f.deviceId === device.id);
      const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
      const totalConnections = deviceFlows.length;
      const recentActivity = deviceFlows.filter(f => Date.now() - f.timestamp < TIME.HOUR).length;

      return {
        device_id: device.id,
        device_name: device.name,
        device_ip: device.ip,
        device_type: device.type,
        bytes: totalBytes,
        connections: totalConnections,
        threats: 0,
        recentActivity,
      };
    });

    fallbackDeviceStats.sort((a, b) => b.bytes - a.bytes);
    return fallbackDeviceStats.slice(0, limit);
  }, [devices, flows, limit]);

  // Use API data if available, otherwise use fallback
  const users = useRealApi && topDevices.length > 0 ? topDevices : fallbackTopUsers;
  const maxBytes = users.length > 0 ? Math.max(...users.map(u => u.bytes)) : 0;

  const getTrendIcon = (user: (typeof users)[0]) => {
    // For API data, we don't have recentActivity, so we'll use connections as proxy
    // Type guard to check for recentActivity property
    const userWithActivity = user as typeof user & { recentActivity?: number };
    const recentActivity: number = userWithActivity.recentActivity ?? user.connections;
    if (recentActivity > 10) return <TrendingUp className="text-success" size={16} />;
    if (recentActivity < 3) return <TrendingDown className="text-muted-foreground" size={16} />;
    return <Minus className="text-muted-foreground" size={16} />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone size={20} />
              Top Users by Traffic
            </CardTitle>
            <CardDescription>Devices ranked by total data consumption</CardDescription>
          </div>
          {useRealApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchTopDevices(limit, hours, sortBy)}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && useRealApi && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}. Falling back to local data.
          </div>
        )}
        <div className="space-y-4">
          {users.map((user, index) => (
            <div key={user.device_id} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{user.device_name}</p>
                      {getTrendIcon(user)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{user.device_ip}</span>
                      <span>•</span>
                      <span>{user.connections} connections</span>
                      {user.threats > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-destructive">{user.threats} threats</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatBytesShort(user.bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytesShort(user.bytes / (user.connections || 1))}/conn
                  </p>
                </div>
              </div>
              <Progress
                value={maxBytes > 0 ? (user.bytes / maxBytes) * 100 : 0}
                className="h-1.5"
              />
            </div>
          ))}
          {users.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">No user data available</div>
          )}
          {isLoading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}
        </div>
      </CardContent>
    </Card>
  );
}
