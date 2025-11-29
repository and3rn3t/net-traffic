import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash, Database, Alert, CheckCircle } from '@phosphor-icons/react';
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
import { formatBytes } from '@/lib/utils';

interface MaintenancePanelProps {
  className?: string;
}

export function MaintenancePanel({ className }: MaintenancePanelProps) {
  const [maintenanceStats, setMaintenanceStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  useEffect(() => {
    if (!USE_REAL_API) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const stats = await apiClient.getMaintenanceStats();
        setMaintenanceStats(stats);
      } catch (error) {
        console.error('Failed to fetch maintenance stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [USE_REAL_API]);

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      await apiClient.runCleanup();
      toast.success('Data cleanup completed successfully');
      // Refresh stats
      const stats = await apiClient.getMaintenanceStats();
      setMaintenanceStats(stats);
    } catch (error) {
      toast.error('Cleanup failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsCleaning(false);
      setShowCleanupDialog(false);
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
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            Database Maintenance
          </CardTitle>
          <CardDescription>Manage database storage and cleanup old data</CardDescription>
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
                      <Alert size={16} />
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

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Cleanup</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete data older than the retention period (
              {maintenanceStats?.retention_days || 'configured'} days). This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} disabled={isCleaning}>
              {isCleaning ? 'Cleaning...' : 'Confirm Cleanup'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
