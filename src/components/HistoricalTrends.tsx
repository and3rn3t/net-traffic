import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AnalyticsData } from '@/lib/types';
import { formatBytesShort } from '@/lib/formatters';
import { TrendingUp, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useHistoricalTrends } from '@/hooks/useHistoricalTrends';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

type TimeRange = '1h' | '24h' | '7d' | '30d';

interface HistoricalTrendsProps {
  data?: AnalyticsData[]; // Optional fallback data (for mock mode)
  useApi?: boolean; // Whether to use API or fallback data
}

export function HistoricalTrends({
  data: fallbackData = [],
  useApi = true,
}: HistoricalTrendsProps) {
  const {
    timeRange,
    data: apiData,
    isLoading,
    error,
    updateTimeRange,
    refresh,
  } = useHistoricalTrends({
    initialTimeRange: '24h',
    autoFetch: useApi,
  });

  // Use API data if available, otherwise fall back to prop data
  const data = useApi && apiData.length > 0 ? apiData : fallbackData;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(item => ({
      time: new Date(item.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      bytes: item.totalBytes,
      connections: item.totalConnections,
      threats: item.threatCount,
      devices: item.activeDevices,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalBytes: 0,
        totalConnections: 0,
        totalThreats: 0,
        avgDevices: 0,
        peakTraffic: 0,
        peakHour: 'N/A',
      };
    }

    const totalBytes = data.reduce((sum, d) => sum + d.totalBytes, 0);
    const totalConnections = data.reduce((sum, d) => sum + d.totalConnections, 0);
    const totalThreats = data.reduce((sum, d) => sum + d.threatCount, 0);
    const avgDevices = data.reduce((sum, d) => sum + d.activeDevices, 0) / data.length;

    const peakTraffic = Math.max(...data.map(d => d.totalBytes));
    const peakHour = data.find(d => d.totalBytes === peakTraffic);

    return {
      totalBytes,
      totalConnections,
      totalThreats,
      avgDevices: Math.round(avgDevices),
      peakTraffic,
      peakHour: peakHour
        ? new Date(peakHour.timestamp).toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
          })
        : 'N/A',
    };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} />
              Historical Trends
            </CardTitle>
            <CardDescription>Network activity patterns over time</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={timeRange} onValueChange={v => updateTimeRange(v as TimeRange)}>
              <TabsList className="grid grid-cols-4 w-[280px]">
                <TabsTrigger value="1h">1h</TabsTrigger>
                <TabsTrigger value="24h">24h</TabsTrigger>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
              </TabsList>
            </Tabs>
            {useApi && (
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && useApi && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="ghost" size="sm" onClick={refresh} className="ml-2 h-auto py-1">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && useApi && data.length === 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[150px] w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Traffic</p>
                <p className="text-2xl font-bold">{formatBytesShort(stats.totalBytes)}</p>
                {isLoading && <p className="text-xs text-muted-foreground">Updating...</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Connections</p>
                <p className="text-2xl font-bold">{stats.totalConnections.toLocaleString()}</p>
                {isLoading && <p className="text-xs text-muted-foreground">Updating...</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Peak Traffic</p>
                <p className="text-2xl font-bold">{formatBytesShort(stats.peakTraffic)}</p>
                <p className="text-xs text-muted-foreground">{stats.peakHour}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Avg Devices</p>
                <p className="text-2xl font-bold">{stats.avgDevices}</p>
                {isLoading && <p className="text-xs text-muted-foreground">Updating...</p>}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No historical data available for this time range</p>
                {useApi && (
                  <p className="text-xs mt-2">Data will appear as network activity is captured</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Traffic Volume</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBytes" x1="0" y1="0" x2="0" y2="1">
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
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickFormatter={value => formatBytesShort(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [formatBytesShort(value), 'Traffic']}
                      />
                      <Area
                        type="monotone"
                        dataKey="bytes"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorBytes)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Connections & Threats</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="connections"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        dot={false}
                        name="Connections"
                      />
                      <Line
                        type="monotone"
                        dataKey="threats"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={false}
                        name="Threats"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Active Devices</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="devices" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
