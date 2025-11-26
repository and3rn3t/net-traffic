/**
 * Enhanced GeographicDistribution component using API endpoints
 */
import { useState } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { Globe, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';

interface GeographicDistributionEnhancedProps {
  flows?: NetworkFlow[]; // Fallback data
  hours?: number;
}

export function GeographicDistributionEnhanced({
  flows = [],
  hours = 24,
}: GeographicDistributionEnhancedProps) {
  const { geographicStats, isLoading, error, fetchGeographicStats } = useEnhancedAnalytics({
    autoFetch: true,
    hours,
  });
  const [useApi] = useState(import.meta.env.VITE_USE_REAL_API === 'true');

  // Fallback: calculate from flows
  const fallbackStats = flows.reduce(
    (acc, flow) => {
      if (!flow.country) return acc;
      if (!acc[flow.country]) {
        acc[flow.country] = {
          country: flow.country,
          connections: 0,
          bytes: 0,
          threats: 0,
        };
      }
      acc[flow.country].connections++;
      acc[flow.country].bytes += flow.bytesIn + flow.bytesOut;
      if (flow.threatLevel in ['medium', 'high', 'critical']) {
        acc[flow.country].threats++;
      }
      return acc;
    },
    {} as Record<string, { country: string; connections: number; bytes: number; threats: number }>
  );

  const fallbackGeographic = Object.values(fallbackStats).sort(
    (a, b) => b.connections - a.connections
  );

  // Use API data if available, otherwise use fallback
  const stats = useApi && geographicStats.length > 0 ? geographicStats : fallbackGeographic;
  const maxConnections = stats.length > 0 ? Math.max(...stats.map(s => s.connections)) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Geographic Distribution
            </CardTitle>
            <CardDescription>Network connections by country</CardDescription>
          </div>
          {useApi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchGeographicStats(hours)}
              disabled={isLoading}
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
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
          {stats.map(stat => (
            <div key={stat.country} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent-foreground text-sm font-semibold font-mono">
                    {stat.country}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{stat.country}</p>
                      {stat.threats > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {stat.threats} threats
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{stat.connections} connections</span>
                      <span>•</span>
                      <span>{formatBytesShort(stat.bytes)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <Progress
                value={maxConnections > 0 ? (stat.connections / maxConnections) * 100 : 0}
                className="h-1.5"
              />
            </div>
          ))}
          {stats.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No geographic data available
            </div>
          )}
          {isLoading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}
        </div>
      </CardContent>
    </Card>
  );
}
