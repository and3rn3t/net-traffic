import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  className,
}: MetricCardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card
      className={cn(
        'p-4 border border-border/50 hover:border-accent/50 transition-colors',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
          </motion.div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && trendValue && (
            <div className={cn('text-xs mt-2 flex items-center gap-1', trendColors[trend])}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-accent/80 ml-2">{icon}</div>}
      </div>
    </Card>
  );
}
