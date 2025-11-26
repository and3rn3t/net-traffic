import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Funnel, X } from '@phosphor-icons/react';

export interface FlowFilters {
  protocols: string[];
  status: string | null;
  threatLevel: string | null;
  sourceIp: string;
  destIp: string;
  startTime: number | null;
  endTime: number | null;
  minBytes: number | null;
  deviceId: string | null;
  timeRangePreset: '1h' | '24h' | '7d' | '30d' | 'custom' | null;
}

interface FlowFiltersProps {
  filters: FlowFilters;
  onFiltersChange: (filters: FlowFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (preset: FlowFilters) => void;
  savedPresets?: Array<{ name: string; filters: FlowFilters }>;
  devices?: Array<{ id: string; name: string }>;
  availableProtocols?: string[];
}

const THREAT_LEVELS = [
  { value: 'safe', label: 'Safe' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
] as const;

const TIME_PRESETS = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
] as const;

const DEFAULT_PROTOCOLS = [
  'TCP',
  'UDP',
  'HTTP',
  'HTTPS',
  'DNS',
  'QUIC',
  'SSH',
  'MQTT',
  'WebSocket',
  'TLS',
  'ICMP',
];

export function FlowFiltersComponent({
  filters,
  onFiltersChange,
  onApply,
  onClear,
  onSavePreset,
  onLoadPreset,
  savedPresets = [],
  devices = [],
  availableProtocols = DEFAULT_PROTOCOLS,
}: FlowFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FlowFilters>(filters);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilters = (updates: Partial<FlowFilters>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTimePresetChange = (preset: string) => {
    const now = Date.now();
    let startTime: number | null = null;
    const endTime: number | null = null;

    switch (preset) {
      case '1h':
        startTime = now - 60 * 60 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'custom':
        // Keep existing custom times
        break;
    }

    updateFilters({
      timeRangePreset: preset as FlowFilters['timeRangePreset'],
      startTime: preset !== 'custom' ? startTime : localFilters.startTime,
      endTime:
        preset !== 'custom'
          ? preset === 'custom'
            ? localFilters.endTime
            : now
          : localFilters.endTime,
    });
  };

  const handleProtocolToggle = (protocol: string) => {
    const newProtocols = localFilters.protocols.includes(protocol)
      ? localFilters.protocols.filter(p => p !== protocol)
      : [...localFilters.protocols, protocol];
    updateFilters({ protocols: newProtocols });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.protocols.length > 0) count++;
    if (localFilters.status) count++;
    if (localFilters.threatLevel) count++;
    if (localFilters.sourceIp) count++;
    if (localFilters.destIp) count++;
    if (localFilters.startTime || localFilters.endTime) count++;
    if (localFilters.minBytes) count++;
    if (localFilters.deviceId) count++;
    return count;
  };

  const handleClear = () => {
    const clearedFilters: FlowFilters = {
      protocols: [],
      status: null,
      threatLevel: null,
      sourceIp: '',
      destIp: '',
      startTime: null,
      endTime: null,
      minBytes: null,
      deviceId: null,
      timeRangePreset: null,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClear();
  };

  const handleApply = () => {
    onApply();
    setIsOpen(false);
  };

  const handleSavePreset = () => {
    if (presetName.trim() && onSavePreset) {
      onSavePreset(presetName.trim());
      setPresetName('');
      setShowSavePreset(false);
    }
  };

  const activeCount = getActiveFilterCount();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Funnel size={16} />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Funnel size={20} />
            Flow Filters
          </SheetTitle>
          <SheetDescription>
            Filter network flows by protocol, IP address, time range, threat level, and more.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Saved Presets */}
          {savedPresets.length > 0 && (
            <Card className="p-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Saved Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {savedPresets.map((preset, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocalFilters(preset.filters);
                        onFiltersChange(preset.filters);
                        if (onLoadPreset) {
                          onLoadPreset(preset.filters);
                        }
                      }}
                      className="text-xs"
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Time Range */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Time Range</Label>
              <Select
                value={localFilters.timeRangePreset || 'custom'}
                onValueChange={handleTimePresetChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {localFilters.timeRangePreset === 'custom' && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                      Start Time
                    </Label>
                    <Input
                      id="start-time"
                      type="datetime-local"
                      value={
                        localFilters.startTime
                          ? new Date(localFilters.startTime).toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={e => {
                        const timestamp = e.target.value
                          ? new Date(e.target.value).getTime()
                          : null;
                        updateFilters({ startTime: timestamp });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                      End Time
                    </Label>
                    <Input
                      id="end-time"
                      type="datetime-local"
                      value={
                        localFilters.endTime
                          ? new Date(localFilters.endTime).toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={e => {
                        const timestamp = e.target.value
                          ? new Date(e.target.value).getTime()
                          : null;
                        updateFilters({ endTime: timestamp });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Protocol Filter */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Protocols</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableProtocols.map(protocol => (
                  <div key={protocol} className="flex items-center space-x-2">
                    <Checkbox
                      id={`protocol-${protocol}`}
                      checked={localFilters.protocols.includes(protocol)}
                      onCheckedChange={() => handleProtocolToggle(protocol)}
                    />
                    <Label
                      htmlFor={`protocol-${protocol}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {protocol}
                    </Label>
                  </div>
                ))}
              </div>
              {localFilters.protocols.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {localFilters.protocols.map(protocol => (
                    <Badge
                      key={protocol}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => handleProtocolToggle(protocol)}
                    >
                      {protocol}
                      <X size={12} className="ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Status Filter */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Status</Label>
              <Select
                value={localFilters.status || ''}
                onValueChange={value => updateFilters({ status: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Threat Level Filter */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Threat Level</Label>
              <Select
                value={localFilters.threatLevel || ''}
                onValueChange={value => updateFilters({ threatLevel: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All threat levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Threat Levels</SelectItem>
                  {THREAT_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* IP Address Filters */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">IP Addresses</Label>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="source-ip" className="text-xs text-muted-foreground">
                    Source IP
                  </Label>
                  <Input
                    id="source-ip"
                    placeholder="192.168.1.1"
                    value={localFilters.sourceIp}
                    onChange={e => updateFilters({ sourceIp: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dest-ip" className="text-xs text-muted-foreground">
                    Destination IP
                  </Label>
                  <Input
                    id="dest-ip"
                    placeholder="8.8.8.8"
                    value={localFilters.destIp}
                    onChange={e => updateFilters({ destIp: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Device Filter */}
          {devices.length > 0 && (
            <Card className="p-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Device</Label>
                <Select
                  value={localFilters.deviceId || ''}
                  onValueChange={value => updateFilters({ deviceId: value || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All devices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Devices</SelectItem>
                    {devices.map(device => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name || device.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}

          {/* Bandwidth Filter */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label htmlFor="min-bytes" className="text-sm font-semibold">
                Minimum Bandwidth
              </Label>
              <Input
                id="min-bytes"
                type="number"
                placeholder="Minimum bytes (bytes_in + bytes_out)"
                value={localFilters.minBytes || ''}
                onChange={e =>
                  updateFilters({
                    minBytes: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Filter flows with total bytes (in + out) greater than this value
              </p>
            </div>
          </Card>

          <Separator />

          {/* Save Preset */}
          {onSavePreset && (
            <Card className="p-4">
              <div className="space-y-2">
                {!showSavePreset ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setShowSavePreset(true)}
                  >
                    <Funnel size={16} />
                    Save Filter Preset
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Preset name..."
                      value={presetName}
                      onChange={e => setPresetName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSavePreset}
                        disabled={!presetName.trim()}
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowSavePreset(false);
                          setPresetName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClear} className="flex-1 gap-2">
              <X size={16} />
              Clear All
            </Button>
            <Button onClick={handleApply} className="flex-1 gap-2">
              <Funnel size={16} />
              Apply Filters ({activeCount})
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
