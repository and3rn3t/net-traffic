/**
 * Device presence heatmap widget: online/offline grid by device x hour
 * over the last 7 days (oldest hour first, most recent hour last).
 */
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HeatmapGrid, type HeatmapRow } from '@/components/dashboard/HeatmapGrid';
import { useDevicePresence } from '@/hooks/useDevicePresence';

function getCellColor(value: number): string {
  return value > 0 ? 'bg-primary' : 'bg-muted';
}

export function DevicePresenceWidget() {
  const { hours, devices, isLoading } = useDevicePresence();

  const rows: HeatmapRow[] = useMemo(
    () =>
      devices.map(device => ({
        label: device.device_name,
        cells: device.presence.map((value, index) => ({
          value,
          title: `${device.device_name}: ${value > 0 ? 'active' : 'no activity'} (${hours - 1 - index}h ago)`,
        })),
      })),
    [devices, hours]
  );

  // Label the start of each day (every 24 hours), most recent on the right.
  const columnLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    const days = Math.floor(hours / 24);
    for (let day = 0; day < days; day++) {
      const daysAgo = days - 1 - day;
      labels[day * 24] = daysAgo === 0 ? 'today' : `-${daysAgo}d`;
    }
    return labels;
  }, [hours]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No device activity observed
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-1">
      <HeatmapGrid rows={rows} columnLabels={columnLabels} getCellColor={getCellColor} />
    </div>
  );
}
