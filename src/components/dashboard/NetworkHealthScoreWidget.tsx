/**
 * Network health score widget: single 0-100 score blending connection
 * quality, active threats, and device anomalies, with a factor
 * breakdown on hover.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNetworkHealthScore } from '@/hooks/useNetworkHealthScore';
import { cn } from '@/lib/utils';
import type { Device, Threat } from '@/lib/types';

const SEVERITY_STYLES: Record<string, string> = {
  excellent: 'text-success',
  good: 'text-primary',
  fair: 'text-warning',
  poor: 'text-destructive',
};

const SEVERITY_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

interface NetworkHealthScoreWidgetProps {
  activeThreats: Threat[];
  devices: Device[];
}

export function NetworkHealthScoreWidget({
  activeThreats,
  devices,
}: NetworkHealthScoreWidgetProps) {
  const { score, severity, factors } = useNetworkHealthScore(activeThreats, devices);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-full cursor-help flex-col items-center justify-center gap-1">
          <span className={cn('text-4xl font-bold', SEVERITY_STYLES[severity])}>{score}</span>
          <span className={cn('text-sm font-medium', SEVERITY_STYLES[severity])}>
            {SEVERITY_LABELS[severity]}
          </span>
          <span className="text-xs text-muted-foreground">Network health score</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="space-y-1 text-xs">
          {factors.map(factor => (
            <li key={factor.label}>
              <span className="font-medium">{factor.label}:</span> {factor.detail}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
