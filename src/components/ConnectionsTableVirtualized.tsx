/**
 * Virtualized version of ConnectionsTable for better performance with large lists
 * Uses react-window for efficient rendering of 1000+ items
 */
import { memo, useMemo } from 'react';

// @ts-expect-error - react-window types may not be properly resolved
import { FixedSizeList } from 'react-window';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NetworkFlow } from '@/lib/types';
import { formatBytes, formatTimestamp, getThreatColor, getThreatBgColor } from '@/lib/formatters';
import { motion } from 'framer-motion';

interface ConnectionsTableVirtualizedProps {
  flows: NetworkFlow[];
  onFlowSelect?: (flow: NetworkFlow) => void;
  height?: number;
}

// Memoized row component for better performance
const FlowRow = memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: { flows: NetworkFlow[]; onFlowSelect?: (flow: NetworkFlow) => void };
  }) => {
    const flow = data.flows[index];
    if (!flow) return null;

    return (
      <div style={style}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => data.onFlowSelect?.(flow)}
          className="p-3 mx-2 mb-2 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-accent/5 cursor-pointer transition-all"
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
                <span className="text-muted-foreground">↑ {formatBytes(flow.bytesOut)}</span>
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
      </div>
    );
  }
);

FlowRow.displayName = 'FlowRow';

export function ConnectionsTableVirtualized({
  flows,
  onFlowSelect,
  height = 400,
}: ConnectionsTableVirtualizedProps) {
  const activeCount = useMemo(() => flows.filter(f => f.status === 'active').length, [flows]);

  // Prepare data for virtual list
  const listData = useMemo(
    () => ({
      flows,
      onFlowSelect,
    }),
    [flows, onFlowSelect]
  );

  if (flows.length === 0) {
    return (
      <Card className="p-4 border border-border/50">
        <div className="text-center py-12 text-muted-foreground">
          <p>No connections found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Network Connections</h3>
          <Badge variant="outline" className="font-mono">
            {flows.length} total • {activeCount} active
          </Badge>
        </div>

        <div className="border border-border/30 rounded-lg overflow-hidden">
          <FixedSizeList
            height={height}
            itemCount={flows.length}
            itemSize={120} // Estimated height per item
            itemData={listData}
            width="100%"
            overscanCount={5} // Render 5 extra items outside viewport for smooth scrolling
          >
            {FlowRow}
          </FixedSizeList>
        </div>
      </div>
    </Card>
  );
}
