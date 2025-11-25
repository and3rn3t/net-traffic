import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Device } from '@/lib/types';
import { formatBytes, formatTimestamp, getDeviceIcon } from '@/lib/formatters';
import { motion } from 'framer-motion';

interface DevicesListProps {
  devices: Device[];
  onDeviceSelect?: (device: Device) => void;
}

export function DevicesList({ devices, onDeviceSelect }: DevicesListProps) {
  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Network Devices</h3>
          <Badge variant="outline" className="font-mono">
            {devices.length} devices
          </Badge>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {devices.map((device, idx) => {
              const threatPercent = Math.min(device.threatScore, 100);
              const isHighThreat = device.threatScore > 60;

              return (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => onDeviceSelect?.(device)}
                  className="p-3 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-accent/5 cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getDeviceIcon(device.type)}</div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{device.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{device.ip}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {device.type}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Threat Score</span>
                          <span
                            className={
                              isHighThreat
                                ? 'text-destructive font-medium'
                                : 'text-muted-foreground'
                            }
                          >
                            {device.threatScore.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={threatPercent} className="h-1" />
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatBytes(device.bytesTotal)}</span>
                        <span>•</span>
                        <span>{device.connectionsCount} connections</span>
                        <span>•</span>
                        <span>{formatTimestamp(device.lastSeen)}</span>
                      </div>

                      {device.behavioral.anomalyCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-warning/10 text-warning border-warning/20"
                        >
                          {device.behavioral.anomalyCount} anomalies
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
