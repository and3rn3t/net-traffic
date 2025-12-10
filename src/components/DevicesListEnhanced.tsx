/**
 * Enhanced DevicesList component with device management (edit name, type, notes)
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Device } from '@/lib/types';
import { formatBytes, formatTimestamp, getDeviceIcon } from '@/lib/formatters';
import { Pencil, Check, X, TrendingUp, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { DeviceAnalyticsView } from './DeviceAnalyticsView';

interface DevicesListEnhancedProps {
  readonly devices: Device[];
  readonly onDeviceUpdate?: (device: Device) => void;
  readonly onDeviceSelect?: (device: Device) => void;
  readonly onRefresh?: () => void;
}

const DEVICE_TYPES = [
  'smartphone',
  'laptop',
  'desktop',
  'tablet',
  'iot',
  'server',
  'unknown',
] as const;

export function DevicesListEnhanced({
  devices,
  onDeviceUpdate,
  onDeviceSelect,
  onRefresh,
}: DevicesListEnhancedProps) {
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [analyticsDevice, setAnalyticsDevice] = useState<Device | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  const handleEditClick = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      type: device.type,
      notes: device.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingDevice) return;

    setIsSaving(true);
    try {
      if (USE_REAL_API) {
        // Use API to update device
        const updated = await apiClient.updateDevice(editingDevice.id, {
          name: editForm.name,
          type: editForm.type,
          notes: editForm.notes,
        });

        if (onDeviceUpdate) {
          onDeviceUpdate(updated);
        }
        toast.success('Device updated successfully');
      } else {
        // Mock mode - just update locally via callback
        const updated: Device = {
          ...editingDevice,
          name: editForm.name,
          type: editForm.type as Device['type'],
          behavioral: {
            ...editingDevice.behavioral,
            notes: editForm.notes,
          } as any,
        };
        if (onDeviceUpdate) {
          onDeviceUpdate(updated);
        }
        toast.success('Device updated (mock mode)');
      }
      setEditingDevice(null);
    } catch (error) {
      toast.error('Failed to update device', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingDevice(null);
    setEditForm({ name: '', type: '', notes: '' });
  };

  return (
    <>
      <Card className="p-4 border border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>Network Devices</span>
                <Badge variant="outline" className="font-mono">
                  {devices.length} devices
                </Badge>
                {USE_REAL_API && (
                  <Badge variant="secondary" className="text-xs">
                    API Data
                  </Badge>
                )}
                {!USE_REAL_API && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Mock Data
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {USE_REAL_API
                  ? 'Real devices discovered from network traffic'
                  : 'Manage and monitor devices on your network (mock mode)'}
              </CardDescription>
            </div>
            {USE_REAL_API && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (onRefresh) {
                    onRefresh();
                    toast.success('Refreshing devices...');
                  } else {
                    // Fallback: reload page
                    globalThis.location.reload();
                  }
                }}
                title="Refresh devices from API"
              >
                <RefreshCw size={16} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] sm:h-[500px]">
            <div className="space-y-2">
              {devices.map((device, idx) => {
                const threatPercent = Math.min(device.threatScore, 100);
                const isHighThreat = device.threatScore > 60;
                const notes = device.notes;

                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-3 rounded-lg border border-border/30 hover:border-accent/50 hover:bg-accent/5 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{getDeviceIcon(device.type)}</div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{device.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{device.ip}</p>
                            {notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">{notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {device.type}
                            </Badge>
                            {USE_REAL_API && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setAnalyticsDevice(device);
                                  setAnalyticsOpen(true);
                                  onDeviceSelect?.(device);
                                }}
                                title="View Analytics"
                              >
                                <TrendingUp size={14} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditClick(device)}
                              title="Edit Device"
                            >
                              <Pencil size={14} />
                            </Button>
                          </div>
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
              {devices.length === 0 && (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <p className="font-medium">No devices discovered yet</p>
                  {USE_REAL_API ? (
                    <p className="text-xs">
                      Devices will appear as network traffic is captured. Check that packet capture
                      is running.
                    </p>
                  ) : (
                    <p className="text-xs">Enable API mode to discover real devices</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Device Dialog */}
      <Dialog open={!!editingDevice} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information. Changes will be saved to the backend.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter device name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-type">Device Type</Label>
              <Select
                value={editForm.type}
                onValueChange={value => setEditForm({ ...editForm, type: value })}
              >
                <SelectTrigger id="device-type">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-notes">Notes (Optional)</Label>
              <Textarea
                id="device-notes"
                value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add notes about this device..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !editForm.name.trim()}>
              <Check size={16} className="mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Analytics View */}
      <DeviceAnalyticsView
        device={analyticsDevice}
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
      />
    </>
  );
}
