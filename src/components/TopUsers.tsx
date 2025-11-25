import { Device, NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatBytesShort } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DeviceMobile, TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

interface TopUsersProps {
  devices: Device[];
  flows: NetworkFlow[];
}

export function TopUsers({ devices, flows }: TopUsersProps) {
  const deviceStats = devices.map(device => {
    const deviceFlows = flows.filter(f => f.deviceId === device.id);
    const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
    const totalConnections = deviceFlows.length;
    const recentActivity = deviceFlows.filter(f => Date.now() - f.timestamp < 3600000).length;

    return {
      device,
      totalBytes,
      totalConnections,
      recentActivity,
      bytesPerConnection: totalConnections > 0 ? totalBytes / totalConnections : 0,
    };
  });

  deviceStats.sort((a, b) => b.totalBytes - a.totalBytes);
  const topUsers = deviceStats.slice(0, 10);
  const maxBytes = Math.max(...topUsers.map(u => u.totalBytes));

  const getTrendIcon = (recentActivity: number) => {
    if (recentActivity > 10) return <TrendUp className="text-success" size={16} />;
    if (recentActivity < 3) return <TrendDown className="text-muted-foreground" size={16} />;
    return <Minus className="text-muted-foreground" size={16} />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DeviceMobile size={20} />
          Top Users by Traffic
        </CardTitle>
        <CardDescription>Devices ranked by total data consumption</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topUsers.map((stat, index) => (
            <div key={stat.device.id} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{stat.device.name}</p>
                      {getTrendIcon(stat.recentActivity)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{stat.device.ip}</span>
                      <span>•</span>
                      <span>{stat.totalConnections} connections</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatBytesShort(stat.totalBytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytesShort(stat.bytesPerConnection)}/conn
                  </p>
                </div>
              </div>
              <Progress value={(stat.totalBytes / maxBytes) * 100} className="h-1.5" />
            </div>
          ))}
          {topUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No user data available</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
