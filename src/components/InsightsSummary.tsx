import { useMemo } from 'react'
import { Device, NetworkFlow, Threat } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytesShort, formatDuration } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { 
  TrendUp, 
  TrendDown, 
  Clock, 
  DeviceMobile, 
  Globe, 
  ShieldWarning,
  Clock as ClockIcon,
  ArrowsClockwise
} from '@phosphor-icons/react'

interface InsightsSummaryProps {
  devices: Device[]
  flows: NetworkFlow[]
  threats: Threat[]
}

export function InsightsSummary({ devices, flows, threats }: InsightsSummaryProps) {
  const insights = useMemo(() => {
    const totalBytes = flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
    const avgSessionDuration = flows.reduce((sum, f) => sum + f.duration, 0) / (flows.length || 1)
    
    const mostActiveDevice = devices.reduce((max, d) => {
      const deviceFlows = flows.filter(f => f.deviceId === d.id)
      const deviceBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
      return deviceBytes > max.bytes ? { device: d, bytes: deviceBytes } : max
    }, { device: devices[0], bytes: 0 })

    const topDomain = flows.reduce((acc, flow) => {
      const domain = flow.domain || flow.destIp
      acc[domain] = (acc[domain] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const mostVisitedSite = Object.entries(topDomain).sort((a, b) => b[1] - a[1])[0]

    const protocolUsage = flows.reduce((acc, flow) => {
      acc[flow.protocol] = (acc[flow.protocol] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const dominantProtocol = Object.entries(protocolUsage).sort((a, b) => b[1] - a[1])[0]

    const avgBytesPerDevice = totalBytes / (devices.length || 1)
    
    const peakHour = flows.reduce((acc, flow) => {
      const hour = new Date(flow.timestamp).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    const busiestHour = Object.entries(peakHour).sort((a, b) => b[1] - a[1])[0]

    const recentThreats = threats.filter(t => Date.now() - t.timestamp < 86400000).length
    const activeThreats = threats.filter(t => !t.dismissed).length

    const countryDistribution = flows.reduce((acc, flow) => {
      if (flow.country) {
        acc[flow.country] = (acc[flow.country] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
    const topCountry = Object.entries(countryDistribution).sort((a, b) => b[1] - a[1])[0]

    const uploadTotal = flows.reduce((sum, f) => sum + f.bytesOut, 0)
    const downloadTotal = flows.reduce((sum, f) => sum + f.bytesIn, 0)
    const uploadDownloadRatio = uploadTotal > 0 ? (downloadTotal / uploadTotal).toFixed(1) : 'N/A'

    return {
      totalBytes,
      avgSessionDuration,
      mostActiveDevice: mostActiveDevice.device?.name || 'N/A',
      mostActiveDeviceBytes: mostActiveDevice.bytes,
      mostVisitedSite: mostVisitedSite?.[0] || 'N/A',
      mostVisitedSiteCount: mostVisitedSite?.[1] || 0,
      dominantProtocol: dominantProtocol?.[0] || 'N/A',
      dominantProtocolPercentage: dominantProtocol ? ((dominantProtocol[1] / flows.length) * 100).toFixed(0) : '0',
      avgBytesPerDevice,
      busiestHour: busiestHour ? `${busiestHour[0].padStart(2, '0')}:00` : 'N/A',
      busiestHourConnections: busiestHour?.[1] || 0,
      recentThreats,
      activeThreats,
      topCountry: topCountry?.[0] || 'N/A',
      topCountryPercentage: topCountry ? ((topCountry[1] / flows.length) * 100).toFixed(0) : '0',
      uploadDownloadRatio,
      totalDevices: devices.length,
      totalConnections: flows.length
    }
  }, [devices, flows, threats])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Traffic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBytesShort(insights.totalBytes)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.totalConnections} total connections
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DeviceMobile size={14} />
            Most Active Device
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold truncate">{insights.mostActiveDevice}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatBytesShort(insights.mostActiveDeviceBytes)} transferred
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe size={14} />
            Most Visited Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-bold font-mono truncate">{insights.mostVisitedSite}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.mostVisitedSiteCount} connections
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ArrowsClockwise size={14} />
            Dominant Protocol
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{insights.dominantProtocol}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.dominantProtocolPercentage}% of all traffic
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClockIcon size={14} />
            Busiest Hour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{insights.busiestHour}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.busiestHourConnections} connections
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Session Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDuration(insights.avgSessionDuration)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Per connection
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ShieldWarning size={14} />
            Threat Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{insights.activeThreats}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.recentThreats} detected in 24h
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Top Country</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono">{insights.topCountry}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.topCountryPercentage}% of connections
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">DL/UL Ratio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{insights.uploadDownloadRatio}:1</div>
          <p className="text-xs text-muted-foreground mt-1">
            Download to upload ratio
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg per Device</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBytesShort(insights.avgBytesPerDevice)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {insights.totalDevices} total devices
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
