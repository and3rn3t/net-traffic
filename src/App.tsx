import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Activity, ShieldCheck, DeviceMobile, TrendUp, Graph, Warning, Eye, ChartLineUp, Sparkle } from '@phosphor-icons/react'
import { MetricCard } from '@/components/MetricCard'
import { ThreatAlert } from '@/components/ThreatAlert'
import { ConnectionsTable } from '@/components/ConnectionsTable'
import { DevicesList } from '@/components/DevicesList'
import { TrafficChart } from '@/components/TrafficChart'
import { ProtocolBreakdown } from '@/components/ProtocolBreakdown'
import { NetworkGraph } from '@/components/NetworkGraph'
import { FlowPipeVisualization } from '@/components/FlowPipeVisualization'
import { HeatmapTimeline } from '@/components/HeatmapTimeline'
import { PacketBurst } from '@/components/PacketBurst'
import { BandwidthGauge } from '@/components/BandwidthGauge'
import { GeographicMap } from '@/components/GeographicMap'
import { ProtocolSankey } from '@/components/ProtocolSankey'
import { RadarChart } from '@/components/RadarChart'
import { TopUsers } from '@/components/TopUsers'
import { TopSites } from '@/components/TopSites'
import { HistoricalTrends } from '@/components/HistoricalTrends'
import { UserActivityTimeline } from '@/components/UserActivityTimeline'
import { BandwidthPatterns } from '@/components/BandwidthPatterns'
import { GeographicDistribution } from '@/components/GeographicDistribution'
import { ProtocolTimeline } from '@/components/ProtocolTimeline'
import { InsightsSummary } from '@/components/InsightsSummary'
import { ConnectionQuality } from '@/components/ConnectionQuality'
import { PeakUsageAnalysis } from '@/components/PeakUsageAnalysis'
import { AnomalyDetection } from '@/components/AnomalyDetection'
import { BandwidthCostEstimator } from '@/components/BandwidthCostEstimator'
import { SecurityPosture } from '@/components/SecurityPosture'
import { DataExporter } from '@/components/DataExporter'
import { NetworkFlow, Device, Threat } from '@/lib/types'
import { formatBytes, formatBytesShort } from '@/lib/formatters'
import {
  generateInitialDevices,
  generateInitialFlows,
  generateInitialThreats,
  generateAnalyticsData,
  generateProtocolStats,
  generateNetworkFlow,
  generateThreat
} from '@/lib/mockData'
import { toast } from 'sonner'

