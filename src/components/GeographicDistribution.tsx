import { useMemo } from 'react'
import { NetworkFlow } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytesShort } from '@/lib/formatters'
import { Progress } from '@/components/ui/progress'
import { MapPin } from '@phosphor-icons/react'

interface GeographicDistributionProps {
  flows: NetworkFlow[]
}

const countryNames: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'DE': 'Germany',
  'JP': 'Japan',
  'SG': 'Singapore',
  'CA': 'Canada',
  'FR': 'France',
  'AU': 'Australia'
}

export function GeographicDistribution({ flows }: GeographicDistributionProps) {
  const countryStats = useMemo(() => {
    const stats = flows.reduce((acc, flow) => {
      const country = flow.country || 'Unknown'
      if (!acc[country]) {
        acc[country] = {
          country,
          totalBytes: 0,
          connections: 0
        }
      }
      acc[country].totalBytes += flow.bytesIn + flow.bytesOut
      acc[country].connections++
      return acc
    }, {} as Record<string, {
      country: string
      totalBytes: number
      connections: number
    }>)

    return Object.values(stats).sort((a, b) => b.totalBytes - a.totalBytes)
  }, [flows])

  const totalBytes = countryStats.reduce((sum, s) => sum + s.totalBytes, 0)
  const maxBytes = Math.max(...countryStats.map(s => s.totalBytes))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin size={20} />
          Geographic Distribution
        </CardTitle>
        <CardDescription>
          Traffic breakdown by destination country
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {countryStats.map((stat, index) => {
            const percentage = totalBytes > 0 ? (stat.totalBytes / totalBytes) * 100 : 0
            return (
              <div key={stat.country} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent-foreground text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {countryNames[stat.country] || stat.country}
                        </p>
                        <span className="text-xs text-muted-foreground font-mono">
                          {stat.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{stat.connections} connections</span>
                        <span>•</span>
                        <span>{percentage.toFixed(1)}% of total</span>
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
            )
          })}
          {countryStats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No geographic data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
