import { useMemo, memo } from 'react';
import { NetworkFlow, Device } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface PeakUsageAnalysisProps {
  readonly flows: NetworkFlow[];
  readonly devices: Device[];
  readonly hours?: number;
  readonly useApi?: boolean;
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PeakUsageAnalysis = memo(function PeakUsageAnalysis({
  flows,
  devices,
  hours = 24,
  useApi = false,
}: PeakUsageAnalysisProps) {
  const { useRealApi } = useApiConfig();
  const { bandwidthTimeline, isLoading, error, fetchBandwidthTimeline } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours,
  });

  const analysis = useMemo(() => {
    const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      hourLabel: `${i.toString().padStart(2, '0')}:00`,
      bytes: 0,
      connections: 0,
    }));

    const dailyUsage = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      dayLabel: daysOfWeek[i],
      bytes: 0,
      connections: 0,
    }));

    // Use API data if available
    if (useRealApi && useApi && bandwidthTimeline.length > 0) {
      bandwidthTimeline.forEach(item => {
        const date = new Date(item.timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        const bytes = item.bytes_in + item.bytes_out;

        hourlyUsage[hour].bytes += bytes;
        hourlyUsage[hour].connections += item.connections;

        dailyUsage[day].bytes += bytes;
        dailyUsage[day].connections += item.connections;
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        const date = new Date(flow.timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        const bytes = flow.bytesIn + flow.bytesOut;

        hourlyUsage[hour].bytes += bytes;
        hourlyUsage[hour].connections++;

        dailyUsage[day].bytes += bytes;
        dailyUsage[day].connections++;
      });
    }

    const peakHour = hourlyUsage.reduce((max, curr) => (curr.bytes > max.bytes ? curr : max));
    const peakDay = dailyUsage.reduce((max, curr) => (curr.bytes > max.bytes ? curr : max));

    const devicePeakHours = devices
      .map(device => {
        const deviceFlows = flows.filter(f => f.deviceId === device.id);
        const deviceHourly = Array(24).fill(0);

        deviceFlows.forEach(flow => {
          const hour = new Date(flow.timestamp).getHours();
          deviceHourly[hour] += flow.bytesIn + flow.bytesOut;
        });

        const maxHour = deviceHourly.indexOf(Math.max(...deviceHourly));
        return {
          device: device.name,
          peakHour: maxHour,
          peakBytes: deviceHourly[maxHour],
        };
      })
      .sort((a, b) => b.peakBytes - a.peakBytes);

    const offPeakHours = hourlyUsage.filter(h => h.bytes < peakHour.bytes * 0.3);
    const avgOffPeakBytes =
      offPeakHours.reduce((sum, h) => sum + h.bytes, 0) / (offPeakHours.length || 1);

    return {
      hourlyUsage,
      dailyUsage,
      peakHour,
      peakDay,
      devicePeakHours: devicePeakHours.slice(0, 5),
      offPeakHours: offPeakHours.length,
      avgOffPeakBytes,
      peakToOffPeakRatio:
        avgOffPeakBytes > 0 ? (peakHour.bytes / avgOffPeakBytes).toFixed(1) : 'N/A',
    };
  }, [flows, devices, useRealApi, useApi, bandwidthTimeline]);

  const maxHourlyBytes = Math.max(...analysis.hourlyUsage.map(h => h.bytes));

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Peak Usage Analysis
          </CardTitle>
          <CardDescription>
            Identify peak usage times and patterns across the network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[500px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              Peak Usage Analysis
            </CardTitle>
            <CardDescription>
              Identify peak usage times and patterns across the network
            </CardDescription>
          </div>
          {useRealApi && useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchBandwidthTimeline(hours, 60)}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
        {error && useRealApi && useApi && (
          <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
            {error}. Using calculated data from flows.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak Hour</p>
            <p className="text-2xl font-bold">{analysis.peakHour.hourLabel}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytesShort(analysis.peakHour.bytes)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak Day</p>
            <p className="text-lg font-bold">{analysis.peakDay.dayLabel}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytesShort(analysis.peakDay.bytes)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Off-Peak Hours</p>
            <p className="text-2xl font-bold">{analysis.offPeakHours}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytesShort(analysis.avgOffPeakBytes)} avg
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak/Off-Peak Ratio</p>
            <p className="text-2xl font-bold">{analysis.peakToOffPeakRatio}x</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Hourly Traffic Distribution</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.hourlyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hourLabel"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                interval={2}
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
                formatter={(value: any, name: string) => [formatBytesShort(value), 'Traffic']}
              />
              <Bar dataKey="bytes" radius={[4, 4, 0, 0]}>
                {analysis.hourlyUsage.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.bytes === maxHourlyBytes
                        ? 'hsl(var(--primary))'
                        : entry.bytes > maxHourlyBytes * 0.7
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--secondary))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Device Peak Hours</h4>
          {analysis.devicePeakHours.map((item, index) => (
            <div
              key={item.device}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.device}</p>
                  <p className="text-xs text-muted-foreground">
                    Peak at {item.peakHour.toString().padStart(2, '0')}:00
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{formatBytesShort(item.peakBytes)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Weekly Pattern</h4>
          <div className="grid grid-cols-7 gap-2">
            {analysis.dailyUsage.map(day => {
              const isPeak = day.day === analysis.peakDay.day;
              const maxDaily = Math.max(...analysis.dailyUsage.map(d => d.bytes));
              const intensity = (day.bytes / maxDaily) * 100;

              return (
                <div
                  key={day.day}
                  className={`text-center p-3 rounded-lg border ${isPeak ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                >
                  <p className="text-xs font-medium mb-1">{day.dayLabel.slice(0, 3)}</p>
                  <div
                    className={`h-16 rounded flex items-end justify-center mb-2 ${isPeak ? 'bg-primary/20' : 'bg-muted'}`}
                  >
                    <div
                      className={`w-full ${isPeak ? 'bg-primary' : 'bg-accent'} rounded-t`}
                      style={{ height: `${Math.max(intensity, 10)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{formatBytesShort(day.bytes)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
