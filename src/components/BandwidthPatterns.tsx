import { useMemo } from 'react';
import { NetworkFlow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytesShort } from '@/lib/formatters';
import { ChartLine } from '@phosphor-icons/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BandwidthPatternsProps {
  flows: NetworkFlow[];
}

export function BandwidthPatterns({ flows }: BandwidthPatternsProps) {
  const data = useMemo(() => {
    const timeBlocks = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      upload: 0,
      download: 0,
      count: 0,
    }));

    flows.forEach(flow => {
      const hour = new Date(flow.timestamp).getHours();
      timeBlocks[hour].upload += flow.bytesOut;
      timeBlocks[hour].download += flow.bytesIn;
      timeBlocks[hour].count++;
    });

    return timeBlocks;
  }, [flows]);

  const stats = useMemo(() => {
    const totalUpload = data.reduce((sum, d) => sum + d.upload, 0);
    const totalDownload = data.reduce((sum, d) => sum + d.download, 0);
    const ratio = totalUpload > 0 ? totalDownload / totalUpload : 0;
    const peakHour = data.reduce((max, d) =>
      d.upload + d.download > max.upload + max.download ? d : max
    );

    return {
      totalUpload,
      totalDownload,
      ratio: ratio.toFixed(2),
      peakHour: peakHour.hour,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartLine size={20} />
          Bandwidth Patterns
        </CardTitle>
        <CardDescription>Upload vs download traffic throughout the day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Upload</p>
            <p className="text-2xl font-bold text-accent">{formatBytesShort(stats.totalUpload)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Download</p>
            <p className="text-2xl font-bold text-primary">
              {formatBytesShort(stats.totalDownload)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Download/Upload Ratio</p>
            <p className="text-2xl font-bold">{stats.ratio}:1</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Peak Hour</p>
            <p className="text-2xl font-bold">{stats.peakHour}</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={value => formatBytesShort(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: any, name: string) => [
                formatBytesShort(value),
                name === 'upload' ? 'Upload' : 'Download',
              ]}
            />
            <Area
              type="monotone"
              dataKey="upload"
              stroke="hsl(var(--accent))"
              fillOpacity={1}
              fill="url(#colorUpload)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="download"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorDownload)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
