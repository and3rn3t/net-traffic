import { useMemo } from 'react';
import { NetworkFlow, ProtocolStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBar, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useApiConfig } from '@/hooks/useApiConfig';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtocolTimelineProps {
  readonly flows: NetworkFlow[];
  readonly protocolStats?: ProtocolStats[];
  readonly useApi?: boolean;
}

export function ProtocolTimeline({ flows, protocolStats, useApi = false }: ProtocolTimelineProps) {
  const { useRealApi } = useApiConfig();
  const { protocolStats: apiProtocolStats, isLoading } = useApiData({
    pollingInterval: 0, // Don't poll, just use initial data
    useWebSocket: false,
  });

  // Use API protocol stats if available, otherwise calculate from flows
  const data = useMemo(() => {
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      HTTPS: 0,
      HTTP: 0,
      DNS: 0,
      QUIC: 0,
      Other: 0,
    }));

    // If we have API protocol stats, distribute them evenly across hours for visualization
    // (Note: Protocol stats don't have hourly breakdown, so we show overall distribution)
    if (useRealApi && useApi && (protocolStats || apiProtocolStats).length > 0) {
      const stats = protocolStats || apiProtocolStats;
      const totalConnections = stats.reduce((sum, s) => sum + s.connections, 0);

      // Distribute protocol stats evenly across hours for visualization
      stats.forEach(stat => {
        const connectionsPerHour = stat.connections / 24;
        const protocol = stat.protocol.toUpperCase();

        for (let hour = 0; hour < 24; hour++) {
          if (protocol === 'HTTPS' || protocol.includes('TLS')) {
            hourlyData[hour].HTTPS += connectionsPerHour;
          } else if (protocol === 'HTTP') {
            hourlyData[hour].HTTP += connectionsPerHour;
          } else if (protocol === 'DNS') {
            hourlyData[hour].DNS += connectionsPerHour;
          } else if (protocol === 'QUIC') {
            hourlyData[hour].QUIC += connectionsPerHour;
          } else {
            hourlyData[hour].Other += connectionsPerHour;
          }
        }
      });
    } else {
      // Fallback: calculate from flows
      flows.forEach(flow => {
        const hour = new Date(flow.timestamp).getHours();
        const protocol = flow.protocol;

        if (protocol === 'HTTPS') {
          hourlyData[hour].HTTPS++;
        } else if (protocol === 'HTTP') {
          hourlyData[hour].HTTP++;
        } else if (protocol === 'DNS') {
          hourlyData[hour].DNS++;
        } else if (protocol === 'QUIC') {
          hourlyData[hour].QUIC++;
        } else {
          hourlyData[hour].Other++;
        }
      });
    }

    return hourlyData;
  }, [flows, useRealApi, useApi, protocolStats, apiProtocolStats]);

  const protocolColors = {
    HTTPS: 'hsl(var(--primary))',
    HTTP: 'hsl(var(--accent))',
    DNS: 'hsl(var(--secondary))',
    QUIC: 'hsl(var(--success))',
    Other: 'hsl(var(--muted-foreground))',
  };

  if (isLoading && useApi && useRealApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBar size={20} />
            Protocol Usage Timeline
          </CardTitle>
          <CardDescription>Protocol distribution throughout the day</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChartBar size={20} />
              Protocol Usage Timeline
            </CardTitle>
            <CardDescription>Protocol distribution throughout the day</CardDescription>
          </div>
          {useRealApi && useApi && (
            <Button variant="ghost" size="sm" disabled={isLoading}>
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data}>
            <defs>
              {Object.entries(protocolColors).map(([protocol, color]) => (
                <linearGradient key={protocol} id={`color${protocol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="HTTPS"
              stackId="1"
              stroke={protocolColors.HTTPS}
              fill="url(#colorHTTPS)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="HTTP"
              stackId="1"
              stroke={protocolColors.HTTP}
              fill="url(#colorHTTP)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="DNS"
              stackId="1"
              stroke={protocolColors.DNS}
              fill="url(#colorDNS)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="QUIC"
              stackId="1"
              stroke={protocolColors.QUIC}
              fill="url(#colorQUIC)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="Other"
              stackId="1"
              stroke={protocolColors.Other}
              fill="url(#colorOther)"
              fillOpacity={1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
