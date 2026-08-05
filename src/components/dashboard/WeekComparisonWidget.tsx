/**
 * This week vs last week widget: overlays two 168h bandwidth series and
 * surfaces the total-bytes delta as a callout badge.
 */
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytesShort } from '@/lib/formatters';
import { useWeekComparison } from '@/hooks/useWeekComparison';
import { cn } from '@/lib/utils';

function formatHoursAgo(hoursAgo: number): string {
  const days = Math.floor(hoursAgo / 24);
  const hours = hoursAgo % 24;
  if (days === 0) return `${hours}h ago`;
  return `${days}d ${hours}h ago`;
}

export function WeekComparisonWidget() {
  const { points, thisWeekTotalBytes, lastWeekTotalBytes, deltaPercent, isLoading } =
    useWeekComparison();

  const chartData = useMemo(
    () =>
      points.map(p => ({
        label: formatHoursAgo(p.hoursAgo),
        'This week': p.thisWeekBytes,
        'Last week': p.lastWeekBytes,
      })),
    [points]
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  const hasData = thisWeekTotalBytes > 0 || lastWeekTotalBytes > 0;

  return (
    <div className="flex h-full flex-col gap-2 p-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          This week: <span className="font-medium">{formatBytesShort(thisWeekTotalBytes)}</span>
          {' · '}
          Last week: <span className="font-medium">{formatBytesShort(lastWeekTotalBytes)}</span>
        </div>
        {deltaPercent !== null && (
          <div
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
              deltaPercent > 0.5 && 'bg-destructive/10 text-destructive',
              deltaPercent < -0.5 && 'bg-success/10 text-success',
              Math.abs(deltaPercent) <= 0.5 && 'bg-muted text-muted-foreground'
            )}
          >
            {deltaPercent > 0.5 ? (
              <TrendingUp className="h-3 w-3" />
            ) : deltaPercent < -0.5 ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(deltaPercent).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {!hasData ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tickFormatter={value => formatBytesShort(value)}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                width={50}
              />
              <Tooltip formatter={(value: number) => formatBytesShort(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="This week"
                stroke="hsl(var(--primary))"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Last week"
                stroke="hsl(var(--muted-foreground))"
                dot={false}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
