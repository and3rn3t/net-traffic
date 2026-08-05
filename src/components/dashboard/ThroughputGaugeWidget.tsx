/**
 * Live throughput gauge widget: hand-rolled SVG semicircle gauge with a
 * peak-hold marker.
 */
import { useThroughputGauge } from '@/hooks/useThroughputGauge';
import { formatRate } from '@/lib/formatters';

const WIDTH = 200;
const HEIGHT = 120;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT - 10;
const RADIUS = 80;
const STROKE_WIDTH = 14;
const MIN_SCALE_BYTES_PER_SEC = 1_000_000; // 1 MB/s floor so an idle gauge isn't pegged at 100%

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function ThroughputGaugeWidget() {
  const { bytesPerSecond, peakBytesPerSecond } = useThroughputGauge();

  const maxScale = Math.max(peakBytesPerSecond * 1.2, MIN_SCALE_BYTES_PER_SEC);
  const valueFraction = Math.min(bytesPerSecond / maxScale, 1);
  const peakFraction = Math.min(peakBytesPerSecond / maxScale, 1);

  const backgroundPath = describeArc(CENTER_X, CENTER_Y, RADIUS, 0, 180);
  const valuePath = describeArc(CENTER_X, CENTER_Y, RADIUS, 0, valueFraction * 180);
  const peakPoint = polarToCartesian(CENTER_X, CENTER_Y, RADIUS, peakFraction * 180);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-56"
        role="img"
        aria-label="Live throughput gauge"
      >
        <path
          d={backgroundPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-muted-foreground/20"
        />
        <path
          d={valuePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-primary"
        />
        {peakBytesPerSecond > 0 && (
          <circle
            cx={peakPoint.x}
            cy={peakPoint.y}
            r={5}
            fill="currentColor"
            className="text-warning"
          />
        )}
      </svg>
      <p className="text-lg font-semibold">{formatRate(bytesPerSecond)}</p>
      <p className="text-xs text-muted-foreground">Peak: {formatRate(peakBytesPerSecond)}</p>
    </div>
  );
}
