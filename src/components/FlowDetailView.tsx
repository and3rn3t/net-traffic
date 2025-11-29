import { memo } from 'react';
import { NetworkFlow } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  MapPin,
  Gauge,
  Shield,
  Network,
  Clock,
  ArrowRight,
  Activity,
  Lock,
  Code,
} from '@phosphor-icons/react';

interface FlowDetailViewProps {
  flow: NetworkFlow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const FlowDetailView = memo(function FlowDetailView({
  flow,
  open,
  onOpenChange,
}: FlowDetailViewProps) {
  if (!flow) return null;

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-destructive';
      case 'high':
        return 'text-destructive/80';
      case 'medium':
        return 'text-warning';
      case 'low':
        return 'text-warning/80';
      default:
        return 'text-success';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network size={20} />
            Flow Details
          </DialogTitle>
          <DialogDescription>
            Complete information for network flow {flow.id.slice(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity size={16} />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Protocol</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {flow.protocol}
                    </Badge>
                    {flow.application && <Badge variant="secondary">{flow.application}</Badge>}
                    {flow.status === 'active' && (
                      <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Threat Level</p>
                  <Badge className={getThreatColor(flow.threatLevel)}>
                    {flow.threatLevel.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                  <p className="text-sm font-mono">{formatTimestamp(flow.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="text-sm">{formatDuration(flow.duration)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Connection</p>
                <div className="flex items-center gap-3 font-mono text-sm">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Source</p>
                    <p>
                      {flow.sourceIp}:{flow.sourcePort}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Destination</p>
                    <p>
                      {flow.destIp}:{flow.destPort}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Quality */}
          {(flow.rtt !== undefined ||
            flow.jitter !== undefined ||
            flow.retransmissions !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge size={16} />
                  Network Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {flow.rtt !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Round-Trip Time</p>
                      <p className="text-lg font-semibold">{flow.rtt}ms</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {flow.rtt < 50
                          ? 'Excellent'
                          : flow.rtt < 100
                            ? 'Good'
                            : flow.rtt < 200
                              ? 'Fair'
                              : 'Poor'}
                      </p>
                    </div>
                  )}
                  {flow.jitter !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Jitter</p>
                      <p className="text-lg font-semibold">{flow.jitter.toFixed(1)}ms</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {flow.jitter < 10 ? 'Excellent' : flow.jitter < 30 ? 'Good' : 'Fair'}
                      </p>
                    </div>
                  )}
                  {flow.retransmissions !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Retransmissions</p>
                      <p className="text-lg font-semibold">{flow.retransmissions}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {flow.retransmissions === 0
                          ? 'None'
                          : flow.retransmissions < 5
                            ? 'Low'
                            : 'High'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Traffic Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity size={16} />
                Traffic Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bytes In</p>
                  <p className="text-sm font-semibold">{formatBytes(flow.bytesIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bytes Out</p>
                  <p className="text-sm font-semibold">{formatBytes(flow.bytesOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Packets In</p>
                  <p className="text-sm font-semibold">{flow.packetsIn.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Packets Out</p>
                  <p className="text-sm font-semibold">{flow.packetsOut.toLocaleString()}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total Traffic</p>
                <p className="text-lg font-semibold">{formatBytes(flow.bytesIn + flow.bytesOut)}</p>
              </div>
            </CardContent>
          </Card>

          {/* TCP Details */}
          {(flow.tcpFlags || flow.connectionState || flow.ttl !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code size={16} />
                  TCP Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {flow.tcpFlags && flow.tcpFlags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">TCP Flags</p>
                    <div className="flex flex-wrap gap-2">
                      {flow.tcpFlags.map(flag => (
                        <Badge
                          key={flag}
                          variant="outline"
                          className={
                            flag === 'RST'
                              ? 'border-destructive text-destructive'
                              : flag === 'SYN'
                                ? 'border-primary text-primary'
                                : flag === 'ACK'
                                  ? 'border-success text-success'
                                  : flag === 'FIN'
                                    ? 'border-warning text-warning'
                                    : ''
                          }
                        >
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {flow.connectionState && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Connection State</p>
                      <Badge variant="outline">{flow.connectionState}</Badge>
                    </div>
                  )}
                  {flow.ttl !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">TTL</p>
                      <p className="text-sm font-mono">{flow.ttl}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Application Layer */}
          {(flow.sni || flow.domain || flow.httpMethod || flow.url || flow.userAgent) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock size={16} />
                  Application Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {flow.sni && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      SNI (Server Name Indication)
                    </p>
                    <p className="text-sm font-mono break-all">{flow.sni}</p>
                  </div>
                )}
                {flow.domain && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Domain</p>
                    <p className="text-sm font-mono break-all">{flow.domain}</p>
                  </div>
                )}
                {flow.httpMethod && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">HTTP Method</p>
                    <Badge variant="outline">{flow.httpMethod}</Badge>
                  </div>
                )}
                {flow.url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">URL</p>
                    <p className="text-sm font-mono break-all text-primary">{flow.url}</p>
                  </div>
                )}
                {flow.userAgent && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                    <p className="text-sm break-all text-muted-foreground">{flow.userAgent}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Geolocation */}
          {(flow.country || flow.city || flow.asn) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={16} />
                  Geolocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {flow.country && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Country</p>
                      <div className="flex items-center gap-2">
                        <Globe size={16} />
                        <p className="text-sm font-semibold">{flow.country}</p>
                      </div>
                    </div>
                  )}
                  {flow.city && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">City</p>
                      <p className="text-sm font-semibold">{flow.city}</p>
                    </div>
                  )}
                  {flow.asn && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ASN</p>
                      <p className="text-sm font-mono">{flow.asn}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DNS Details */}
          {(flow.dnsQueryType || flow.dnsResponseCode) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network size={16} />
                  DNS Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {flow.dnsQueryType && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Query Type</p>
                      <Badge variant="outline">{flow.dnsQueryType}</Badge>
                    </div>
                  )}
                  {flow.dnsResponseCode && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Response Code</p>
                      <Badge
                        variant="outline"
                        className={
                          flow.dnsResponseCode === 'NOERROR'
                            ? 'border-success text-success'
                            : 'border-warning text-warning'
                        }
                      >
                        {flow.dnsResponseCode}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
