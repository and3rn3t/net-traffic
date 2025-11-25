import { useMemo } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarBlank } from '@phosphor-icons/react';

interface UserActivityTimelineProps {
  flows: NetworkFlow[];
}

export function UserActivityTimeline({ flows }: UserActivityTimelineProps) {
  const heatmapData = useMemo(() => {
    const hourCounts = Array(24)
      .fill(0)
      .map(() => Array(7).fill(0));

    flows.forEach(flow => {
      const date = new Date(flow.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      hourCounts[hour][day]++;
    });

    const maxCount = Math.max(...hourCounts.flat());

    return { hourCounts, maxCount };
  }, [flows]);

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
  const hours = Array.from({ length: 24 }, (_, i) => i);

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
        <div className="space-y-2">
          <div className="grid grid-cols-8 gap-1 text-xs">
            <div></div>
            {days.map(day => (
              <div key={day} className="text-center text-muted-foreground font-medium">
                {day}
              </div>
            ))}
          </div>

          {hours.map(hour => (
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
