/**
 * Enhanced TopSites component using API endpoints
 * Falls back to calculating from flows if API unavailable
 */
import { useState, useEffect } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Globe, RefreshCw } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';

interface TopSitesEnhancedProps {
  flows?: NetworkFlow[]; // Fallback data
  hours?: number;
  limit?: number;
}

export function TopSitesEnhanced({ flows = [], hours = 24, limit = 10 }: TopSitesEnhancedProps) {
  const { topDomains, isLoading, error, fetchTopDomains } = useEnhancedAnalytics({
    autoFetch: true,
    hours,
  });
  const [useApi, setUseApi] = useState(import.meta.env.VITE_USE_REAL_API === 'true');

  // Fallback: calculate from flows if API not available
  const fallbackSites = flows.reduce(
    (acc, flow) => {
      const site = flow.domain || flow.destIp;
      if (!acc[site]) {
        acc[site] = {
          site,
          totalBytes: 0,
          connections: 0,
          uniqueDevices: new Set<string>(),
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
      }
    >
  );

  const fallbackTopSites = Object.values(fallbackSites)
    .map(stat => ({
      domain: stat.site,
      bytes: stat.totalBytes,
      connections: stat.connections,
      unique_devices: stat.uniqueDevices.size,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);

  // Use API data if available, otherwise use fallback
  const sites = useApi && topDomains.length > 0 ? topDomains : fallbackTopSites;
  const maxBytes = sites.length > 0 ? Math.max(...sites.map(s => s.bytes)) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Top Destinations
            </CardTitle>
            <CardDescription>Most accessed sites and services by traffic volume</CardDescription>
          </div>
          {useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchTopDomains(limit, hours)}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && useApi && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}. Falling back to local data.
          </div>
        )}
        <div className="space-y-4">
          {sites.map((site, index) => (
            <div key={site.domain} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent-foreground text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate font-mono text-sm">{site.domain}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{site.connections} connections</span>
                      <span>•</span>
                      <span>{site.unique_devices} devices</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatBytesShort(site.bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytesShort(site.bytes / (site.connections || 1))}/conn
                  </p>
                </div>
              </div>
              <Progress
                value={maxBytes > 0 ? (site.bytes / maxBytes) * 100 : 0}
                className="h-1.5"
              />
            </div>
          ))}
          {sites.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">No site data available</div>
          )}
          {isLoading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}
        </div>
      </CardContent>
    </Card>
  );
}
