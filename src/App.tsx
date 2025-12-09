import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Pulse,
  ShieldCheck,
  DeviceMobile,
  TrendUp,
  Graph,
  Warning,
  Eye,
  ChartLineUp,
  Sparkle,
  Circle,
  WifiSlash,
  Database,
} from '@phosphor-icons/react';
import { MetricCard } from '@/components/MetricCard';
import { ThreatAlert } from '@/components/ThreatAlert';
import { ConnectionsTableEnhanced } from '@/components/ConnectionsTableEnhanced';
import { DevicesListEnhanced } from '@/components/DevicesListEnhanced';
import { DataExporterEnhanced } from '@/components/DataExporterEnhanced';
import { SearchBar } from '@/components/SearchBar';
import { TrafficChart } from '@/components/TrafficChart';
import { ProtocolBreakdown } from '@/components/ProtocolBreakdown';
import { PacketBurst } from '@/components/PacketBurst';
import { BandwidthGauge } from '@/components/BandwidthGauge';
import { TopUsersEnhanced } from '@/components/TopUsersEnhanced';
import { TopSitesEnhanced } from '@/components/TopSitesEnhanced';
import { GeographicDistributionEnhanced } from '@/components/GeographicDistributionEnhanced';
import { SummaryStatsCard } from '@/components/SummaryStatsCard';
import { InsightsSummary } from '@/components/InsightsSummary';
import { ConnectionQuality } from '@/components/ConnectionQuality';
import { ConnectionHealthMonitor } from '@/components/ConnectionHealthMonitor';
// Lazy-loaded heavy components
import {
  NetworkGraphLazy,
  GeographicMapLazy,
  FlowPipeVisualizationLazy,
  HeatmapTimelineLazy,
  ProtocolSankeyLazy,
  RadarChartLazy,
  HistoricalTrendsLazy,
  PeakUsageAnalysisLazy,
  BandwidthPatternsLazy,
  ProtocolTimelineLazy,
  UserActivityTimelineLazy,
  AnomalyDetectionLazy,
  SecurityPostureLazy,
  BandwidthCostEstimatorLazy,
  LazyWrapper,
} from '@/components/lazy';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkQualityDashboard } from '@/components/NetworkQualityDashboard';
import { ApplicationUsageDashboard } from '@/components/ApplicationUsageDashboard';
import { MaintenancePanel } from '@/components/MaintenancePanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { formatBytes, formatBytesShort } from '@/lib/formatters';
import { useApiData } from '@/hooks/useApiData';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  generateInitialDevices,
  generateInitialFlows,
  generateInitialThreats,
  generateAnalyticsData,
  generateProtocolStats,
  generateNetworkFlow,
  generateThreat,
} from '@/lib/mockData';
import { Device, NetworkFlow, Threat } from '@/lib/types';

