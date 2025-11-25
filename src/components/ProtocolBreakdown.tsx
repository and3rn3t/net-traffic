import { Card } from '@/components/ui/card';
import { ProtocolStats } from '@/lib/types';
import { formatBytes } from '@/lib/formatters';
import { motion } from 'framer-motion';

interface ProtocolBreakdownProps {
  data: ProtocolStats[];
}

export function ProtocolBreakdown({ data }: ProtocolBreakdownProps) {
  const colors = [
    'bg-accent',
    'bg-primary',
    'bg-success',
    'bg-warning',
    'bg-destructive',
    'bg-secondary',
    'bg-muted',
  ];

  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Protocol Distribution</h3>

        <div className="space-y-3">
          {data.map((stat, idx) => (
            <motion.div
              key={stat.protocol}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stat.protocol}</span>
                <span className="text-muted-foreground font-mono">
                  {stat.percentage.toFixed(1)}%
                </span>
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.percentage}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className={`h-full ${colors[idx % colors.length]} rounded-full`}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(stat.bytes)}</span>
                <span>{stat.connections.toLocaleString()} connections</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
}
