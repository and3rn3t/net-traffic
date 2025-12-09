import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash,
  Database,
  WarningCircle,
  CheckCircle,
  Download,
  Play,
  Stop,
  ArrowClockwise,
  HardDrive,
  Pulse,
} from '@phosphor-icons/react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from '@/lib/formatters';
import { useApiData } from '@/hooks/useApiData';
import { useApiConfig } from '@/hooks/useApiConfig';

interface MaintenancePanelProps {
  readonly className?: string;
}

interface MaintenanceStats {
  database_size?: number;
  total_flows?: number;
  oldest_flow_timestamp?: number;
  retention_days?: number;
  last_cleanup?: number;
  database_file?: string;
  last_vacuum?: number;
}

export function MaintenancePanel({ className }: MaintenancePanelProps) {
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');
  const [customRetentionDays, setCustomRetentionDays] = useState<string>('30');
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';
  const { useRealApi } = useApiConfig();
  const { isCapturing, refresh } = useApiData({
    pollingInterval: 0,
    useWebSocket: false,
  });

  useEffect(() => {
    if (!USE_REAL_API) return;
    refreshStats();
  }, [USE_REAL_API]);

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const days = Number.parseInt(customRetentionDays, 10);
      if (days < 1 || days > 365) {
        toast.error('Invalid retention days', {
          description: 'Retention days must be between 1 and 365',
        });
        return;
      }
      await apiClient.runCleanup(days);
      toast.success('Data cleanup completed successfully', {
        description: `Removed data older than ${days} days`,
      });
      // Refresh stats
      const stats = await apiClient.getMaintenanceStats();
      setMaintenanceStats(stats);
      refresh();
    } catch (error) {
      toast.error('Cleanup failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCleaning(false);
      setShowCleanupDialog(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await apiClient.exportFlows(exportFormat);
      toast.success('Export completed', {
        description: `Flows exported as ${exportFormat.toUpperCase()}`,
      });
      setShowExportDialog(false);
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartCapture = async () => {
    try {
      await apiClient.startCapture();
      toast.success('Packet capture started');
      refresh();
    } catch (error) {
      toast.error('Failed to start capture', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleStopCapture = async () => {
    try {
      await apiClient.stopCapture();
      toast.success('Packet capture stopped');
      refresh();
    } catch (error) {
      toast.error('Failed to stop capture', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      const stats = await apiClient.getMaintenanceStats();
      setMaintenanceStats(stats);
      if (stats.retention_days) {
        setCustomRetentionDays(stats.retention_days.toString());
      }
    } catch (error) {
      console.error('Failed to fetch maintenance stats:', error);
      toast.error('Failed to refresh stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (!USE_REAL_API) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            Maintenance
          </CardTitle>
          <CardDescription>Maintenance features require API connection</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Database Maintenance Card */}
        <Card className={className}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database size={20} />
                  Database Maintenance
                </CardTitle>
                <CardDescription>Manage database storage and cleanup old data</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={refreshStats} disabled={isLoading}>
                <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : maintenanceStats ? (
              <>
                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Database Size</p>
                    <p className="text-2xl font-bold">
                      {maintenanceStats.database_size
                        ? formatBytes(maintenanceStats.database_size)
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Total Flows</p>
                    <p className="text-2xl font-bold">
                      {maintenanceStats.total_flows?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Oldest Flow</p>
                    <p className="text-sm font-medium">
                      {maintenanceStats.oldest_flow_timestamp
                        ? new Date(maintenanceStats.oldest_flow_timestamp).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Retention Info */}
                {maintenanceStats.retention_days && (
                  <div className="p-4 rounded-lg border bg-accent/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Data Retention Policy</p>
                        <p className="text-xs text-muted-foreground">
                          Data older than {maintenanceStats.retention_days} days will be cleaned up
                        </p>
                      </div>
                      <Badge variant="outline">{maintenanceStats.retention_days} days</Badge>
                    </div>
                  </div>
                )}

                {/* Cleanup Action */}
                <div className="p-4 rounded-lg border border-warning/20 bg-warning/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <WarningCircle size={16} />
                        Data Cleanup
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Remove old data to free up storage space
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowCleanupDialog(true)}
                      disabled={isCleaning}
                    >
                      <Trash size={16} className="mr-2" />
                      {isCleaning ? 'Cleaning...' : 'Run Cleanup'}
                    </Button>
                  </div>
                </div>

                {/* Export Data */}
                <div className="p-4 rounded-lg border border-accent/20 bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Download size={16} />
                        Export Data
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Export network flows for analysis or backup
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExportDialog(true)}
                      disabled={isExporting}
                    >
                      <Download size={16} className="mr-2" />
                      {isExporting ? 'Exporting...' : 'Export Flows'}
                    </Button>
                  </div>
                </div>

                {/* Last Cleanup Info */}
                {maintenanceStats.last_cleanup && (
                  <div className="p-3 rounded-lg border bg-success/5">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle size={16} className="text-success" />
                      <span className="text-muted-foreground">Last cleanup:</span>
                      <span className="font-medium">
                        {new Date(maintenanceStats.last_cleanup).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Unable to load maintenance statistics</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capture Control Card */}
        {useRealApi && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pulse size={20} />
                Packet Capture Control
              </CardTitle>
              <CardDescription>Start or stop network packet capture</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Capture Status</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isCapturing ? 'Currently capturing packets' : 'Capture is stopped'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isCapturing ? 'default' : 'secondary'}>
                      {isCapturing ? 'Running' : 'Stopped'}
                    </Badge>
                    {isCapturing ? (
                      <Button variant="destructive" size="sm" onClick={handleStopCapture}>
                        <Stop size={16} className="mr-2" />
                        Stop Capture
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" onClick={handleStartCapture}>
                        <Play size={16} className="mr-2" />
                        Start Capture
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health Card */}
        {maintenanceStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive size={20} />
                System Health
              </CardTitle>
              <CardDescription>Database and system information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Database File</p>
                  <p className="text-sm font-medium">{maintenanceStats.database_file || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Last Vacuum</p>
                  <p className="text-sm font-medium">
                    {maintenanceStats.last_vacuum
                      ? new Date(maintenanceStats.last_vacuum).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Cleanup</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete data older than the specified retention period. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retention-days">Retention Period (days)</Label>
              <Input
                id="retention-days"
                type="number"
                min="1"
                max="365"
                value={customRetentionDays}
                onChange={e => setCustomRetentionDays(e.target.value)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                Data older than this many days will be deleted (1-365 days)
              </p>
            </div>
            {maintenanceStats?.retention_days && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Default retention: {maintenanceStats.retention_days} days
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} disabled={isCleaning}>
              {isCleaning ? 'Cleaning...' : 'Confirm Cleanup'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Network Flows</DialogTitle>
            <DialogDescription>
              Export network flow data for analysis or backup. Choose your preferred format.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">Export Format</Label>
              <Select
                value={exportFormat}
                onValueChange={v => setExportFormat(v as 'json' | 'csv')}
              >
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                  <SelectItem value="json">JSON (Structured data)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {exportFormat === 'csv'
                  ? 'Best for spreadsheet analysis and reporting'
                  : 'Best for programmatic processing and data exchange'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Large exports may take several minutes. The download will
                start automatically when ready.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              <Download size={16} className="mr-2" />
              {isExporting ? 'Exporting...' : 'Export Flows'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