function App() {
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  // Use API hook for data fetching (only when API is enabled)
  const apiData = useApiData({
    pollingInterval: 5000, // Poll every 5 seconds as backup
    useWebSocket: true, // Enable real-time WebSocket updates
  });

  // Enhanced analytics for summary stats
  const { summaryStats } = useEnhancedAnalytics({
    autoFetch: USE_REAL_API,
  });
  const { useRealApi } = useApiConfig();

  // Fallback mock data state (used when API is disabled)
  const [mockDevices, setMockDevices] = useState<Device[]>([]);
  const [mockFlows, setMockFlows] = useState<NetworkFlow[]>([]);
  const [mockThreats, setMockThreats] = useState<Threat[]>([]);
  const [mockAnalyticsData] = useState(() => generateAnalyticsData(24));
  const [mockProtocolStats] = useState(() => generateProtocolStats());
  const [mockIsCapturing, setMockIsCapturing] = useState(true);

  // Initialize mock data when API is disabled
  useEffect(() => {
    if (!USE_REAL_API && (!mockDevices || mockDevices.length === 0)) {
      const initialDevices = generateInitialDevices(8);
      const initialFlows = generateInitialFlows(initialDevices, 30);
      const initialThreats = generateInitialThreats(initialDevices, initialFlows, 3);

      setMockDevices(initialDevices);
      setMockFlows(initialFlows);
      setMockThreats(initialThreats);
    }
  }, [USE_REAL_API, mockDevices]);

  // Mock data generation interval (only when API is disabled)
  useEffect(() => {
    if (USE_REAL_API || !mockIsCapturing || !mockDevices || mockDevices.length === 0) return;

    const interval = setInterval(() => {
      setMockFlows(currentFlows => {
        if (!currentFlows || !mockDevices) return currentFlows || [];

        const randomDevice = mockDevices[Math.floor(Math.random() * mockDevices.length)];
        const newFlow = generateNetworkFlow(randomDevice.id, `flow-${Date.now()}`);

        if (newFlow.threatLevel === 'high' || newFlow.threatLevel === 'critical') {
          const newThreat = generateThreat(randomDevice.id, newFlow.id, `threat-${Date.now()}`);
          setMockThreats(current => {
            if (!current) return [newThreat];
            return [newThreat, ...current].slice(0, 20);
          });
          toast.error(`Threat detected: ${newThreat.description}`, {
            description: `Device: ${randomDevice.name}`,
          });
        }

        const updatedFlows = [newFlow, ...currentFlows].slice(0, 100);
        return updatedFlows;
      });

      setMockDevices(currentDevices => {
        if (!currentDevices || !mockFlows) return currentDevices || [];

        return currentDevices.map(d => {
          const deviceFlows = mockFlows.filter(f => f.deviceId === d.id);
          const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
          return {
            ...d,
            lastSeen: Date.now(),
            bytesTotal: d.bytesTotal + totalBytes,
            connectionsCount: d.connectionsCount + 1,
          };
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [USE_REAL_API, mockIsCapturing, mockDevices, mockFlows]);

  // Select data source based on API availability
  const devices = USE_REAL_API ? apiData.devices : mockDevices;
  const flows = USE_REAL_API ? apiData.flows : mockFlows;
  const threats = USE_REAL_API ? apiData.threats : mockThreats;
  const analyticsData = USE_REAL_API ? apiData.analyticsData : mockAnalyticsData;
  const protocolStats = USE_REAL_API ? apiData.protocolStats : mockProtocolStats;
  const isCapturing = USE_REAL_API ? apiData.isCapturing : mockIsCapturing;
  const isLoading = USE_REAL_API ? apiData.isLoading : false;
  const isConnected = USE_REAL_API ? apiData.isConnected : false;
  const error = USE_REAL_API ? apiData.error : null;

  // Handle loading state (only when using real API)
  if (isLoading && USE_REAL_API) {
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
  const handleDismissThreat = (id: string) => {
    if (USE_REAL_API) {
      apiData.dismissThreat(id);
    } else {
      setMockThreats(currentThreats => {
        if (!currentThreats) return [];
        return currentThreats.map(t => (t.id === id ? { ...t, dismissed: true } : t));
      });
    }
  };

  // Handle capture toggle
  const handleToggleCapture = () => {
    if (USE_REAL_API) {
      if (isCapturing) {
        apiData.stopCapture();
      } else {
        apiData.startCapture();
      }
    } else {
      setMockIsCapturing(!mockIsCapturing);
    }
  };

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur" role="banner">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NetInsight</h1>
              <p className="text-sm text-muted-foreground">Deep Network Traffic Analysis</p>
            </div>
            <div className="flex items-center gap-3">
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
                      <Circle size={8} weight="fill" className="animate-pulse" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiSlash size={12} />
                      Disconnected
                    </>
                  )}
                </Badge>
              )}
              {/* Capture Control Button */}
              <Button
                variant={isCapturing ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleCapture}
                disabled={USE_REAL_API && !isConnected}
              >
                <Pulse size={16} className={isCapturing ? 'animate-pulse' : ''} />
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

      <main className="container mx-auto px-6 py-6" role="main">
        <Tabs defaultValue="dashboard" className="space-y-6" aria-label="Main navigation tabs">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="dashboard" className="gap-2">
              <Pulse size={16} />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <ChartLineUp size={16} />
              Insights
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <Sparkle size={16} />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="visualizations" className="gap-2">
              <Eye size={16} />
              Visualizations
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2">
              <DeviceMobile size={16} />
              Devices
            </TabsTrigger>
            <TabsTrigger value="threats" className="gap-2">
              <Warning size={16} />
              Threats
              {activeThreats.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                  {activeThreats.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendUp size={16} />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              <Database size={16} />
              Maintenance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Active Connections"
                value={activeFlowsCount.toString()}
                subtitle={`${totalFlows} total`}
                icon={<Graph size={24} />}
                trend="up"
                trendValue={
                  useRealApi && summaryStats
                    ? `${summaryStats.capture_duration_hours.toFixed(1)}h captured`
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
                icon={<Pulse size={24} />}
                trend="up"
                trendValue={
                  useRealApi && summaryStats
                    ? `${formatBytesShort(totalBytes / Math.max(summaryStats.capture_duration_hours, 1))}/hr`
                    : `${Math.floor(Math.random() * 30)}% increase`
                }
              />
              <MetricCard
                title="Active Devices"
                value={totalDevices.toString()}
                subtitle={`${activeDevicesCount} online now`}
                icon={<DeviceMobile size={24} />}
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
                  <Warning className="text-destructive" size={20} />
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ErrorBoundary>
                  <LazyWrapper>
                    <NetworkGraphLazy flows={activeFlows.slice(0, 20)} devices={devices || []} />
                  </LazyWrapper>
                </ErrorBoundary>
                <ErrorBoundary>
                  <TrafficChart
                    data={analyticsData}
                    useApi={USE_REAL_API && isConnected}
                    hours={24}
                  />
                </ErrorBoundary>
              </div>
            </ErrorBoundary>

            <ErrorBoundary>
              <LazyWrapper>
                <FlowPipeVisualizationLazy flows={flows} devices={devices} />
              </LazyWrapper>
            </ErrorBoundary>

            <ErrorBoundary>
              <ConnectionsTableEnhanced
                flows={flows}
                devices={devices}
                useApiFilters={USE_REAL_API && isConnected}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Network Insights</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Deep analysis of network patterns, top users, destinations, and usage trends
              </p>
            </div>

            <InsightsSummary devices={devices} flows={flows} threats={threats} />

            {/* Summary Statistics Card - Enhanced API */}
            <SummaryStatsCard />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConnectionQuality flows={flows} />
              <LazyWrapper>
                <PeakUsageAnalysisLazy flows={flows} devices={devices} />
              </LazyWrapper>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopUsersEnhanced
                devices={devices}
                flows={flows}
                hours={24}
                limit={10}
                sortBy="bytes"
              />
              <TopSitesEnhanced flows={flows} hours={24} limit={10} />
            </div>

            <ErrorBoundary>
              <LazyWrapper>
                <HistoricalTrendsLazy data={analyticsData} useApi={USE_REAL_API && isConnected} />
              </LazyWrapper>
            </ErrorBoundary>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LazyWrapper>
                <BandwidthPatternsLazy flows={flows} />
              </LazyWrapper>
              <GeographicDistributionEnhanced flows={flows} hours={24} />
            </div>

            <LazyWrapper>
              <ProtocolTimelineLazy flows={flows} />
            </LazyWrapper>

            <LazyWrapper>
              <UserActivityTimelineLazy flows={flows} />
            </LazyWrapper>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Advanced Analytics</h2>
              <p className="text-sm text-muted-foreground mb-6">
                AI-powered insights, security scoring, cost analysis, and data export tools
              </p>
            </div>

            {USE_REAL_API && (
              <ErrorBoundary>
                <ConnectionHealthMonitor
                  isConnected={isConnected}
                  error={error}
                  onRetry={() => apiData.refresh()}
                  enableMetrics={true}
                />
              </ErrorBoundary>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LazyWrapper>
                <SecurityPostureLazy flows={flows} devices={devices} threats={threats} />
              </LazyWrapper>
              <LazyWrapper>
                <AnomalyDetectionLazy flows={flows} devices={devices} />
              </LazyWrapper>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LazyWrapper>
                <BandwidthCostEstimatorLazy flows={flows} />
              </LazyWrapper>
              <DataExporterEnhanced flows={flows} devices={devices} threats={threats} />
            </div>
          </TabsContent>

          <TabsContent value="visualizations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LazyWrapper>
                <HeatmapTimelineLazy flows={flows} />
              </LazyWrapper>
              <PacketBurst flows={flows} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BandwidthGauge currentBytes={totalBytes} maxBytes={totalBytes * 1.5} />
              <LazyWrapper>
                <RadarChartLazy devices={devices} />
              </LazyWrapper>
            </div>

            <LazyWrapper>
              <GeographicMapLazy flows={flows} />
            </LazyWrapper>

            <LazyWrapper>
              <ProtocolSankeyLazy flows={flows} devices={devices} />
            </LazyWrapper>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LazyWrapper>
                <NetworkGraphLazy flows={activeFlows.slice(0, 20)} devices={devices} />
              </LazyWrapper>
              <LazyWrapper>
                <FlowPipeVisualizationLazy flows={flows} devices={devices} />
              </LazyWrapper>
            </div>
          </TabsContent>

          <TabsContent value="devices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DevicesListEnhanced
                devices={devices}
                onDeviceUpdate={_updatedDevice => {
                  // Update device in local state
                  if (USE_REAL_API && apiData) {
                    // Refresh devices from API
                    apiData.refresh();
                  }
                }}
              />
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
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* New Enhanced Analytics Dashboards */}
            <div className="space-y-6">
              <NetworkQualityDashboard hours={24} />
              <ApplicationUsageDashboard hours={24} />
            </div>

            {/* Existing Analytics Components */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrafficChart data={analyticsData} useApi={USE_REAL_API && isConnected} hours={24} />
              <ProtocolBreakdown data={protocolStats} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Peak Traffic Hour"
                value="18:00"
                subtitle={formatBytes(Math.max(...analyticsData.map(d => d.totalBytes)))}
              />
              <MetricCard
                title="Average Throughput"
                value={formatBytesShort(totalBytes / 24)}
                subtitle="Per hour"
              />
              <MetricCard
                title="Total Threats"
                value={threats.length}
                subtitle={`${activeThreats.length} unresolved`}
              />
            </div>

            <ConnectionsTableEnhanced
              flows={flows}
              devices={devices}
              useApiFilters={USE_REAL_API && isConnected}
            />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">System Maintenance</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage database storage, cleanup old data, and view system statistics
              </p>
            </div>
            <MaintenancePanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
