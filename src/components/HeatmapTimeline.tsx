import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from '@phosphor-icons/react';
import { NetworkFlow } from '@/lib/types';

interface HeatmapTimelineProps {
  flows: NetworkFlow[];
}

interface HeatmapCell {
  hour: number;
  day: number;
  intensity: number;
  count: number;
}

export function HeatmapTimeline({ flows }: HeatmapTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const heatmapData: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < hours; hour++) {
        heatmapData.push({ hour, day, intensity: 0, count: 0 });
      }
    }

    flows.forEach(flow => {
      const date = new Date(flow.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      const cell = heatmapData.find(c => c.day === day && c.hour === hour);
      if (cell) {
        cell.intensity += flow.bytesIn + flow.bytesOut;
        cell.count++;
      }
    });

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
  }, [flows]);

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
        <canvas ref={canvasRef} className="w-full" style={{ height: '240px' }} />
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
