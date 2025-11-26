import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Heart,
  Heartbeat,
  WifiSlash,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  AlertCircle,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { apiClient } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  timestamp: string;
  capture_running: boolean;
  active_flows: number;
  active_devices: number;
  latency?: number;
}

interface ConnectionHistoryEntry {
  timestamp: number;
  status: 'healthy' | 'degraded' | 'offline';
  latency?: number;
  responseTime?: number;
}

interface ConnectionHealthMonitorProps {
  isConnected: boolean;
  error: string | null;
  onRetry?: () => void;
  enableMetrics?: boolean; // Enable latency/performance tracking
}

export function ConnectionHealthMonitor({
  isConnected,
  error,
  onRetry,
  enableMetrics = true,
}: ConnectionHealthMonitorProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  // Determine overall health status
  const overallStatus = useMemo(() => {
    if (!isConnected || error) return 'offline';
    if (!healthStatus) return 'offline';
    if (healthStatus.status === 'healthy' && latency && latency > 1000) return 'degraded';
    return healthStatus.status;
  }, [isConnected, error, healthStatus, latency]);

  // Check backend health with latency measurement
  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const startTime = performance.now();

    try {
      const health = await apiClient.healthCheck();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Calculate latency (round trip time)
      const measuredLatency = Math.round(responseTime);

      setHealthStatus({
        status: 'healthy',
        timestamp: health.timestamp,
        capture_running: health.capture_running || false,
        active_flows: health.active_flows || 0,
        active_devices: health.active_devices || 0,
        latency: measuredLatency,
      });

      setLatency(measuredLatency);
      setLastCheckTime(new Date());

      // Add to history
      if (enableMetrics) {
        setConnectionHistory(prev => {
          const newEntry: ConnectionHistoryEntry = {
            timestamp: Date.now(),
            status: measuredLatency > 1000 ? 'degraded' : 'healthy',
            latency: measuredLatency,
            responseTime: responseTime,
          };
          // Keep last 50 entries (about 25 minutes if checking every 30s)
          return [...prev.slice(-49), newEntry];
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setHealthStatus(null);
      setLatency(null);
      setLastCheckTime(new Date());

      // Add offline entry to history
      if (enableMetrics) {
        setConnectionHistory(prev => {
          const newEntry: ConnectionHistoryEntry = {
            timestamp: Date.now(),
            status: 'offline',
          };
          return [...prev.slice(-49), newEntry];
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, [enableMetrics]);

  // Initial health check and periodic checks
  useEffect(() => {
    if (!isConnected) {
      setHealthStatus(null);
      return;
    }

    // Initial check
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(() => {
      if (isConnected) {
        checkHealth();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, checkHealth]);

  // Prepare chart data from history
  const chartData = useMemo(() => {
    return connectionHistory.map(entry => ({
      time: new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      latency: entry.latency || 0,
      status: entry.status === 'healthy' ? 1 : entry.status === 'degraded' ? 0.5 : 0,
    }));
  }, [connectionHistory]);

  // Calculate uptime percentage
  const uptimePercentage = useMemo(() => {
    if (connectionHistory.length === 0) return 100;

    const healthyCount = connectionHistory.filter(entry => entry.status === 'healthy').length;
    return Math.round((healthyCount / connectionHistory.length) * 100);
  }, [connectionHistory]);

  // Get status badge
  const getStatusBadge = () => {
    switch (overallStatus) {
      case 'healthy':
        return (
          <Badge className="bg-success/20 text-success border-success/50">
            <CheckCircle size={14} className="mr-1" />
            Healthy
          </Badge>
        );
      case 'degraded':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/50">
            <AlertCircle size={14} className="mr-1" />
            Degraded
          </Badge>
        );
      case 'offline':
        return (
          <Badge variant="destructive">
            <WifiSlash size={14} className="mr-1" />
            Offline
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {overallStatus === 'healthy' ? (
                <Heartbeat size={20} className="text-success animate-pulse" />
              ) : overallStatus === 'degraded' ? (
                <Heart size={20} className="text-warning" />
              ) : (
                <WifiSlash size={20} className="text-destructive" />
              )}
              Connection Health
            </CardTitle>
            <CardDescription>Backend service status and performance metrics</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="outline"
              size="sm"
              onClick={checkHealth}
              disabled={isChecking || !isConnected}
              className="gap-2"
            >
              <ArrowClockwise size={16} className={isChecking ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {overallStatus === 'offline' && error && (
          <Alert variant="destructive">
            <WifiSlash className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>{error}</span>
                {onRetry && (
                  <Button variant="ghost" size="sm" onClick={onRetry} className="ml-2">
                    Retry Connection
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {overallStatus === 'degraded' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connection is experiencing high latency. Response times may be slower than usual.
            </AlertDescription>
          </Alert>
        )}

        {/* Health Metrics */}
        {isConnected && healthStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-lg font-semibold capitalize">{healthStatus.status}</p>
              {lastCheckTime && (
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(lastCheckTime, { addSuffix: true })}
                </p>
              )}
            </div>
            {enableMetrics && latency !== null && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Latency</p>
                <p className="text-lg font-semibold">{latency}ms</p>
                <p className="text-xs text-muted-foreground">
                  {latency < 100
                    ? 'Excellent'
                    : latency < 500
                      ? 'Good'
                      : latency < 1000
                        ? 'Fair'
                        : 'Poor'}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Capture Status</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {healthStatus.capture_running ? (
                  <>
                    <Activity size={16} className="text-success animate-pulse" />
                    Running
                  </>
                ) : (
                  <>
                    <Clock size={16} className="text-muted-foreground" />
                    Stopped
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Active Resources</p>
              <p className="text-lg font-semibold">{healthStatus.active_flows} flows</p>
              <p className="text-xs text-muted-foreground">{healthStatus.active_devices} devices</p>
            </div>
          </div>
        ) : isChecking ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <WifiSlash size={48} className="mx-auto mb-2 opacity-50" />
            <p>Backend unavailable</p>
            <p className="text-xs mt-1">Cannot connect to health check endpoint</p>
          </div>
        )}

        {/* Connection History Graph */}
        {enableMetrics && connectionHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Connection History</h4>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Uptime: {uptimePercentage}%</span>
                <span>{connectionHistory.length} checks</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Latency (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Uptime Progress */}
        {enableMetrics && connectionHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Service Uptime</span>
              <span className="font-semibold">{uptimePercentage}%</span>
            </div>
            <Progress
              value={uptimePercentage}
              className={
                uptimePercentage >= 99
                  ? 'h-2'
                  : uptimePercentage >= 95
                    ? 'h-2'
                    : 'h-2 bg-destructive/20'
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
