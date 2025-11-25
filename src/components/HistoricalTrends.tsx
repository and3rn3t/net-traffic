import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsData } from '@/lib/types';
import { formatBytesShort } from '@/lib/formatters';
import { TrendUp, Clock } from '@phosphor-icons/react';
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

interface HistoricalTrendsProps {
  data: AnalyticsData[];
}

type TimeRange = '24h' | '7d' | '30d';

export function HistoricalTrends({ data }: HistoricalTrendsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const chartData = useMemo(() => {
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
          <Tabs value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
            <TabsList className="grid grid-cols-3 w-[200px]">
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Traffic</p>
            <p className="text-2xl font-bold">{formatBytesShort(stats.totalBytes)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Connections</p>
            <p className="text-2xl font-bold">{stats.totalConnections.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak Traffic</p>
            <p className="text-2xl font-bold">{formatBytesShort(stats.peakTraffic)}</p>
            <p className="text-xs text-muted-foreground">{stats.peakHour}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Avg Devices</p>
            <p className="text-2xl font-bold">{stats.avgDevices}</p>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
