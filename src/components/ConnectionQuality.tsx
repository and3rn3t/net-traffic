import { useMemo } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Warning, XCircle, Gauge } from '@phosphor-icons/react';

interface ConnectionQualityProps {
  flows: NetworkFlow[];
}

export function ConnectionQuality({ flows }: ConnectionQualityProps) {
  const metrics = useMemo(() => {
    const activeFlows = flows.filter(f => f.status === 'active');
    const closedFlows = flows.filter(f => f.status === 'closed');

    const avgDuration = flows.reduce((sum, f) => sum + f.duration, 0) / (flows.length || 1);
    const avgPacketSize =
      flows.reduce((sum, f) => {
        const totalPackets = f.packetsIn + f.packetsOut;
        const totalBytes = f.bytesIn + f.bytesOut;
        return sum + (totalPackets > 0 ? totalBytes / totalPackets : 0);
      }, 0) / (flows.length || 1);

    const retransmissionRate =
      (flows.reduce((sum, f) => {
        const expectedPackets = f.packetsIn + f.packetsOut;
        const actualEfficiency =
          expectedPackets > 0 ? (f.bytesIn + f.bytesOut) / expectedPackets : 1;
        return sum + (actualEfficiency < 1000 ? 1 : 0);
      }, 0) /
        (flows.length || 1)) *
      100;

    const protocolEfficiency = flows.reduce(
      (acc, f) => {
        if (!acc[f.protocol]) {
          acc[f.protocol] = { total: 0, efficient: 0 };
        }
        acc[f.protocol].total++;
        if (f.duration < 10000 && f.bytesIn + f.bytesOut > 1000) {
          acc[f.protocol].efficient++;
        }
        return acc;
      },
      {} as Record<string, { total: number; efficient: number }>
    );

    const qualityScore = Math.max(
      0,
      Math.min(
        100,
        (activeFlows.length / flows.length) * 30 +
          (Math.min(avgDuration / 1000, 60) / 60) * 20 +
          (100 - retransmissionRate) * 0.3 +
          (avgPacketSize > 500 ? 20 : (avgPacketSize / 500) * 20)
      )
    );

    const connectionStability = (activeFlows.length / (flows.length || 1)) * 100;
    const avgBandwidthUtilization =
      flows.reduce((sum, f) => {
        const throughput = f.duration > 0 ? (f.bytesIn + f.bytesOut) / (f.duration / 1000) : 0;
        return sum + throughput;
      }, 0) / (flows.length || 1);

    return {
      qualityScore: Math.round(qualityScore),
      activeConnections: activeFlows.length,
      closedConnections: closedFlows.length,
      avgDuration: Math.round(avgDuration),
      avgPacketSize: Math.round(avgPacketSize),
      retransmissionRate: retransmissionRate.toFixed(2),
      connectionStability: connectionStability.toFixed(1),
      avgBandwidthUtilization: Math.round(avgBandwidthUtilization),
      protocolEfficiency,
    };
  }, [flows]);

  const getQualityBadge = (score: number) => {
    if (score >= 80)
      return {
        label: 'Excellent',
        variant: 'default' as const,
        icon: <CheckCircle size={16} className="text-success" />,
      };
    if (score >= 60)
      return {
        label: 'Good',
        variant: 'secondary' as const,
        icon: <CheckCircle size={16} className="text-success" />,
      };
    if (score >= 40)
      return {
        label: 'Fair',
        variant: 'outline' as const,
        icon: <Warning size={16} className="text-warning" />,
      };
    return {
      label: 'Poor',
      variant: 'destructive' as const,
      icon: <XCircle size={16} className="text-destructive" />,
    };
  };

  const quality = getQualityBadge(metrics.qualityScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge size={20} />
          Connection Quality
        </CardTitle>
        <CardDescription>Overall network performance and connection health metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Overall Quality Score</p>
            <div className="flex items-center gap-3">
              <p className="text-4xl font-bold">{metrics.qualityScore}</p>
              <div className="flex items-center gap-2">
                {quality.icon}
                <Badge variant={quality.variant}>{quality.label}</Badge>
              </div>
            </div>
          </div>
          <div className="w-32 h-32">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={
                  metrics.qualityScore >= 80
                    ? 'hsl(var(--success))'
                    : metrics.qualityScore >= 60
                      ? 'hsl(var(--primary))'
                      : metrics.qualityScore >= 40
                        ? 'hsl(var(--warning))'
                        : 'hsl(var(--destructive))'
                }
                strokeWidth="8"
                strokeDasharray={`${metrics.qualityScore * 2.51} 251`}
                strokeLinecap="round"
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dy="7"
                fontSize="20"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
                className="transform rotate-90"
                style={{ transformOrigin: '50% 50%' }}
              >
                {metrics.qualityScore}
              </text>
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Connection Stability</p>
            <p className="text-xl font-bold">{metrics.connectionStability}%</p>
            <Progress value={parseFloat(metrics.connectionStability)} className="h-1.5" />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Active Connections</p>
            <p className="text-xl font-bold">{metrics.activeConnections}</p>
            <p className="text-xs text-muted-foreground">{metrics.closedConnections} closed</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="text-xl font-bold">{(metrics.avgDuration / 1000).toFixed(1)}s</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Avg Packet Size</p>
            <p className="text-xl font-bold">{metrics.avgPacketSize} B</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Retransmission Rate</p>
            <p className="text-xl font-bold">{metrics.retransmissionRate}%</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Avg Throughput</p>
            <p className="text-xl font-bold">
              {(metrics.avgBandwidthUtilization / 1024).toFixed(0)} KB/s
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Protocol Efficiency</p>
          {Object.entries(metrics.protocolEfficiency)
            .slice(0, 5)
            .map(([protocol, stats]) => {
              const efficiency = (stats.efficient / stats.total) * 100;
              return (
                <div key={protocol} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{protocol}</span>
                    <span className="text-muted-foreground">
                      {efficiency.toFixed(0)}% efficient
                    </span>
                  </div>
                  <Progress value={efficiency} className="h-1" />
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
