import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Activity,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Network,
  AlertTriangle,
  Circle,
  WifiOff,
  Database,
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { ThreatAlert } from '@/components/ThreatAlert';
import { ConnectionsTable } from '@/components/ConnectionsTable';
import { DevicesList } from '@/components/DevicesList';
import { DataExporter } from '@/components/DataExporter';
import { SearchBar } from '@/components/SearchBar';
import { TrafficChart } from '@/components/TrafficChart';
import { ProtocolBreakdown } from '@/components/ProtocolBreakdown';
import { TopUsers } from '@/components/TopUsers';
import { TopSites } from '@/components/TopSites';
import { GeographicDistribution } from '@/components/GeographicDistribution';
import { AlertRules } from '@/components/AlertRules';
// Lazy-loaded heavy components
import { HistoricalTrendsLazy, AnomalyDetectionLazy, LazyWrapper } from '@/components/lazy';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkQualityDashboard } from '@/components/NetworkQualityDashboard';
import { ApplicationUsageDashboard } from '@/components/ApplicationUsageDashboard';
import { MaintenancePanel } from '@/components/MaintenancePanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { AccountMenu } from '@/components/AccountMenu';
import { formatBytes, formatBytesShort } from '@/lib/formatters';
import { useDataSource } from '@/hooks/useDataSource';
import { API_CONFIG } from '@/hooks/useApiConfig';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

