/**
 * Summary statistics card using the enhanced API
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/MetricCard';
import { formatBytesShort } from '@/lib/formatters';
import { Activity, RefreshCw, ShieldCheck, AlertTriangle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';

export function SummaryStatsCard() {
  const { summaryStats, isLoading, error, fetchSummaryStats } = useEnhancedAnalytics({
    autoFetch: true,
  });
  const { useRealApi } = useApiConfig();

  if (!useRealApi || !summaryStats) {
    return null; // Only show when API is available
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              Network Overview
            </CardTitle>
            <CardDescription>Real-time network statistics and health metrics</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSummaryStats()}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">{error}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Devices"
            value={summaryStats.total_devices.toString()}
            subtitle={`${summaryStats.active_devices} active`}
            icon={<Smartphone size={20} />}
          />
          <MetricCard
            title="Network Flows"
            value={summaryStats.total_flows.toString()}
            subtitle={`${summaryStats.active_flows} active`}
            icon={<Activity size={20} />}
          />
          <MetricCard
            title="Total Traffic"
            value={formatBytesShort(summaryStats.total_bytes)}
            subtitle={`${summaryStats.capture_duration_hours.toFixed(1)}h captured`}
            icon={<Activity size={20} />}
          />
          <MetricCard
            title="Security Status"
            value={summaryStats.active_threats.toString()}
            subtitle={`${summaryStats.critical_threats} critical`}
            icon={
              summaryStats.critical_threats > 0 ? (
                <AlertTriangle size={20} className="text-destructive" />
              ) : (
                <ShieldCheck size={20} className="text-success" />
              )
            }
          />
        </div>
        {isLoading && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Updating statistics...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
