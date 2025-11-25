import { Card } from '@/components/ui/card'
import { AnalyticsData } from '@/lib/types'
import { formatBytes } from '@/lib/formatters'
import { useMemo } from 'react'

interface TrafficChartProps {
  data: AnalyticsData[]
}

export function TrafficChart({ data }: TrafficChartProps) {
  const maxBytes = useMemo(() => Math.max(...data.map(d => d.totalBytes)), [data])
  
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      height: (d.totalBytes / maxBytes) * 100
    }))
  }, [data, maxBytes])

  return (
    <Card className="p-4 border border-border/50">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Traffic Over Time</h3>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>
        
        <div className="h-[200px] flex items-end gap-1 px-2">
          {chartData.map((d, idx) => (
            <div
              key={idx}
              className="flex-1 group relative"
            >
              <div
                className="w-full bg-gradient-to-t from-accent/80 to-accent/40 rounded-t hover:from-accent hover:to-accent/60 transition-all cursor-pointer"
                style={{ height: `${d.height}%` }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                    <p className="font-medium">{formatBytes(d.totalBytes)}</p>
                    <p className="text-muted-foreground">{d.totalConnections} connections</p>
                    <p className="text-muted-foreground">{d.activeDevices} devices</p>
                    {d.threatCount > 0 && (
                      <p className="text-destructive">{d.threatCount} threats</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>24h ago</span>
          <span>Now</span>
        </div>
      </div>
    </Card>
  )
}
