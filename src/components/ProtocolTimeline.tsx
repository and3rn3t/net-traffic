import { useMemo } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBar } from '@phosphor-icons/react';
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

interface ProtocolTimelineProps {
  flows: NetworkFlow[];
}

export function ProtocolTimeline({ flows }: ProtocolTimelineProps) {
  const data = useMemo(() => {
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      HTTPS: 0,
      HTTP: 0,
      DNS: 0,
      QUIC: 0,
      Other: 0,
    }));

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

    return hourlyData;
  }, [flows]);

  const protocolColors = {
    HTTPS: 'hsl(var(--primary))',
    HTTP: 'hsl(var(--accent))',
    DNS: 'hsl(var(--secondary))',
    QUIC: 'hsl(var(--success))',
    Other: 'hsl(var(--muted-foreground))',
  };

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
