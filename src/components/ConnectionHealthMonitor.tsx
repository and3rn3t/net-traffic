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
  Area,
  AreaChart,
} from 'recharts';
import {
  Heart,
  Activity,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Database,
  Network,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useReconnection } from '@/hooks/useReconnection';
import { toast } from 'sonner';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  timestamp: string;
  capture_running: boolean;
  active_flows: number;
  active_devices: number;
  latency?: number;
  services?: {
    storage: boolean;
    packet_capture: boolean;
    device_service: boolean;
    threat_service: boolean;
    analytics: boolean;
  };
  capture?: {
    running: boolean;
    interface: string;
    packets_captured: number;
    flows_detected: number;
  };
  database?: {
    active_flows: number;
    active_devices: number;
  };
  websocket?: {
    active_connections: number;
  };
}

interface ConnectionHistoryEntry {
  timestamp: number;
  status: 'healthy' | 'degraded' | 'offline';
  latency?: number;
  responseTime?: number;
  packetLoss?: number;
  services?: {
    storage: boolean;
    packet_capture: boolean;
    device_service: boolean;
    threat_service: boolean;
    analytics: boolean;
  };
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
  const [packetLoss, setPacketLoss] = useState<number>(0);
  const [previousLatency, setPreviousLatency] = useState<number | null>(null);

  // Automatic reconnection with exponential backoff
  const { isReconnecting, retryCount, nextRetryDelay, startReconnection, stopReconnection } =
    useReconnection({
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      onReconnect: () => {
        toast.success('Backend connection restored', {
          description: 'Successfully reconnected to the backend service',
        });
        checkHealth();
      },
      onMaxRetriesReached: () => {
        toast.error('Connection failed', {
          description: 'Unable to reconnect after multiple attempts. Please check your connection.',
        });
      },
    });

  // Track previous status for notifications
  const [previousStatus, setPreviousStatus] = useState<'healthy' | 'degraded' | 'offline' | null>(
    null
  );

  // Determine overall health status
  const overallStatus = useMemo(() => {
    if (!isConnected || error) return 'offline';
    if (!healthStatus) return 'offline';
    if (healthStatus.status === 'healthy' && latency && latency > 1000) return 'degraded';
    return healthStatus.status;
  }, [isConnected, error, healthStatus, latency]);

  // Health status change notifications
  useEffect(() => {
    if (previousStatus === null) {
      setPreviousStatus(overallStatus);
      return;
    }

    if (previousStatus !== overallStatus) {
      switch (overallStatus) {
        case 'healthy':
          if (previousStatus === 'offline' || previousStatus === 'degraded') {
            toast.success('Backend health restored', {
              description: 'All services are now operational',
            });
          }
          break;
        case 'degraded':
          toast.warning('Backend performance degraded', {
            description: `High latency detected (${latency}ms). Some features may be slower.`,
          });
          break;
        case 'offline':
          if (previousStatus === 'healthy' || previousStatus === 'degraded') {
            toast.error('Backend connection lost', {
              description: 'Attempting to reconnect automatically...',
            });
          }
          break;
      }
      setPreviousStatus(overallStatus);
    }
  }, [overallStatus, previousStatus, latency]);

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

      // Calculate packet loss (simplified: based on latency spikes)
      let calculatedPacketLoss = 0;
      if (previousLatency !== null && measuredLatency > previousLatency * 2) {
        // Significant latency increase might indicate packet loss
        calculatedPacketLoss = Math.min(
          5,
          ((measuredLatency - previousLatency) / previousLatency) * 100
        );
      }
      setPacketLoss(calculatedPacketLoss);
      setPreviousLatency(measuredLatency);

      setHealthStatus({
        status: 'healthy',
        timestamp: health.timestamp,
        capture_running: health.capture_running || false,
        active_flows: health.active_flows || 0,
        active_devices: health.active_devices || 0,
        latency: measuredLatency,
        services: health.services,
        capture: health.capture,
        database: health.database,
        websocket: health.websocket,
      });

      setLatency(measuredLatency);
      setLastCheckTime(new Date());

      // Stop reconnection attempts if we're connected
      if (isReconnecting) {
        stopReconnection();
      }

      // Add to history
      if (enableMetrics) {
        setConnectionHistory(prev => {
          const newEntry: ConnectionHistoryEntry = {
            timestamp: Date.now(),
            status: measuredLatency > 1000 ? 'degraded' : 'healthy',
            latency: measuredLatency,
            responseTime: responseTime,
            packetLoss: calculatedPacketLoss,
            services: health.services,
          };
          // Keep last 100 entries (about 50 minutes if checking every 30s)
          return [...prev.slice(-99), newEntry];
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setHealthStatus(null);
      setLatency(null);
      setLastCheckTime(new Date());
      setPacketLoss(0);

      // Start automatic reconnection if not already reconnecting
      if (!isReconnecting) {
        startReconnection(async () => {
          try {
            await apiClient.healthCheck();
            return true;
          } catch {
            return false;
          }
        });
      }

      // Add offline entry to history
      if (enableMetrics) {
        setConnectionHistory(prev => {
          const newEntry: ConnectionHistoryEntry = {
            timestamp: Date.now(),
            status: 'offline',
          };
          return [...prev.slice(-99), newEntry];
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, [enableMetrics, isReconnecting, startReconnection, stopReconnection]);

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
      packetLoss: entry.packetLoss || 0,
      status: entry.status === 'healthy' ? 1 : entry.status === 'degraded' ? 0.5 : 0,
    }));
  }, [connectionHistory]);

