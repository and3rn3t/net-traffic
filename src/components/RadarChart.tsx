import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartPolar, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Device } from '@/lib/types';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface RadarChartProps {
  readonly devices: Device[];
  readonly useApi?: boolean;
}

export function RadarChart({ devices, useApi = false }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { useRealApi } = useApiConfig();
  const { summaryStats, topDevices, isLoading, fetchSummaryStats, fetchTopDevices } =
    useEnhancedAnalytics({
      autoFetch: useApi && useRealApi,
      hours: 24,
    });

  // Calculate metrics from API data or fallback to devices
  const metrics = useMemo(() => {
    let totalDevices: number;
    let totalConnections: number;
    let avgThreatScore: number;
    let totalBytes: number;
    let avgAnomalies: number;
    let diversityScore: number;

    if (useRealApi && useApi && summaryStats && topDevices.length > 0) {
      // Use API data
      totalDevices = summaryStats.total_devices;
      totalConnections = summaryStats.total_flows;
      totalBytes = summaryStats.total_bytes;

      // Calculate average threat score from top devices
      const devicesWithThreats = topDevices.filter(d => d.threats > 0);
      avgThreatScore =
        devicesWithThreats.length > 0
          ? (devicesWithThreats.reduce((sum, d) => sum + d.threats, 0) /
              devicesWithThreats.length) *
            10
          : 0;

      // Estimate anomalies from threats
      avgAnomalies = summaryStats.total_threats / (totalDevices || 1);

      // Calculate diversity from device types
      const deviceTypes = new Set(topDevices.map(d => d.device_type));
      diversityScore = deviceTypes.size * 20;
    } else {
      // Fallback: calculate from devices
      totalDevices = devices.length;
      totalConnections = devices.reduce((sum, d) => sum + d.connectionsCount, 0);
      avgThreatScore = devices.reduce((sum, d) => sum + d.threatScore, 0) / (totalDevices || 1);
      totalBytes = devices.reduce((sum, d) => sum + d.bytesTotal, 0);
      avgAnomalies =
        devices.reduce((sum, d) => sum + d.behavioral.anomalyCount, 0) / (totalDevices || 1);
      diversityScore = new Set(devices.map(d => d.type)).size * 20;
    }

    return [
      { label: 'Devices', value: totalDevices, max: 20 },
      { label: 'Connections', value: totalConnections, max: 500 },
      { label: 'Threat', value: avgThreatScore, max: 100 },
      { label: 'Volume', value: Math.log(totalBytes + 1) * 10, max: 100 },
      { label: 'Anomalies', value: avgAnomalies, max: 10 },
      { label: 'Diversity', value: diversityScore, max: 100 },
    ];
  }, [devices, useRealApi, useApi, summaryStats, topDevices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 2 - 60;

    const radarMetrics = metrics;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const numMetrics = radarMetrics.length;
    const angleStep = (Math.PI * 2) / numMetrics;

    for (let i = 1; i <= 5; i++) {
      const r = (radius / 5) * i;
      ctx.beginPath();
      for (let j = 0; j <= numMetrics; j++) {
        const angle = j * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + i * 0.05})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let i = 0; i < numMetrics; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.beginPath();
    radarMetrics.forEach((metric, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const normalizedValue = Math.min(metric.value / metric.max, 1);
      const r = radius * normalizedValue;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(100, 200, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(100, 200, 255, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    radarMetrics.forEach((metric, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const normalizedValue = Math.min(metric.value / metric.max, 1);
      const r = radius * normalizedValue;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 200, 255, 1)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    radarMetrics.forEach((metric, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const labelRadius = radius + 30;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(metric.label, x, y);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '9px Inter, sans-serif';
      const percentage = ((metric.value / metric.max) * 100).toFixed(0);
      ctx.fillText(`${percentage}%`, x, y + 14);
    });
  }, [metrics]);

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartPolar className="text-accent" size={20} />
            Network Health Radar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Multi-dimensional network health assessment
          </p>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
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
              <ChartPolar className="text-accent" size={20} />
              Network Health Radar
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Multi-dimensional network health assessment
            </p>
          </div>
          {useRealApi && useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchSummaryStats();
                fetchTopDevices(24, 10);
              }}
              disabled={isLoading}
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} className="w-full" style={{ height: '400px' }} />
      </CardContent>
    </Card>
  );
}
