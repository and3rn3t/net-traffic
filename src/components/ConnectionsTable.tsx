import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NetworkFlow } from '@/lib/types';
import { formatBytes, formatTimestamp, getThreatColor, getThreatBgColor } from '@/lib/formatters';
import { motion } from 'framer-motion';

interface ConnectionsTableProps {
  flows: NetworkFlow[];
  onFlowSelect?: (flow: NetworkFlow) => void;
}

export function ConnectionsTable({ flows, onFlowSelect }: ConnectionsTableProps) {
  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Active Connections</h3>
          <Badge variant="outline" className="font-mono">
            {flows.filter(f => f.status === 'active').length} active
          </Badge>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {flows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No active connections</p>
              </div>
            ) : (
              flows.map((flow, idx) => (
                <motion.div
                  key={flow.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onFlowSelect?.(flow)}
                  className="p-3 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-accent/5 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {flow.protocol}
                        </Badge>
                        {flow.status === 'active' && (
                          <span className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
                        )}
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {flow.domain || flow.destIp}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        <span className="truncate">
                          {flow.sourceIp}:{flow.sourcePort}
                        </span>
                        <span>→</span>
                        <span className="truncate">
                          {flow.destIp}:{flow.destPort}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">↓ {formatBytes(flow.bytesIn)}</span>
                        <span className="text-muted-foreground">
                          ↑ {formatBytes(flow.bytesOut)}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          {formatTimestamp(flow.timestamp)}
                        </span>
                      </div>
                    </div>

                    <Badge className={getThreatBgColor(flow.threatLevel)}>
                      <span className={getThreatColor(flow.threatLevel)}>{flow.threatLevel}</span>
                    </Badge>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
