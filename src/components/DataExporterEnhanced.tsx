/**
 * Enhanced DataExporter component using API export endpoints
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DownloadSimple, FileCsv, FileText } from '@phosphor-icons/react';
import { NetworkFlow, Device, Threat } from '@/lib/types';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataExporterEnhancedProps {
  flows: NetworkFlow[];
  devices: Device[];
  threats: Threat[];
}

export function DataExporterEnhanced({ flows, devices, threats }: DataExporterEnhancedProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    format: 'csv' as 'csv' | 'json',
    startTime: '',
    endTime: '',
    deviceId: '',
  });
  const [isExporting, setIsExporting] = useState(false);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  // Local export functions (fallback)
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const key = header.toLowerCase().replace(/ /g, '');
            const value = row[key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
            return value;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.URL.revokeObjectURL(url);

    toast.success(`Exported ${data.length} records to CSV`);
  };

  const exportToJSON = (data: any, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.URL.revokeObjectURL(url);

    toast.success('Exported data to JSON');
  };

  // Enhanced export using API
  const handleExportFlowsAPI = async () => {
    setIsExporting(true);
    try {
      const startTime = exportConfig.startTime
        ? new Date(exportConfig.startTime).getTime()
        : undefined;
      const endTime = exportConfig.endTime ? new Date(exportConfig.endTime).getTime() : undefined;

      if (USE_REAL_API) {
        await apiClient.exportFlows(
          exportConfig.format,
          startTime,
          endTime,
          exportConfig.deviceId || undefined
        );
        toast.success(`Flows exported as ${exportConfig.format.toUpperCase()}`);
      } else {
        // Fallback to local export
        handleExportFlows();
      }
      setShowExportDialog(false);
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Local fallback functions
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
      city: f.city || '',
      asn: f.asn || '',
      sni: f.sni || '',
      threatlevel: f.threatLevel,
      tcpflags: f.tcpFlags?.join(',') || '',
      ttl: f.ttl || '',
      connectionstate: f.connectionState || '',
      rtt: f.rtt || '',
      retransmissions: f.retransmissions || '',
      jitter: f.jitter || '',
      application: f.application || '',
      useragent: f.userAgent || '',
      httpmethod: f.httpMethod || '',
      url: f.url || '',
      dnsquerytype: f.dnsQueryType || '',
      dnsresponsecode: f.dnsResponseCode || '',
    }));

    exportToCSV(flowData, 'network-flows', [
      'Timestamp',
      'SourceIP',
      'SourcePort',
      'DestIP',
      'DestPort',
      'Protocol',
      'BytesIn',
      'BytesOut',
      'PacketsIn',
      'PacketsOut',
      'Duration',
      'Status',
      'Domain',
      'Country',
      'City',
      'ASN',
      'SNI',
      'ThreatLevel',
      'TCPFlags',
      'TTL',
      'ConnectionState',
      'RTT',
      'Retransmissions',
      'Jitter',
      'Application',
      'UserAgent',
      'HTTPMethod',
      'URL',
      'DNSQueryType',
      'DNSResponseCode',
    ]);
  };

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
      threatscore: d.threatScore.toFixed(2),
    }));

    exportToCSV(deviceData, 'network-devices', [
      'Name',
      'IP',
      'MAC',
      'Type',
      'Vendor',
      'FirstSeen',
      'LastSeen',
      'BytesTotal',
      'ConnectionsCount',
      'ThreatScore',
    ]);
  };

  const handleExportThreats = () => {
    const threatData = threats.map(t => ({
      timestamp: new Date(t.timestamp).toISOString(),
      type: t.type,
      severity: t.severity,
      description: t.description,
      recommendation: t.recommendation,
      dismissed: t.dismissed,
    }));

    exportToCSV(threatData, 'network-threats', [
      'Timestamp',
      'Type',
      'Severity',
      'Description',
      'Recommendation',
      'Dismissed',
    ]);
  };

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
          totalBytes: flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0),
        },
      },
      'network-data-complete'
    );
  };

  const generateReport = () => {
    const totalBytes = flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
    const activeThreats = threats.filter(t => !t.dismissed).length;
    const avgThreatScore =
      devices.reduce((sum, d) => sum + d.threatScore, 0) / (devices.length || 1);

    const report = `
NETWORK ANALYSIS REPORT
Generated: ${new Date().toISOString()}
==================================================

EXECUTIVE SUMMARY
-----------------
Total Devices: ${devices.length}
Active Connections: ${flows.filter(f => f.status === 'active').length}
Total Data Transfer: ${(totalBytes / 1024 ** 3).toFixed(2)} GB
Active Threats: ${activeThreats}
Average Threat Score: ${avgThreatScore.toFixed(2)}%

DEVICE INVENTORY
----------------
${devices
  .map(
    d => `
${d.name}
  IP: ${d.ip}
  MAC: ${d.mac}
  Type: ${d.type}
  Total Transfer: ${(d.bytesTotal / 1024 ** 2).toFixed(2)} MB
  Threat Score: ${d.threatScore.toFixed(0)}%
`
  )
  .join('\n')}

THREAT ANALYSIS
---------------
${
  threats.length === 0
    ? 'No threats detected.'
    : threats
        .map(
          t => `
${t.type.toUpperCase()} - ${t.severity}
  Time: ${new Date(t.timestamp).toLocaleString()}
  Description: ${t.description}
  Recommendation: ${t.recommendation}
  Status: ${t.dismissed ? 'Dismissed' : 'Active'}
`
        )
        .join('\n')
}

PROTOCOL BREAKDOWN
------------------
${Object.entries(
  flows.reduce(
    (acc, f) => {
      acc[f.protocol] = (acc[f.protocol] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  )
)
  .map(([protocol, count]) => `${protocol}: ${count} connections`)
  .join('\n')}

TOP DESTINATIONS
----------------
${Object.entries(
  flows.reduce(
    (acc, f) => {
      if (f.domain) {
        acc[f.domain] = (acc[f.domain] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  )
)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([domain, count]) => `${domain}: ${count} connections`)
  .join('\n')}

==================================================
End of Report
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.URL.revokeObjectURL(url);

    toast.success('Generated network analysis report');
  };

  // Calculate default time range (last 24 hours)
  const defaultStartTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const defaultEndTime = new Date().toISOString().slice(0, 16);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadSimple size={20} />
            Export & Reports
          </CardTitle>
          <CardDescription>
            Export network data and generate analysis reports
            {USE_REAL_API && ' (uses backend API)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => (USE_REAL_API ? setShowExportDialog(true) : handleExportFlows())}
            >
              <FileCsv size={18} />
              <div className="text-left">
                <div className="font-medium">Export Flows</div>
                <div className="text-xs text-muted-foreground">{flows.length} records</div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start gap-2" onClick={handleExportDevices}>
              <FileCsv size={18} />
              <div className="text-left">
                <div className="font-medium">Export Devices</div>
                <div className="text-xs text-muted-foreground">{devices.length} records</div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start gap-2" onClick={handleExportThreats}>
              <FileCsv size={18} />
              <div className="text-left">
                <div className="font-medium">Export Threats</div>
                <div className="text-xs text-muted-foreground">{threats.length} records</div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start gap-2" onClick={handleExportAll}>
              <FileText size={18} />
              <div className="text-left">
                <div className="font-medium">Export All (JSON)</div>
                <div className="text-xs text-muted-foreground">Complete dataset</div>
              </div>
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <Button className="w-full gap-2" onClick={generateReport}>
              <FileText size={18} />
              Generate Full Report
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Comprehensive text report with all analysis data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Configuration Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Flows</DialogTitle>
            <DialogDescription>
              Configure export options and time range. Leave empty for all flows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">Export Format</Label>
              <Select
                value={exportConfig.format}
                onValueChange={value =>
                  setExportConfig({ ...exportConfig, format: value as 'csv' | 'json' })
                }
              >
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time (Optional)</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={exportConfig.startTime || defaultStartTime}
                  onChange={e => setExportConfig({ ...exportConfig, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time (Optional)</Label>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={exportConfig.endTime || defaultEndTime}
                  onChange={e => setExportConfig({ ...exportConfig, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-filter">Device Filter (Optional)</Label>
              <Select
                value={exportConfig.deviceId || 'all'}
                onValueChange={value => setExportConfig({ ...exportConfig, deviceId: value === 'all' ? null : value })}
              >
                <SelectTrigger id="device-filter">
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button onClick={handleExportFlowsAPI} disabled={isExporting}>
              <DownloadSimple size={16} className="mr-2" />
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
