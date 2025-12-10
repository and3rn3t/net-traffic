import { memo, useEffect, useState } from 'react';
import { NetworkFlow } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
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
  Network,
  ArrowRight,
  Activity,
  Lock,
  Code,
} from 'lucide-react';

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
  const [fetchedFlow, setFetchedFlow] = useState<NetworkFlow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  // Fetch fresh flow data from API when opened
  useEffect(() => {
    if (!flow || !open || !USE_REAL_API) {
      setFetchedFlow(flow);
      return;
    }

    const fetchFlow = async () => {
      setIsLoading(true);
      try {
        const freshFlow = await apiClient.getFlow(currentFlow.id);
        setFetchedFlow(freshFlow);
      } catch (error) {
        console.error('Failed to fetch flow details:', error);
        // Fallback to prop flow if API fails
        setFetchedFlow(flow);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlow();
  }, [flow, open, USE_REAL_API]);

  // Use fetched flow if available, otherwise use prop flow
  const displayFlow = fetchedFlow || flow;

  if (!displayFlow) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Flow Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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

  // Use displayFlow throughout to avoid shadowing the prop
  const currentFlow = displayFlow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network size={20} />
            Flow Details
          </DialogTitle>
          <DialogDescription>
            Complete information for network flow {currentFlow.id.slice(0, 8)}...
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
                      {currentFlow.protocol}
                    </Badge>
                    {currentFlow.application && (
                      <Badge variant="secondary">{currentFlow.application}</Badge>
                    )}
                    {currentFlow.status === 'active' && (
                      <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Threat Level</p>
                  <Badge className={getThreatColor(currentFlow.threatLevel)}>
                    {currentFlow.threatLevel.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                  <p className="text-sm font-mono">{formatTimestamp(currentFlow.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="text-sm">{formatDuration(currentFlow.duration)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Connection</p>
                <div className="flex items-center gap-3 font-mono text-sm">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Source</p>
                    <p>
                      {currentFlow.sourceIp}:{currentFlow.sourcePort}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Destination</p>
                    <p>
                      {currentFlow.destIp}:{currentFlow.destPort}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Quality */}
          {(currentFlow.rtt !== undefined ||
            currentFlow.jitter !== undefined ||
            currentFlow.retransmissions !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge size={16} />
                  Network Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {currentFlow.rtt !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Round-Trip Time</p>
                      <p className="text-lg font-semibold">{currentFlow.rtt}ms</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentFlow.rtt < 50
                          ? 'Excellent'
                          : currentFlow.rtt < 100
                            ? 'Good'
                            : currentFlow.rtt < 200
                              ? 'Fair'
                              : 'Poor'}
                      </p>
                    </div>
                  )}
                  {currentFlow.jitter !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Jitter</p>
                      <p className="text-lg font-semibold">{currentFlow.jitter.toFixed(1)}ms</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentFlow.jitter < 10
                          ? 'Excellent'
                          : currentFlow.jitter < 30
                            ? 'Good'
                            : 'Fair'}
                      </p>
                    </div>
                  )}
                  {currentFlow.retransmissions !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Retransmissions</p>
                      <p className="text-lg font-semibold">{currentFlow.retransmissions}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentFlow.retransmissions === 0
                          ? 'None'
                          : currentFlow.retransmissions < 5
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
                  <p className="text-sm font-semibold">{formatBytes(currentFlow.bytesIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bytes Out</p>
                  <p className="text-sm font-semibold">{formatBytes(currentFlow.bytesOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Packets In</p>
                  <p className="text-sm font-semibold">{currentFlow.packetsIn.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Packets Out</p>
                  <p className="text-sm font-semibold">{currentFlow.packetsOut.toLocaleString()}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total Traffic</p>
                <p className="text-lg font-semibold">
                  {formatBytes(currentFlow.bytesIn + currentFlow.bytesOut)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* TCP Details */}
          {(currentFlow.tcpFlags ||
            currentFlow.connectionState ||
            currentFlow.ttl !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code size={16} />
                  TCP Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentFlow.tcpFlags && currentFlow.tcpFlags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">TCP Flags</p>
                    <div className="flex flex-wrap gap-2">
                      {currentFlow.tcpFlags.map(flag => (
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
                  {currentFlow.connectionState && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Connection State</p>
                      <Badge variant="outline">{currentFlow.connectionState}</Badge>
                    </div>
                  )}
                  {currentFlow.ttl !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">TTL</p>
                      <p className="text-sm font-mono">{currentFlow.ttl}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Application Layer */}
          {(currentFlow.sni ||
            currentFlow.domain ||
            currentFlow.httpMethod ||
            currentFlow.url ||
            currentFlow.userAgent) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock size={16} />
                  Application Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentFlow.sni && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      SNI (Server Name Indication)
                    </p>
                    <p className="text-sm font-mono break-all">{currentFlow.sni}</p>
                  </div>
                )}
                {currentFlow.domain && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Domain</p>
                    <p className="text-sm font-mono break-all">{currentFlow.domain}</p>
                  </div>
                )}
                {currentFlow.httpMethod && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">HTTP Method</p>
                    <Badge variant="outline">{currentFlow.httpMethod}</Badge>
                  </div>
                )}
                {currentFlow.url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">URL</p>
                    <p className="text-sm font-mono break-all text-primary">{currentFlow.url}</p>
                  </div>
                )}
                {currentFlow.userAgent && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                    <p className="text-sm break-all text-muted-foreground">
                      {currentFlow.userAgent}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Geolocation */}
          {(currentFlow.country || currentFlow.city || currentFlow.asn) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={16} />
                  Geolocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {currentFlow.country && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Country</p>
                      <div className="flex items-center gap-2">
                        <Globe size={16} />
                        <p className="text-sm font-semibold">{currentFlow.country}</p>
                      </div>
                    </div>
                  )}
                  {currentFlow.city && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">City</p>
                      <p className="text-sm font-semibold">{currentFlow.city}</p>
                    </div>
                  )}
                  {currentFlow.asn && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ASN</p>
                      <p className="text-sm font-mono">{currentFlow.asn}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DNS Details */}
          {(currentFlow.dnsQueryType || currentFlow.dnsResponseCode) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network size={16} />
                  DNS Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {currentFlow.dnsQueryType && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Query Type</p>
                      <Badge variant="outline">{currentFlow.dnsQueryType}</Badge>
                    </div>
                  )}
                  {currentFlow.dnsResponseCode && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Response Code</p>
                      <Badge
                        variant="outline"
                        className={
                          currentFlow.dnsResponseCode === 'NOERROR'
                            ? 'border-success text-success'
                            : 'border-warning text-warning'
                        }
                      >
                        {currentFlow.dnsResponseCode}
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
