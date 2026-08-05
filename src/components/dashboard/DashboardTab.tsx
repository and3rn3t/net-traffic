import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  LayoutGrid,
  Network,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MetricCard } from '@/components/MetricCard';
import { ThreatAlert } from '@/components/ThreatAlert';
import { TrafficChart } from '@/components/TrafficChart';
import { ConnectionsTable } from '@/components/ConnectionsTable';
import { ActivityTicker } from '@/components/dashboard/ActivityTicker';
import { TopTalkersWidget } from '@/components/dashboard/TopTalkersWidget';
import { ThroughputGaugeWidget } from '@/components/dashboard/ThroughputGaugeWidget';
import { NetworkHealthScoreWidget } from '@/components/dashboard/NetworkHealthScoreWidget';
import { WeekComparisonWidget } from '@/components/dashboard/WeekComparisonWidget';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { WidgetShell } from '@/components/dashboard/WidgetShell';
import { AddWidgetDialog } from '@/components/dashboard/AddWidgetDialog';
import { getWidgetDefinition } from '@/components/dashboard/widgetRegistry';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { formatBytesShort } from '@/lib/formatters';
import type { AnalyticsData, Device, NetworkFlow, Threat } from '@/lib/types';

interface DashboardTabProps {
  activeFlowsCount: number;
  totalFlows: number;
  useRealApi: boolean;
  summaryStats: { capture_duration_hours: number } | null;
  totalBytes: number;
  totalDevices: number;
  activeDevicesCount: number;
  avgThreatScore: number;
  activeThreats: Threat[];
  onDismissThreat: (id: string) => void;
  analyticsData: AnalyticsData[];
  USE_REAL_API: boolean;
  isConnected: boolean;
  flows: NetworkFlow[];
  devices: Device[];
}

export function DashboardTab({
  activeFlowsCount,
  totalFlows,
  useRealApi,
  summaryStats,
  totalBytes,
  totalDevices,
  activeDevicesCount,
  avgThreatScore,
  activeThreats,
  onDismissThreat,
  analyticsData,
  USE_REAL_API,
  isConnected,
  flows,
  devices,
}: DashboardTabProps) {
  const [editMode, setEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { widgetIds, layout, onLayoutChange, addWidget, removeWidget, resetToDefault } =
    useDashboardLayout();

  const renderWidget = (id: string) => {
    switch (id) {
      case 'metrics':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 h-full">
            <MetricCard
              title="Active Connections"
              value={activeFlowsCount.toString()}
              subtitle={`${totalFlows} total`}
              icon={<Network size={24} />}
              trend="up"
              trendValue={
                useRealApi
                  ? summaryStats
                    ? `${summaryStats.capture_duration_hours.toFixed(1)}h captured`
                    : undefined
                  : `${Math.floor(Math.random() * 20)}% from last hour`
              }
            />
            <MetricCard
              title="Network Throughput"
              value={formatBytesShort(totalBytes)}
              subtitle={
                useRealApi && summaryStats
                  ? `${summaryStats.capture_duration_hours.toFixed(1)}h captured`
                  : 'Last 24 hours'
              }
              icon={<Activity size={24} />}
              trend="up"
              trendValue={
                useRealApi
                  ? summaryStats
                    ? `${formatBytesShort(totalBytes / Math.max(summaryStats.capture_duration_hours, 1))}/hr`
                    : undefined
                  : `${Math.floor(Math.random() * 30)}% increase`
              }
            />
            <MetricCard
              title="Active Devices"
              value={totalDevices.toString()}
              subtitle={`${activeDevicesCount} online now`}
              icon={<Smartphone size={24} />}
              trend="neutral"
            />
            <MetricCard
              title="Threat Score"
              value={`${avgThreatScore.toFixed(0)}%`}
              subtitle={
                activeThreats.length > 0
                  ? `${activeThreats.length} active threats`
                  : 'Network secure'
              }
              icon={<ShieldCheck size={24} />}
              trend={avgThreatScore > 50 ? 'up' : 'down'}
              trendValue={avgThreatScore > 50 ? 'High risk' : 'Low risk'}
              className={avgThreatScore > 50 ? 'border-destructive/30' : ''}
            />
          </div>
        );
      case 'traffic-chart':
        return (
          <ErrorBoundary>
            <TrafficChart data={analyticsData} useApi={USE_REAL_API && isConnected} hours={24} />
          </ErrorBoundary>
        );
      case 'connections-table':
        return (
          <ErrorBoundary>
            <ConnectionsTable
              flows={flows}
              devices={devices}
              useApiFilters={USE_REAL_API && isConnected}
            />
          </ErrorBoundary>
        );
      case 'activity-ticker':
        return (
          <ErrorBoundary>
            <ActivityTicker />
          </ErrorBoundary>
        );
      case 'top-talkers':
        return (
          <ErrorBoundary>
            <TopTalkersWidget />
          </ErrorBoundary>
        );
      case 'throughput-gauge':
        return (
          <ErrorBoundary>
            <ThroughputGaugeWidget />
          </ErrorBoundary>
        );
      case 'health-score':
        return (
          <ErrorBoundary>
            <NetworkHealthScoreWidget activeThreats={activeThreats} devices={devices} />
          </ErrorBoundary>
        );
      case 'week-comparison':
        return (
          <ErrorBoundary>
            <WeekComparisonWidget />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {editMode && (
          <>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus size={14} />
              Add widget
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault}>
              <RotateCcw size={14} />
              Reset layout
            </Button>
          </>
        )}
        <Button
          variant={editMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode(current => !current)}
        >
          <LayoutGrid size={14} />
          {editMode ? 'Done editing' : 'Edit dashboard'}
        </Button>
      </div>

      {activeThreats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="text-destructive" size={20} />
            Active Threats
          </h2>
          <div className="space-y-2">
            {activeThreats.slice(0, 3).map(threat => (
              <ThreatAlert key={threat.id} threat={threat} onDismiss={onDismissThreat} />
            ))}
          </div>
        </div>
      )}

      <DashboardGrid layout={layout} editMode={editMode} onLayoutChange={onLayoutChange}>
        {widgetIds.map(id => {
          const def = getWidgetDefinition(id);
          if (!def) return null;
          return (
            <div key={id}>
              <WidgetShell title={def.title} editMode={editMode} onRemove={() => removeWidget(id)}>
                {renderWidget(id)}
              </WidgetShell>
            </div>
          );
        })}
      </DashboardGrid>

      <AddWidgetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        activeWidgetIds={widgetIds}
        onAddWidget={addWidget}
      />
    </div>
  );
}