function App() {
  const [devices, setDevices] = useKV<Device[]>('network-devices', [])
  const [flows, setFlows] = useKV<NetworkFlow[]>('network-flows', [])
  const [threats, setThreats] = useKV<Threat[]>('network-threats', [])
  const [analyticsData] = useState(() => generateAnalyticsData(24))
  const [protocolStats] = useState(() => generateProtocolStats())
  const [isCapturing, setIsCapturing] = useState(true)

  useEffect(() => {
    if (!devices || devices.length === 0) {
      const initialDevices = generateInitialDevices(8)
      const initialFlows = generateInitialFlows(initialDevices, 30)
      const initialThreats = generateInitialThreats(initialDevices, initialFlows, 3)
      
      setDevices(initialDevices)
      setFlows(initialFlows)
      setThreats(initialThreats)
    }
  }, [])

  useEffect(() => {
    if (!isCapturing || !devices || devices.length === 0) return

    const interval = setInterval(() => {
      setFlows(currentFlows => {
        if (!currentFlows || !devices) return currentFlows || []
        
        const randomDevice = devices[Math.floor(Math.random() * devices.length)]
        const newFlow = generateNetworkFlow(randomDevice.id, `flow-${Date.now()}`)
        
        if (newFlow.threatLevel === 'high' || newFlow.threatLevel === 'critical') {
          const newThreat = generateThreat(randomDevice.id, newFlow.id, `threat-${Date.now()}`)
          setThreats(current => {
            if (!current) return [newThreat]
            return [newThreat, ...current].slice(0, 20)
          })
          toast.error(`Threat detected: ${newThreat.description}`, {
            description: `Device: ${randomDevice.name}`
          })
        }
        
        const updatedFlows = [newFlow, ...currentFlows].slice(0, 100)
        return updatedFlows
      })

      setDevices(currentDevices => {
        if (!currentDevices || !flows) return currentDevices || []
        
        return currentDevices.map(d => {
          const deviceFlows = flows.filter(f => f.deviceId === d.id)
          const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
          return {
            ...d,
            lastSeen: Date.now(),
            bytesTotal: d.bytesTotal + totalBytes,
            connectionsCount: d.connectionsCount + 1
          }
        })
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [isCapturing, devices, flows, setFlows, setDevices, setThreats])

  const handleDismissThreat = (id: string) => {
    setThreats(currentThreats => {
      if (!currentThreats) return []
      return currentThreats.map(t => t.id === id ? { ...t, dismissed: true } : t)
    })
  }

  const activeThreats = (threats || []).filter(t => !t.dismissed)
  const activeFlows = (flows || []).filter(f => f.status === 'active')
  const totalBytes = (flows || []).reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
  const avgThreatScore = (devices || []).reduce((sum, d) => sum + d.threatScore, 0) / ((devices || []).length || 1)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NetInsight</h1>
              <p className="text-sm text-muted-foreground">Deep Network Traffic Analysis</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={isCapturing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsCapturing(!isCapturing)}
              >
                <Activity size={16} className={isCapturing ? 'animate-pulse' : ''} />
                {isCapturing ? 'Capturing' : 'Paused'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity size={16} />
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
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Active Connections"
                value={activeFlows.length}
                subtitle={`${(flows || []).length} total`}
                icon={<Graph size={24} />}
                trend="up"
                trendValue={`${Math.floor(Math.random() * 20)}% from last hour`}
              />
              <MetricCard
                title="Network Throughput"
                value={formatBytesShort(totalBytes)}
                subtitle="Last 24 hours"
                icon={<Activity size={24} />}
                trend="up"
                trendValue={`${Math.floor(Math.random() * 30)}% increase`}
              />
              <MetricCard
                title="Active Devices"
                value={(devices || []).length}
                subtitle={`${(devices || []).filter(d => Date.now() - d.lastSeen < 300000).length} online now`}
                icon={<DeviceMobile size={24} />}
                trend="neutral"
              />
              <MetricCard
                title="Threat Score"
                value={`${avgThreatScore.toFixed(0)}%`}
                subtitle={activeThreats.length > 0 ? `${activeThreats.length} active threats` : 'Network secure'}
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
                    <ThreatAlert
                      key={threat.id}
                      threat={threat}
                      onDismiss={handleDismissThreat}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NetworkGraph flows={activeFlows.slice(0, 20)} devices={devices || []} />
              <TrafficChart data={analyticsData} />
            </div>

            <FlowPipeVisualization flows={flows || []} devices={devices || []} />

            <ConnectionsTable flows={(flows || []).slice(0, 50)} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Network Insights</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Deep analysis of network patterns, top users, destinations, and usage trends
              </p>
            </div>

            <InsightsSummary 
              devices={devices || []} 
              flows={flows || []} 
              threats={threats || []}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConnectionQuality flows={flows || []} />
              <PeakUsageAnalysis flows={flows || []} devices={devices || []} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopUsers devices={devices || []} flows={flows || []} />
              <TopSites flows={flows || []} />
            </div>

            <HistoricalTrends data={analyticsData} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BandwidthPatterns flows={flows || []} />
              <GeographicDistribution flows={flows || []} />
            </div>

            <ProtocolTimeline flows={flows || []} />

            <UserActivityTimeline flows={flows || []} />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Advanced Analytics</h2>
              <p className="text-sm text-muted-foreground mb-6">
                AI-powered insights, security scoring, cost analysis, and data export tools
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SecurityPosture 
                flows={flows || []} 
                devices={devices || []} 
                threats={threats || []}
              />
              <AnomalyDetection 
                flows={flows || []} 
                devices={devices || []}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BandwidthCostEstimator flows={flows || []} />
              <DataExporter 
                flows={flows || []} 
                devices={devices || []} 
                threats={threats || []}
              />
            </div>
          </TabsContent>

          <TabsContent value="visualizations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HeatmapTimeline flows={flows || []} />
              <PacketBurst flows={flows || []} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BandwidthGauge 
                currentBytes={totalBytes} 
                maxBytes={totalBytes * 1.5} 
              />
              <RadarChart devices={devices || []} />
            </div>

            <GeographicMap flows={flows || []} />

            <ProtocolSankey flows={flows || []} devices={devices || []} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NetworkGraph flows={activeFlows.slice(0, 20)} devices={devices || []} />
              <FlowPipeVisualization flows={flows || []} devices={devices || []} />
            </div>
          </TabsContent>

          <TabsContent value="devices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DevicesList devices={devices || []} />
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
              {(threats || []).filter(t => t.dismissed).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setThreats(currentThreats => {
                    if (!currentThreats) return []
                    return currentThreats.filter(t => !t.dismissed)
                  })}
                >
                  Clear dismissed ({(threats || []).filter(t => t.dismissed).length})
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
                {(threats || []).map(threat => !threat.dismissed && (
                  <ThreatAlert
                    key={threat.id}
                    threat={threat}
                    onDismiss={handleDismissThreat}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrafficChart data={analyticsData} />
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
                value={(threats || []).length}
                subtitle={`${activeThreats.length} unresolved`}
              />
            </div>

            <ConnectionsTable flows={(flows || []).slice(0, 100)} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App