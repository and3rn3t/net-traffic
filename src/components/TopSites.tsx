import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Globe, ShieldCheck, Warning } from '@phosphor-icons/react';

interface TopSitesProps {
  flows: NetworkFlow[];
}

export function TopSites({ flows }: TopSitesProps) {
  const siteStats = flows.reduce(
    (acc, flow) => {
      const site = flow.domain || flow.destIp;
      if (!acc[site]) {
        acc[site] = {
          site,
          totalBytes: 0,
          connections: 0,
          uniqueDevices: new Set<string>(),
          protocol: flow.protocol,
          threatLevel: flow.threatLevel,
          country: flow.country,
        };
      }
      acc[site].totalBytes += flow.bytesIn + flow.bytesOut;
      acc[site].connections++;
      acc[site].uniqueDevices.add(flow.deviceId);
      return acc;
    },
    {} as Record<
      string,
      {
        site: string;
        totalBytes: number;
        connections: number;
        uniqueDevices: Set<string>;
        protocol: string;
        threatLevel: string;
        country?: string;
      }
    >
  );

  const topSites = Object.values(siteStats)
    .map(stat => ({
      ...stat,
      uniqueDeviceCount: stat.uniqueDevices.size,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 10);

  const maxBytes = Math.max(...topSites.map(s => s.totalBytes));

  const getThreatBadge = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return (
          <Badge variant="destructive" className="text-xs">
            Risk
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="text-xs border-warning text-warning">
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="text-xs">
            Low
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs border-success text-success">
            Safe
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe size={20} />
          Top Destinations
        </CardTitle>
        <CardDescription>Most accessed sites and services by traffic volume</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topSites.map((stat, index) => (
            <div key={stat.site} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent-foreground text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate font-mono text-sm">{stat.site}</p>
                      {getThreatBadge(stat.threatLevel)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{stat.protocol}</span>
                      <span>•</span>
                      <span>{stat.connections} connections</span>
                      <span>•</span>
                      <span>{stat.uniqueDeviceCount} devices</span>
                      {stat.country && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{stat.country}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatBytesShort(stat.totalBytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytesShort(stat.totalBytes / stat.connections)}/conn
                  </p>
                </div>
              </div>
              <Progress value={(stat.totalBytes / maxBytes) * 100} className="h-1.5" />
            </div>
          ))}
          {topSites.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No site data available</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
