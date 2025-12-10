import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NetworkFlow } from '@/lib/types';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface HeatmapTimelineProps {
  readonly flows: NetworkFlow[];
  readonly hours?: number;
  readonly useApi?: boolean;
}

interface HeatmapCell {
  hour: number;
  day: number;
  intensity: number;
  count: number;
}

export function HeatmapTimeline({ flows, hours = 24, useApi = false }: HeatmapTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { useRealApi } = useApiConfig();
  const { bandwidthTimeline, isLoading, error, fetchBandwidthTimeline } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours,
  });

  // Prepare heatmap data from API or flows
  const heatmapData = useMemo(() => {
    const data: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({ hour, day, intensity: 0, count: 0 });
      }
    }

    // Use API data if available
    if (useRealApi && useApi && bandwidthTimeline.length > 0) {
      bandwidthTimeline.forEach(item => {
        const date = new Date(item.timestamp);
        const day = date.getDay();
        const hour = date.getHours();
        const cell = data.find(c => c.day === day && c.hour === hour);
        if (cell) {
          cell.intensity += item.bytes_in + item.bytes_out;
          cell.count += item.connections;
        }
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        const date = new Date(flow.timestamp);
        const day = date.getDay();
        const hour = date.getHours();
        const cell = data.find(c => c.day === day && c.hour === hour);
        if (cell) {
          cell.intensity += flow.bytesIn + flow.bytesOut;
          cell.count++;
        }
      });
    }

    return data;
  }, [flows, useRealApi, useApi, bandwidthTimeline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = 24;
    const cellWidth = (rect.width - 60) / hours;
    const cellHeight = (rect.height - 40) / 7;
    const marginLeft = 40;
    const marginTop = 20;

    const maxIntensity = Math.max(...heatmapData.map(c => c.intensity), 1);

    ctx.clearRect(0, 0, rect.width, rect.height);

    heatmapData.forEach(cell => {
      const x = marginLeft + cell.hour * cellWidth;
      const y = marginTop + cell.day * cellHeight;
      const normalizedIntensity = cell.intensity / maxIntensity;

      const hue = 200 - normalizedIntensity * 80;
      const lightness = 0.35 + normalizedIntensity * 0.3;
      const chroma = 0.15 * (normalizedIntensity + 0.3);

      ctx.fillStyle = `oklch(${lightness} ${chroma} ${hue})`;
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

      if (cell.count > 0 && cellWidth > 20) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.count.toString(), x + cellWidth / 2, y + cellHeight / 2);
      }
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    days.forEach((day, i) => {
      ctx.fillText(day, marginLeft - 8, marginTop + i * cellHeight + cellHeight / 2);
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let hour = 0; hour < hours; hour += 3) {
      ctx.fillText(
        `${hour.toString().padStart(2, '0')}:00`,
        marginLeft + hour * cellWidth + cellWidth / 2,
        marginTop + 7 * cellHeight + 8
      );
    }
  }, [heatmapData]);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-accent" size={20} />
            Activity Heatmap
          </CardTitle>
          <p className="text-sm text-muted-foreground">Network activity patterns by day and hour</p>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px] sm:h-[240px] lg:h-[300px] w-full" />
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
              <Clock className="text-accent" size={20} />
              Activity Heatmap
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Network activity patterns by day and hour
            </p>
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
      <CardContent>
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 'clamp(180px, 30vh, 240px)' }}
        />
        <div className="mt-4 flex items-center justify-center gap-3 text-xs">
          <span className="text-muted-foreground">Low</span>
          <div className="flex gap-1">
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((intensity, i) => (
              <div
                key={i}
                className="w-6 h-4 rounded"
                style={{
                  background: `oklch(${0.35 + intensity * 0.3} ${0.15 * (intensity + 0.3)} ${200 - intensity * 80})`,
                }}
              />
            ))}
          </div>
          <span className="text-muted-foreground">High</span>
        </div>
      </CardContent>
    </Card>
  );
}
