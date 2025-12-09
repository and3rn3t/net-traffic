import { Card } from '@/components/ui/card';
import { AnalyticsData } from '@/lib/types';
import { formatBytes } from '@/lib/formatters';
import { useMemo } from 'react';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface TrafficChartProps {
  data: AnalyticsData[];
  useApi?: boolean;
  hours?: number;
}

export function TrafficChart({ data, useApi = false, hours = 24 }: TrafficChartProps) {
  const { bandwidthTimeline, isLoading } = useEnhancedAnalytics({
    autoFetch: useApi,
    hours,
  });
  const { useRealApi } = useApiConfig();

  // Use API bandwidth timeline if available, otherwise use provided data
  const chartData = useMemo(() => {
    if (useRealApi && useApi && bandwidthTimeline.length > 0) {
      // Convert bandwidth timeline to chart format
      return bandwidthTimeline.map(item => ({
        timestamp: item.timestamp,
        totalBytes: item.bytes_in + item.bytes_out,
        totalConnections: item.connections,
        activeDevices: 0, // Not available in bandwidth timeline
        threatCount: 0, // Not available in bandwidth timeline
      }));
    }
    return data;
  }, [useRealApi, useApi, bandwidthTimeline, data]);

  const maxBytes = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map(d => d.totalBytes));
  }, [chartData]);

  const displayData = useMemo(() => {
    return chartData.map(d => ({
      ...d,
      height: maxBytes > 0 ? (d.totalBytes / maxBytes) * 100 : 0,
    }));
  }, [chartData, maxBytes]);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card className="p-4 border border-border/50">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Traffic Over Time</h3>
            <p className="text-sm text-muted-foreground">Last {hours} hours</p>
          </div>
          <Skeleton className="h-[200px] w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Traffic Over Time</h3>
          <p className="text-sm text-muted-foreground">Last {hours} hours</p>
        </div>

        <div className="h-[200px] flex items-end gap-1 px-2">
          {displayData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            displayData.map((d, idx) => (
              <div key={idx} className="flex-1 group relative">
                <div
                  className="w-full bg-gradient-to-t from-accent/80 to-accent/40 rounded-t hover:from-accent hover:to-accent/60 transition-all cursor-pointer"
                  style={{ height: `${d.height}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                      <p className="font-medium">{formatBytes(d.totalBytes)}</p>
                      <p className="text-muted-foreground">{d.totalConnections} connections</p>
                      <p className="text-muted-foreground">{d.activeDevices} devices</p>
                      {d.threatCount > 0 && (
                        <p className="text-destructive">{d.threatCount} threats</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>24h ago</span>
          <span>Now</span>
        </div>
      </div>
    </Card>
  );
}
