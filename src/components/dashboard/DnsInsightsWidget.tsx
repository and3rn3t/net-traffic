/**
 * DNS insights widget: query volume, failure-rate badge, top queried
 * domains mini-table, and unusual TLD flags.
 */
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDnsInsights } from '@/hooks/useDnsInsights';
import { cn } from '@/lib/utils';

function failureRateStyles(rate: number): string {
  if (rate >= 10) return 'bg-destructive/10 text-destructive';
  if (rate >= 2) return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
}

export function DnsInsightsWidget() {
  const { totalQueries, failureCount, failureRate, topDomains, unusualTlds, isLoading } =
    useDnsInsights();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (totalQueries === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No DNS activity observed
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{totalQueries.toLocaleString()}</span>{' '}
          queries
        </div>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium',
            failureRateStyles(failureRate)
          )}
        >
          {failureRate.toFixed(1)}% failed ({failureCount})
        </span>
      </div>

      {unusualTlds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Unusual TLDs:</span>
          {unusualTlds.slice(0, 5).map(entry => (
            <Badge key={entry.tld} variant="outline" className="text-xs">
              .{entry.tld} ({entry.count})
            </Badge>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {topDomains.slice(0, 8).map(entry => (
          <div key={entry.domain} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate" title={entry.domain}>
              {entry.domain}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {entry.query_count.toLocaleString()}
              {entry.failure_count > 0 && (
                <span className="ml-1 text-destructive">({entry.failure_count} failed)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