function App() {
  const {
    devices,
    flows,
    threats,
    analyticsData,
    protocolStats,
    isCapturing,
    isLoading,
    isConnected,
    error,
    isShowingStaleSnapshot,
    summaryStats,
    bandwidthTimeline,
    handleDismissThreat,
    handleToggleCapture,
    startCapture,
    refresh,
    USE_REAL_API,
    useRealApi,
  } = useDataSource();

  // Handle loading state (only when using real API)
  if (isLoading && API_CONFIG.USE_REAL_API) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Connecting to backend...</p>
        </div>
      </div>
    );
  }

  // Handle dismiss threat
  // Handle capture toggle
  const activeThreats = threats.filter(t => !t.dismissed);
  const activeFlows = flows.filter(f => f.status === 'active');

  // Use summary stats from API when available, otherwise calculate from flows
  const totalBytes =
    useRealApi && summaryStats
      ? summaryStats.total_bytes
      : flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);

  const totalFlows = useRealApi && summaryStats ? summaryStats.total_flows : flows.length;

  const activeFlowsCount =
    useRealApi && summaryStats ? summaryStats.active_flows : activeFlows.length;

  const totalDevices = useRealApi && summaryStats ? summaryStats.total_devices : devices.length;

  const activeDevicesCount =
    useRealApi && summaryStats
      ? summaryStats.active_devices
      : devices.filter(d => Date.now() - d.lastSeen < 5 * 60 * 1000).length;

  const avgThreatScore = devices.reduce((sum, d) => sum + d.threatScore, 0) / (devices.length || 1);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header
        className="border-b border-border/60 bg-card/40 backdrop-blur-sm shadow-sm"
        role="banner"
      >
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                NetInsight
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground/90 font-medium">
                Deep Network Traffic Analysis
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="hidden md:block">
                <SearchBar
                  onResultClick={(type, id) => {
                    if (type === 'device') {
                      // Could navigate to device details or scroll to device
                      toast.info(`Device selected: ${id}`);
                    } else if (type === 'flow') {
                      toast.info(`Flow selected: ${id}`);
                    } else if (type === 'threat') {
                      toast.info(`Threat selected: ${id}`);
                    }
                  }}
                />
              </div>
              {/* Theme Toggle */}
              <ThemeToggle />
              {/* Account / Sign In */}
              <AccountMenu />
              {/* Keyboard Shortcuts */}
              <KeyboardShortcuts />
              {/* Connection Status Indicator */}
              {USE_REAL_API && (
                <Badge
                  variant={isConnected ? 'default' : 'destructive'}
                  className="flex items-center gap-1.5"
                >
                  {isConnected ? (
                    <>
                      <Circle size={8} fill="currentColor" className="animate-pulse" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff size={12} />
                      Disconnected
                    </>
                  )}
                </Badge>
              )}
              {/* Shown while the dashboard is painted from a cached snapshot,
                  before the first fresh fetch on this load has landed */}
              {USE_REAL_API && isShowingStaleSnapshot && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1.5 text-muted-foreground"
                >
                  <Database size={12} />
                  Cached data
                </Badge>
              )}
              {/* Capture Control Button */}
              <Button
                variant={isCapturing ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleCapture}
                disabled={USE_REAL_API && !isConnected}
              >
                <Activity size={16} className={isCapturing ? 'animate-pulse' : ''} />
                {isCapturing ? 'Capturing' : 'Paused'}
              </Button>
            </div>
          </div>
          {/* Offline Indicator */}
          <OfflineIndicator />

          {/* Error Banner */}
          {error && USE_REAL_API && (
            <div className="mt-3">
              <ErrorDisplay error={error} context="Failed to connect to backend" />
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6" role="main">
        <Tabs defaultValue="dashboard" className="space-y-6" aria-label="Main navigation tabs">
          <TabsList className="bg-card/60 border border-border/60 overflow-x-auto flex-nowrap shadow-sm">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity size={16} />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2">
              <Smartphone size={16} />
              Devices
            </TabsTrigger>
            <TabsTrigger value="threats" className="gap-2">
              <AlertTriangle size={16} />
              Threats
              {activeThreats.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                  {activeThreats.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp size={16} />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Database size={16} />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

            {activeThreats.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="text-destructive" size={20} />
                  Active Threats
                </h2>
                <div className="space-y-2">
                  {activeThreats.slice(0, 3).map(threat => (
                    <ThreatAlert key={threat.id} threat={threat} onDismiss={handleDismissThreat} />
                  ))}
                </div>
              </div>
            )}

            <ErrorBoundary>
              <TrafficChart data={analyticsData} useApi={USE_REAL_API && isConnected} hours={24} />
            </ErrorBoundary>

            <ErrorBoundary>
              <ConnectionsTable
                flows={flows}
                devices={devices}
                useApiFilters={USE_REAL_API && isConnected}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="devices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DevicesList
                devices={devices}
                onDeviceUpdate={_updatedDevice => {
                  if (USE_REAL_API) refresh();
                }}
                onRefresh={() => {
                  if (USE_REAL_API) refresh();
                }}
              />
              {USE_REAL_API && devices.length === 0 && isConnected && (
                <Card className="p-6 border-dashed">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">No devices discovered yet</p>
                    <p className="text-xs text-muted-foreground">
                      Devices will appear as network traffic is captured. Make sure packet capture
                      is running.
                    </p>
                    {!isCapturing && (
                      <Button size="sm" onClick={startCapture} className="mt-2">
                        Start Capture
                      </Button>
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopUsers devices={devices} flows={flows} hours={24} limit={10} sortBy="bytes" />
              <ProtocolBreakdown data={protocolStats} />
            </div>
          </TabsContent>

          <TabsContent value="threats" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Threat Detection</h2>
                <p className="text-sm text-muted-foreground">
                  {activeThreats.length} active threats detected
                </p>
              </div>
              {threats.filter(t => t.dismissed).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // This would need to be handled through API if needed
                    toast.info('Dismissed threats will be cleared automatically');
                  }}
                >
                  Clear dismissed ({threats.filter(t => t.dismissed).length})
                </Button>
              )}
            </div>

            {activeThreats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck size={64} className="text-success mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear</h3>
                <p className="text-muted-foreground">No active threats detected on your network</p>
              </div>
            ) : (
              <div className="space-y-2">
                {threats.map(
                  threat =>
                    !threat.dismissed && (
                      <ThreatAlert
                        key={threat.id}
                        threat={threat}
                        onDismiss={handleDismissThreat}
                      />
                    )
                )}
              </div>
            )}

            <ErrorBoundary>
              <LazyWrapper>
                <AnomalyDetectionLazy
                  flows={flows}
                  devices={devices}
                  threats={threats}
                  useApi={USE_REAL_API && isConnected}
                />
              </LazyWrapper>
            </ErrorBoundary>

            <AlertRules />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="space-y-6">
              <NetworkQualityDashboard hours={24} />
              <ApplicationUsageDashboard hours={24} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopSites flows={flows} hours={24} limit={10} />
              <GeographicDistribution flows={flows} hours={24} />
            </div>

            <ErrorBoundary>
              <LazyWrapper>
                <HistoricalTrendsLazy data={analyticsData} useApi={USE_REAL_API && isConnected} />
              </LazyWrapper>
            </ErrorBoundary>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Peak Traffic Hour"
                value={
                  useRealApi && bandwidthTimeline.length > 0
                    ? new Date(
                        bandwidthTimeline.reduce((max, item) =>
                          item.bytes_in + item.bytes_out > max.bytes_in + max.bytes_out ? item : max
                        ).timestamp
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '18:00'
                }
                subtitle={
                  useRealApi && bandwidthTimeline.length > 0
                    ? formatBytes(
                        Math.max(...bandwidthTimeline.map(item => item.bytes_in + item.bytes_out))
                      )
                    : formatBytes(Math.max(...analyticsData.map(d => d.totalBytes)))
                }
              />
              <MetricCard
                title="Average Throughput"
                value={
                  useRealApi && summaryStats
                    ? formatBytesShort(
                        summaryStats.total_bytes / (summaryStats.capture_duration_hours || 24)
                      )
                    : formatBytesShort(totalBytes / 24)
                }
                subtitle="Per hour"
              />
              <MetricCard
                title="Total Threats"
                value={threats.length}
                subtitle={`${activeThreats.length} unresolved`}
              />
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <MaintenancePanel />
            <DataExporter flows={flows} devices={devices} threats={threats} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
