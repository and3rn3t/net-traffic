import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { NetworkFlow, Device } from '@/lib/types';
import { formatBytes, formatTimestamp, getThreatColor, getThreatBgColor } from '@/lib/formatters';
import { motion } from 'framer-motion';
import { FlowFiltersComponent, FlowFilters } from './FlowFilters';
import { useFlowFilters } from '@/hooks/useFlowFilters';
import { Download } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { ConnectionsTableVirtualized } from './ConnectionsTableVirtualized';
import { FlowDetailView } from './FlowDetailView';

interface ConnectionsTableEnhancedProps {
  flows: NetworkFlow[];
  devices?: Device[];
  onFlowSelect?: (flow: NetworkFlow) => void;
  useApiFilters?: boolean; // If true, uses API filtering. If false, uses client-side filtering
  useVirtualization?: boolean; // If true, uses virtual scrolling for large lists (1000+ items)
  virtualizationThreshold?: number; // Number of items before switching to virtualization
}

export function ConnectionsTableEnhanced({
  flows: initialFlows,
  devices = [],
  onFlowSelect,
  useApiFilters = true,
  useVirtualization = true,
  virtualizationThreshold = 100,
}: ConnectionsTableEnhancedProps) {
  const {
    filters,
    filteredFlows,
    isLoading,
    error,
    savedPresets,
    updateFilters,
    clearFilters,
    applyFilters,
    savePreset,
    loadPreset,
  } = useFlowFilters({
    autoFetch: useApiFilters,
    devices: devices.map(d => ({ id: d.id, name: d.name })),
  });

  // Determine which flows to display
  const displayFlows = useApiFilters ? filteredFlows : initialFlows;

  // Decide whether to use virtualization based on flow count
  const shouldVirtualize = useVirtualization && displayFlows.length >= virtualizationThreshold;

  // Get unique protocols from flows for filter options
  const availableProtocols = Array.from(new Set(initialFlows.map(f => f.protocol))).sort();

  const handleExportFiltered = async () => {
    try {
      await apiClient.exportFlows(
        'csv',
        filters.startTime || undefined,
        filters.endTime || undefined,
        filters.deviceId || undefined
      );
      toast.success('Export started');
    } catch (err) {
      toast.error('Failed to export flows');
      console.error('Export error:', err);
    }
  };

  const activeCount = displayFlows.filter(f => f.status === 'active').length;
  const [selectedFlow, setSelectedFlow] = useState<NetworkFlow | null>(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  const handleFlowClick = (flow: NetworkFlow) => {
    setSelectedFlow(flow);
    setDetailViewOpen(true);
    onFlowSelect?.(flow);
  };

  return (
    <Card className="p-4 border border-border/60 bg-card/50 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold">Network Connections</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {displayFlows.length} total
            </Badge>
            <Badge variant="outline" className="font-mono">
              {activeCount} active
            </Badge>
            {useApiFilters && (
              <>
                <FlowFiltersComponent
                  filters={filters}
                  onFiltersChange={updateFilters}
                  onApply={applyFilters}
                  onClear={clearFilters}
                  onSavePreset={savePreset}
                  onLoadPreset={loadPreset}
                  savedPresets={savedPresets}
                  devices={devices.map(d => ({ id: d.id, name: d.name }))}
                  availableProtocols={availableProtocols}
                />
                {(filters.protocols.length > 0 ||
                  filters.status ||
                  filters.threatLevel ||
                  filters.sourceIp ||
                  filters.destIp ||
                  filters.startTime ||
                  filters.endTime ||
                  filters.minBytes ||
                  filters.deviceId) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportFiltered}
                    className="gap-2"
                  >
                    <Download size={16} />
                    Export
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {useApiFilters && error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
            <Button variant="ghost" size="sm" onClick={applyFilters} className="ml-2 h-auto py-1">
              Retry
            </Button>
          </div>
        )}

        {useApiFilters && isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Loading filtered connections...</p>
          </div>
        )}

        {!useApiFilters && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            Note: Client-side filtering mode. Use API filters for better performance with large
            datasets.
          </div>
        )}

        {shouldVirtualize ? (
          <ConnectionsTableVirtualized
            flows={displayFlows}
            onFlowSelect={onFlowSelect}
            height={400}
          />
        ) : (
          <ScrollArea className="h-[300px] sm:h-[400px]">
            <div className="space-y-2">
              {displayFlows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{useApiFilters && isLoading ? 'Loading...' : 'No connections found'}</p>
                  {useApiFilters && !isLoading && (
                    <p className="text-xs mt-2">Try adjusting your filters</p>
                  )}
                </div>
              ) : (
                displayFlows.map((flow, idx) => (
                  <motion.div
                    key={flow.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handleFlowClick(flow)}
                    className="p-3 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-accent/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-mono">
                            {flow.protocol}
                          </Badge>
                          {flow.application && (
                            <Badge variant="secondary" className="text-xs">
                              {flow.application}
                            </Badge>
                          )}
                          {flow.status === 'active' && (
                            <span className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
                          )}
                          {flow.connectionState && (
                            <Badge variant="outline" className="text-xs">
                              {flow.connectionState}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            {flow.sni || flow.domain || flow.destIp}
                          </span>
                          {flow.country && (
                            <Badge variant="outline" className="text-xs">
                              {flow.country}
                              {flow.city && `, ${flow.city}`}
                            </Badge>
                          )}
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

                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className="text-muted-foreground">
                            ↓ {formatBytes(flow.bytesIn)}
                          </span>
                          <span className="text-muted-foreground">
                            ↑ {formatBytes(flow.bytesOut)}
                          </span>
                          {flow.rtt && (
                            <span className="text-muted-foreground" title="Round-trip time">
                              RTT: {flow.rtt}ms
                            </span>
                          )}
                          {flow.jitter && (
                            <span className="text-muted-foreground" title="Network jitter">
                              Jitter: {flow.jitter.toFixed(1)}ms
                            </span>
                          )}
                          {flow.retransmissions !== undefined && flow.retransmissions > 0 && (
                            <span className="text-warning" title="Retransmissions">
                              ⚠ Retrans: {flow.retransmissions}
                            </span>
                          )}
                          {flow.tcpFlags && flow.tcpFlags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {flow.tcpFlags.map(flag => (
                                <Badge
                                  key={flag}
                                  variant="outline"
                                  className={`text-xs ${
                                    flag === 'RST'
                                      ? 'border-destructive text-destructive'
                                      : flag === 'SYN'
                                        ? 'border-primary text-primary'
                                        : flag === 'ACK'
                                          ? 'border-success text-success'
                                          : ''
                                  }`}
                                >
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          )}
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
        )}

        {/* Flow Detail View */}
        <FlowDetailView
          flow={selectedFlow}
          open={detailViewOpen}
          onOpenChange={setDetailViewOpen}
        />
      </div>
    </Card>
  );
}