  // Calculate average latency
  const avgLatency = useMemo(() => {
    const latencies = connectionHistory
      .map(e => e.latency)
      .filter((l): l is number => l !== undefined && l > 0);
    if (latencies.length === 0) return 0;
    return Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length);
  }, [connectionHistory]);

  // Calculate average packet loss
  const avgPacketLoss = useMemo(() => {
    const losses = connectionHistory
      .map(e => e.packetLoss)
      .filter((l): l is number => l !== undefined);
    if (losses.length === 0) return 0;
    return Number((losses.reduce((sum, l) => sum + l, 0) / losses.length).toFixed(2));
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
            <CheckCircle2 size={14} className="mr-1" />
            Healthy
          </Badge>
        );
      case 'degraded':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/50">
            <AlertTriangle size={14} className="mr-1" />
            Degraded
          </Badge>
        );
      case 'offline':
        return (
          <Badge variant="destructive">
            <WifiOff size={14} className="mr-1" />
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
                <Activity size={20} className="text-success animate-pulse" />
              ) : overallStatus === 'degraded' ? (
                <Heart size={20} className="text-warning" />
              ) : (
                <WifiOff size={20} className="text-destructive" />
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
              <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {overallStatus === 'offline' && error && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span>{error}</span>
                  {isReconnecting && (
                    <p className="text-xs mt-1">
                      Reconnecting... (Attempt {retryCount + 1}, next retry in{' '}
                      {Math.round(nextRetryDelay / 1000)}s)
                    </p>
                  )}
                </div>
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
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connection is experiencing high latency. Response times may be slower than usual.
            </AlertDescription>
          </Alert>
        )}

        {/* Backend Health Dashboard */}
        {isConnected && healthStatus && healthStatus.services && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Service Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                <Database
                  size={18}
                  className={healthStatus.services.storage ? 'text-success' : 'text-destructive'}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Storage</p>
                  <p className="text-xs font-semibold">
                    {healthStatus.services.storage ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                <Network
                  size={18}
                  className={
                    healthStatus.services.packet_capture ? 'text-success' : 'text-destructive'
                  }
                />
                <div>
                  <p className="text-xs text-muted-foreground">Capture</p>
                  <p className="text-xs font-semibold">
                    {healthStatus.services.packet_capture ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                <Shield
                  size={18}
                  className={
                    healthStatus.services.threat_service ? 'text-success' : 'text-destructive'
                  }
                />
                <div>
                  <p className="text-xs text-muted-foreground">Threat</p>
                  <p className="text-xs font-semibold">
                    {healthStatus.services.threat_service ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                <TrendingUp
                  size={18}
                  className={healthStatus.services.analytics ? 'text-success' : 'text-destructive'}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Analytics</p>
                  <p className="text-xs font-semibold">
                    {healthStatus.services.analytics ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              {healthStatus.websocket && (
                <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                  <Activity
                    size={18}
                    className={
                      healthStatus.websocket.active_connections > 0
                        ? 'text-success'
                        : 'text-muted-foreground'
                    }
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">WebSocket</p>
                    <p className="text-xs font-semibold">
                      {healthStatus.websocket.active_connections} connections
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                  {avgLatency > 0 && ` (avg: ${avgLatency}ms)`}
                </p>
              </div>
            )}
            {enableMetrics && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Packet Loss</p>
                <p className="text-lg font-semibold">{packetLoss.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {packetLoss < 1
                    ? 'Excellent'
                    : packetLoss < 3
                      ? 'Good'
                      : packetLoss < 5
                        ? 'Fair'
                        : 'Poor'}
                  {avgPacketLoss > 0 && ` (avg: ${avgPacketLoss}%)`}
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
              {healthStatus.capture && (
                <p className="text-xs text-muted-foreground">
                  {healthStatus.capture.packets_captured.toLocaleString()} packets
                </p>
              )}
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
            <WifiOff size={48} className="mx-auto mb-2 opacity-50" />
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
                <span>Avg Latency: {avgLatency}ms</span>
                <span>{connectionHistory.length} checks</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  label={{ value: 'Packet Loss (%)', angle: 90, position: 'insideRight' }}
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
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(var(--primary))"
                  fill="url(#latencyGradient)"
                  strokeWidth={2}
                  name="Latency (ms)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="packetLoss"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1.5}
                  dot={false}
                  name="Packet Loss (%)"
                />
              </AreaChart>
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
