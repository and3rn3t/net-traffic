import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DownloadSimple, FileCsv, FileText } from '@phosphor-icons/react'
import { NetworkFlow, Device, Threat } from '@/lib/types'
import { toast } from 'sonner'

interface DataExporterProps {
  flows: NetworkFlow[]
  devices: Device[]
  threats: Threat[]
}

export function DataExporter({ flows, devices, threats }: DataExporterProps) {
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header.toLowerCase().replace(/ /g, '')]
          if (value === null || value === undefined) return ''
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    toast.success(`Exported ${data.length} records to CSV`)
  }

  const exportToJSON = (data: any, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    toast.success('Exported data to JSON')
  }

  const generateReport = () => {
    const totalBytes = flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
    const activeThreats = threats.filter(t => !t.dismissed).length
    const avgThreatScore = devices.reduce((sum, d) => sum + d.threatScore, 0) / (devices.length || 1)

    const report = `
NETWORK ANALYSIS REPORT
Generated: ${new Date().toISOString()}
==================================================

EXECUTIVE SUMMARY
-----------------
Total Devices: ${devices.length}
Active Connections: ${flows.filter(f => f.status === 'active').length}
Total Data Transfer: ${(totalBytes / (1024 ** 3)).toFixed(2)} GB
Active Threats: ${activeThreats}
Average Threat Score: ${avgThreatScore.toFixed(2)}%

DEVICE INVENTORY
----------------
${devices.map(d => `
${d.name}
  IP: ${d.ip}
  MAC: ${d.mac}
  Type: ${d.type}
  Total Transfer: ${(d.bytesTotal / (1024 ** 2)).toFixed(2)} MB
  Threat Score: ${d.threatScore.toFixed(0)}%
`).join('\n')}

THREAT ANALYSIS
---------------
${threats.length === 0 ? 'No threats detected.' : threats.map(t => `
${t.type.toUpperCase()} - ${t.severity}
  Time: ${new Date(t.timestamp).toLocaleString()}
  Description: ${t.description}
  Recommendation: ${t.recommendation}
  Status: ${t.dismissed ? 'Dismissed' : 'Active'}
`).join('\n')}

PROTOCOL BREAKDOWN
------------------
${Object.entries(
  flows.reduce((acc, f) => {
    acc[f.protocol] = (acc[f.protocol] || 0) + 1
    return acc
  }, {} as Record<string, number>)
).map(([protocol, count]) => `${protocol}: ${count} connections`).join('\n')}

TOP DESTINATIONS
----------------
${Object.entries(
  flows.reduce((acc, f) => {
    if (f.domain) {
      acc[f.domain] = (acc[f.domain] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)
).sort(([, a], [, b]) => b - a).slice(0, 10).map(([domain, count]) => `${domain}: ${count} connections`).join('\n')}

==================================================
End of Report
`

    const blob = new Blob([report], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `network-report-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    toast.success('Generated network analysis report')
  }

  const handleExportFlows = () => {
    const flowData = flows.map(f => ({
      timestamp: new Date(f.timestamp).toISOString(),
      sourceip: f.sourceIp,
      sourceport: f.sourcePort,
      destip: f.destIp,
      destport: f.destPort,
      protocol: f.protocol,
      bytesin: f.bytesIn,
      bytesout: f.bytesOut,
      packetsin: f.packetsIn,
      packetsout: f.packetsOut,
      duration: f.duration,
      status: f.status,
      domain: f.domain || '',
      country: f.country || '',
      threatlevel: f.threatLevel
    }))

    exportToCSV(
      flowData,
      'network-flows',
      ['Timestamp', 'SourceIP', 'SourcePort', 'DestIP', 'DestPort', 'Protocol', 'BytesIn', 'BytesOut', 'PacketsIn', 'PacketsOut', 'Duration', 'Status', 'Domain', 'Country', 'ThreatLevel']
    )
  }

  const handleExportDevices = () => {
    const deviceData = devices.map(d => ({
      name: d.name,
      ip: d.ip,
      mac: d.mac,
      type: d.type,
      vendor: d.vendor,
      firstseen: new Date(d.firstSeen).toISOString(),
      lastseen: new Date(d.lastSeen).toISOString(),
      bytestotal: d.bytesTotal,
      connectionscount: d.connectionsCount,
      threatscore: d.threatScore.toFixed(2)
    }))

    exportToCSV(
      deviceData,
      'network-devices',
      ['Name', 'IP', 'MAC', 'Type', 'Vendor', 'FirstSeen', 'LastSeen', 'BytesTotal', 'ConnectionsCount', 'ThreatScore']
    )
  }

  const handleExportThreats = () => {
    const threatData = threats.map(t => ({
      timestamp: new Date(t.timestamp).toISOString(),
      type: t.type,
      severity: t.severity,
      description: t.description,
      recommendation: t.recommendation,
      dismissed: t.dismissed
    }))

    exportToCSV(
      threatData,
      'network-threats',
      ['Timestamp', 'Type', 'Severity', 'Description', 'Recommendation', 'Dismissed']
    )
  }

  const handleExportAll = () => {
    exportToJSON(
      {
        exportDate: new Date().toISOString(),
        devices,
        flows,
        threats,
        summary: {
          totalDevices: devices.length,
          totalFlows: flows.length,
          totalThreats: threats.length,
          totalBytes: flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
        }
      },
      'network-data-complete'
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DownloadSimple size={20} />
          Export & Reports
        </CardTitle>
        <CardDescription>
          Export network data and generate analysis reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleExportFlows}
          >
            <FileCsv size={18} />
            <div className="text-left">
              <div className="font-medium">Export Flows</div>
              <div className="text-xs text-muted-foreground">{flows.length} records</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleExportDevices}
          >
            <FileCsv size={18} />
            <div className="text-left">
              <div className="font-medium">Export Devices</div>
              <div className="text-xs text-muted-foreground">{devices.length} records</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleExportThreats}
          >
            <FileCsv size={18} />
            <div className="text-left">
              <div className="font-medium">Export Threats</div>
              <div className="text-xs text-muted-foreground">{threats.length} records</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleExportAll}
          >
            <FileText size={18} />
            <div className="text-left">
              <div className="font-medium">Export All (JSON)</div>
              <div className="text-xs text-muted-foreground">Complete dataset</div>
            </div>
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            className="w-full gap-2"
            onClick={generateReport}
          >
            <FileText size={18} />
            Generate Full Report
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Comprehensive text report with all analysis data
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
