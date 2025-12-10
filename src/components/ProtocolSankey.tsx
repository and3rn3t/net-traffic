import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NetworkFlow, Device, ProtocolStats } from '@/lib/types';
import { formatBytesShort } from '@/lib/formatters';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiData } from '@/hooks/useApiData';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtocolSankeyProps {
  readonly flows: NetworkFlow[];
  readonly devices: Device[];
  readonly protocolStats?: ProtocolStats[];
  readonly useApi?: boolean;
}

interface SankeyNode {
  id: string;
  label: string;
  level: number;
  y: number;
  height: number;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

export function ProtocolSankey({
  flows,
  devices,
  protocolStats,
  useApi = false,
}: ProtocolSankeyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { useRealApi } = useApiConfig();
  const { topDevices, isLoading, fetchTopDevices } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours: 24,
  });
  const { protocolStats: apiProtocolStats } = useApiData({
    pollingInterval: 0,
    useWebSocket: false,
  });

  // Prepare data from API or fallback to flows/devices
  const sankeyData = useMemo(() => {
    const deviceFlowMap = new Map<string, Map<string, number>>();
    const protocolThreatMap = new Map<string, Map<string, number>>();

    // Use API data if available
    if (
      useRealApi &&
      useApi &&
      topDevices.length > 0 &&
      (protocolStats || apiProtocolStats).length > 0
    ) {
      const stats = protocolStats || apiProtocolStats;

      // Map top devices to protocols using protocol stats
      topDevices.slice(0, 5).forEach(apiDevice => {
        const deviceId = apiDevice.device_id;
        if (!deviceFlowMap.has(deviceId)) {
          deviceFlowMap.set(deviceId, new Map());
        }
        const protocolMap = deviceFlowMap.get(deviceId)!;

        // Distribute device bytes across protocols based on protocol stats
        const totalProtocolBytes = stats.reduce((sum, s) => sum + s.bytes, 0);
        stats.forEach(stat => {
          const deviceProtocolBytes = (apiDevice.bytes * stat.bytes) / totalProtocolBytes;
          const currentBytes = protocolMap.get(stat.protocol) || 0;
          protocolMap.set(stat.protocol, currentBytes + deviceProtocolBytes);
        });
      });

      // Map protocols to threat levels (estimate from protocol stats)
      stats.forEach(stat => {
        if (!protocolThreatMap.has(stat.protocol)) {
          protocolThreatMap.set(stat.protocol, new Map());
        }
        const threatMap = protocolThreatMap.get(stat.protocol)!;

        // Estimate threat distribution (HTTPS/SSH = safe, HTTP = low, others = medium)
        const threatLevel =
          stat.protocol.toUpperCase().includes('HTTPS') ||
          stat.protocol.toUpperCase().includes('TLS')
            ? 'safe'
            : stat.protocol.toUpperCase() === 'HTTP'
              ? 'low'
              : 'medium';

        const currentBytes = threatMap.get(threatLevel) || 0;
        threatMap.set(threatLevel, currentBytes + stat.bytes);
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        if (!deviceFlowMap.has(flow.deviceId)) {
          deviceFlowMap.set(flow.deviceId, new Map());
        }
        const protocolMap = deviceFlowMap.get(flow.deviceId)!;
        const currentBytes = protocolMap.get(flow.protocol) || 0;
        protocolMap.set(flow.protocol, currentBytes + flow.bytesIn + flow.bytesOut);
      });

      flows.forEach(flow => {
        if (!protocolThreatMap.has(flow.protocol)) {
          protocolThreatMap.set(flow.protocol, new Map());
        }
        const threatMap = protocolThreatMap.get(flow.protocol)!;
        const currentBytes = threatMap.get(flow.threatLevel) || 0;
        threatMap.set(flow.threatLevel, currentBytes + flow.bytesIn + flow.bytesOut);
      });
    }

    return { deviceFlowMap, protocolThreatMap };
  }, [flows, devices, useRealApi, useApi, topDevices, protocolStats, apiProtocolStats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const { deviceFlowMap, protocolThreatMap } = sankeyData;

    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    const levelWidth = rect.width / 4;
    const nodeWidth = 30;
    const padding = 10;

    let deviceY = padding;
    const deviceColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const topDevices = Array.from(deviceFlowMap.entries())
      .sort((a, b) => {
        const sumA = Array.from(a[1].values()).reduce((s, v) => s + v, 0);
        const sumB = Array.from(b[1].values()).reduce((s, v) => s + v, 0);
        return sumB - sumA;
      })
      .slice(0, 5);

    topDevices.forEach(([deviceId, protocolMap], index) => {
      const device = devices.find(d => d.id === deviceId);
      const totalBytes = Array.from(protocolMap.values()).reduce((s, v) => s + v, 0);
      const height = Math.max(20, Math.min(100, Math.log(totalBytes + 1) * 10));

      nodes.push({
        id: deviceId,
        label: device?.name || 'Unknown',
        level: 0,
        y: deviceY,
        height,
        color: deviceColors[index % deviceColors.length],
      });

      protocolMap.forEach((bytes, protocol) => {
        links.push({
          source: deviceId,
          target: protocol,
          value: bytes,
          color: deviceColors[index % deviceColors.length],
        });
      });

      deviceY += height + padding;
    });

    let protocolY = padding;
    const protocolColors: Record<string, string> = {
      HTTPS: '#10b981',
      HTTP: '#3b82f6',
      DNS: '#8b5cf6',
      SSH: '#f59e0b',
      FTP: '#ef4444',
    };

    Array.from(protocolThreatMap.keys())
      .slice(0, 5)
      .forEach(protocol => {
        const threatMap = protocolThreatMap.get(protocol)!;
        const totalBytes = Array.from(threatMap.values()).reduce((s, v) => s + v, 0);
        const height = Math.max(20, Math.min(100, Math.log(totalBytes + 1) * 10));

        nodes.push({
          id: protocol,
          label: protocol,
          level: 1,
          y: protocolY,
          height,
          color: protocolColors[protocol] || '#6b7280',
        });

        threatMap.forEach((bytes, threatLevel) => {
          links.push({
            source: protocol,
            target: threatLevel,
            value: bytes,
            color: protocolColors[protocol] || '#6b7280',
          });
        });

        protocolY += height + padding;
      });

    let threatY = padding;
    const threatColors: Record<string, string> = {
      safe: '#10b981',
      low: '#3b82f6',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444',
    };

    Array.from(new Set(flows.map(f => f.threatLevel))).forEach(threatLevel => {
      const totalBytes = flows
        .filter(f => f.threatLevel === threatLevel)
        .reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
      const height = Math.max(20, Math.min(100, Math.log(totalBytes + 1) * 10));

      nodes.push({
        id: threatLevel,
        label: threatLevel.toUpperCase(),
        level: 2,
        y: threatY,
        height,
        color: threatColors[threatLevel] || '#6b7280',
      });

      threatY += height + padding;
    });

    // Filter links to only include those with valid nodes
    const validLinks = links.filter(
      link => nodes.some(n => n.id === link.source) && nodes.some(n => n.id === link.target)
    );

    validLinks.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);

      if (!sourceNode || !targetNode) return;

      const x1 = levelWidth * sourceNode.level + nodeWidth;
      const y1 = sourceNode.y + sourceNode.height / 2;
      const x2 = levelWidth * targetNode.level;
      const y2 = targetNode.y + targetNode.height / 2;

      const controlPointOffset = (x2 - x1) / 2;

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, link.color + '80');
      gradient.addColorStop(1, link.color + '20');

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + controlPointOffset, y1, x2 - controlPointOffset, y2, x2, y2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(2, Math.log(link.value + 1));
      ctx.stroke();
    });

    nodes.forEach(node => {
      const x = levelWidth * node.level;
      const y = node.y;

      ctx.fillStyle = node.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = node.color;
      ctx.fillRect(x, y, nodeWidth, node.height);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, x + nodeWidth + 8, y + node.height / 2);
    });
  }, [sankeyData, devices]);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-accent" size={20} />
            Protocol Flow Diagram
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Traffic flow from devices through protocols to threat levels
          </p>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] sm:h-[350px] lg:h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="text-accent" size={20} />
              Protocol Flow Diagram
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Traffic flow from devices through protocols to threat levels
            </p>
          </div>
          {useRealApi && useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchTopDevices(24, 10)}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg bg-background/50"
            style={{ height: 'clamp(250px, 40vh, 400px)' }}
          />
          <div className="absolute top-4 left-6 flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">DEVICES</span>
          </div>
          <div className="absolute top-4 left-1/3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">PROTOCOLS</span>
          </div>
          <div className="absolute top-4 left-2/3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">THREAT LEVEL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
