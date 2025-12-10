import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { formatBytesShort } from '@/lib/formatters';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';
import { useApiConfig } from '@/hooks/useApiConfig';

interface BandwidthGaugeProps {
  readonly currentBytes: number;
  readonly maxBytes?: number;
  readonly label?: string;
  readonly useApi?: boolean;
}

export function BandwidthGauge({
  currentBytes,
  maxBytes,
  label = 'Current Throughput',
  useApi = false,
}: BandwidthGaugeProps) {
  const { useRealApi } = useApiConfig();
  const { summaryStats } = useEnhancedAnalytics({
    autoFetch: useApi && useRealApi,
    hours: 24,
  });

  // Use API data if available
  const totalBytes = useRealApi && useApi && summaryStats ? summaryStats.total_bytes : currentBytes;
  const calculatedMaxBytes = maxBytes || totalBytes * 1.5;
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const centerY = rect.height / 2 + 20;
    const radius = Math.min(rect.width, rect.height) / 2 - 40;
    const lineWidth = 20;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const percentage = Math.min(totalBytes / calculatedMaxBytes, 1);

    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = 'oklch(0.30 0.01 250)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const gradient = ctx.createConicGradient(startAngle, centerX, centerY);
    if (percentage > 0.8) {
      gradient.addColorStop(0, 'oklch(0.55 0.20 25)');
      gradient.addColorStop(0.5, 'oklch(0.70 0.15 75)');
      gradient.addColorStop(1, 'oklch(0.55 0.20 25)');
    } else if (percentage > 0.5) {
      gradient.addColorStop(0, 'oklch(0.70 0.15 75)');
      gradient.addColorStop(1, 'oklch(0.65 0.15 200)');
    } else {
      gradient.addColorStop(0, 'oklch(0.65 0.15 200)');
      gradient.addColorStop(1, 'oklch(0.55 0.15 145)');
    }

    const currentAngle = startAngle + (endAngle - startAngle) * percentage;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, currentAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 15;
    ctx.shadowColor = percentage > 0.8 ? 'oklch(0.55 0.20 25)' : 'oklch(0.65 0.15 200)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / 10);
      const innerRadius = radius - lineWidth / 2 - 8;
      const outerRadius = radius - lineWidth / 2 - 3;

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatBytesShort(totalBytes), centerX, centerY - 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(
      `${(percentage * 100).toFixed(1)}% of ${formatBytesShort(calculatedMaxBytes)}`,
      centerX,
      centerY + 20
    );
  }, [totalBytes, calculatedMaxBytes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="text-accent" size={20} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} className="w-full" style={{ height: '250px' }} />
      </CardContent>
    </Card>
  );
}
