import { useMemo } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarBlank, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface UserActivityTimelineProps {
  readonly flows: NetworkFlow[];
  readonly hours?: number;
  readonly useApi?: boolean;
}

export function UserActivityTimeline({
  flows,
  hours = 24,
  useApi = false,
}: UserActivityTimelineProps) {
  const { useRealApi } = useApiConfig();
  const { bandwidthTimeline, isLoading, error, fetchBandwidthTimeline } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours,
  });

  const heatmapData = useMemo(() => {
    const hourCounts = Array(24)
      .fill(0)
      .map(() => Array(7).fill(0));

    // Use API data if available
    if (useRealApi && useApi && bandwidthTimeline.length > 0) {
      bandwidthTimeline.forEach(item => {
        const date = new Date(item.timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        hourCounts[hour][day] += item.connections;
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        const date = new Date(flow.timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        hourCounts[hour][day]++;
      });
    }

    const maxCount = Math.max(...hourCounts.flat());

    return { hourCounts, maxCount };
  }, [flows, useRealApi, useApi, bandwidthTimeline]);

  const getIntensity = (count: number) => {
    const { maxCount } = heatmapData;
    const intensity = maxCount > 0 ? count / maxCount : 0;

    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 0.25) return 'bg-primary/20';
    if (intensity < 0.5) return 'bg-primary/40';
    if (intensity < 0.75) return 'bg-primary/60';
    return 'bg-primary/80';
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarBlank size={20} />
            Activity Heatmap
          </CardTitle>
          <CardDescription>Network activity by hour and day of week</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
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
              <CalendarBlank size={20} />
              Activity Heatmap
            </CardTitle>
            <CardDescription>Network activity by hour and day of week</CardDescription>
          </div>
          {useRealApi && useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchBandwidthTimeline(hours, 60)}
              disabled={isLoading}
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
        {error && useRealApi && useApi && (
          <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
            {error}. Using calculated data from flows.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-8 gap-1 text-xs">
            <div></div>
            {days.map(day => (
              <div key={day} className="text-center text-muted-foreground font-medium">
                {day}
              </div>
            ))}
          </div>

          {hourLabels.map(hour => (
            <div key={hour} className="grid grid-cols-8 gap-1">
              <div className="text-xs text-muted-foreground text-right pr-2 flex items-center justify-end">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {days.map((_, dayIndex) => {
                const count = heatmapData.hourCounts[hour][dayIndex];
                return (
                  <div
                    key={dayIndex}
                    className={`h-6 rounded ${getIntensity(count)} border border-border/30 transition-colors hover:ring-2 hover:ring-ring cursor-pointer`}
                    title={`${days[dayIndex]} ${hour}:00 - ${count} connections`}
                  />
                );
              })}
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded bg-muted/30 border border-border/30" />
                <div className="w-4 h-4 rounded bg-primary/20 border border-border/30" />
                <div className="w-4 h-4 rounded bg-primary/40 border border-border/30" />
                <div className="w-4 h-4 rounded bg-primary/60 border border-border/30" />
                <div className="w-4 h-4 rounded bg-primary/80 border border-border/30" />
              </div>
              <span>More</span>
            </div>
            <span>{heatmapData.maxCount} max connections/hour</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
