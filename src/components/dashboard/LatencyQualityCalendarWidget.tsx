/**
 * Latency quality calendar widget: RTT heatmap by day-of-week x hour-of-day,
 * averaged over the last N days. Reuses the shared HeatmapGrid primitive
 * (see DevicePresenceWidget for the other consumer).
 */
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HeatmapGrid, type HeatmapRow } from '@/components/dashboard/HeatmapGrid';
import { useLatencyQualityCalendar } from '@/hooks/useLatencyQualityCalendar';

const NO_DATA_VALUE = -1;

function getCellColor(value: number): string {
  if (value < 0) return 'bg-muted';
  if (value <= 50) return 'bg-success';
  if (value <= 100) return 'bg-primary';
  if (value <= 200) return 'bg-warning';
  return 'bg-destructive';
}

export function LatencyQualityCalendarWidget() {
  const { dayLabels, cells, isLoading } = useLatencyQualityCalendar();

  const rows: HeatmapRow[] = useMemo(
    () =>
      cells.map((hourCells, dayIndex) => ({
        label: dayLabels[dayIndex] ?? `Day ${dayIndex}`,
        cells: hourCells.map((cell, hourIndex) => ({
          value: cell.avg_rtt ?? NO_DATA_VALUE,
          title:
            cell.count > 0
              ? `${dayLabels[dayIndex]} ${hourIndex}:00 - avg RTT ${cell.avg_rtt}ms, jitter ${cell.avg_jitter}ms (${cell.count} flows)`
              : `${dayLabels[dayIndex]} ${hourIndex}:00 - no data`,
        })),
      })),
    [cells, dayLabels]
  );

  const columnLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    for (let hour = 0; hour < 24; hour += 6) {
      labels[hour] = `${hour}h`;
    }
    return labels;
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  const hasData = rows.some(row => row.cells.some(cell => cell.value !== NO_DATA_VALUE));
  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No latency data observed
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-1">
      <HeatmapGrid rows={rows} columnLabels={columnLabels} getCellColor={getCellColor} />
    </div>
  );
}
