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
        'p-3 sm:p-4 border border-border/60 bg-card/50 hover:border-accent/70 hover:bg-card/70 transition-all duration-200 shadow-sm',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground/90 truncate">
            {title}
          </p>
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 sm:mt-2"
          >
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight break-words text-foreground">
              {value}
            </p>
          </motion.div>
          {subtitle && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={cn('text-xs mt-1 sm:mt-2 flex items-center gap-1', trendColors[trend])}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span className="truncate">{trendValue}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-accent/80 ml-2 flex-shrink-0">{icon}</div>}
      </div>
    </Card>
  );
}
