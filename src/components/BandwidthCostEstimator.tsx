import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CurrencyDollar, TrendUp, TrendDown, Warning } from '@phosphor-icons/react'
import { NetworkFlow } from '@/lib/types'
import { formatBytes } from '@/lib/formatters'

interface BandwidthCostEstimatorProps {
  flows: NetworkFlow[]
}

interface CostBreakdown {
  totalGB: number
  costPerGB: number
  monthlyCost: number
  projectedCost: number
  overage: number
  tier: 'free' | 'standard' | 'premium' | 'enterprise'
}

export function BandwidthCostEstimator({ flows }: BandwidthCostEstimatorProps) {
  const calculateCosts = (): CostBreakdown => {
    const totalBytes = flows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0)
    const totalGB = totalBytes / (1024 ** 3)
    
    const hoursOfData = (Math.max(...flows.map(f => f.timestamp)) - Math.min(...flows.map(f => f.timestamp))) / (1000 * 60 * 60)
    const dailyGB = (totalGB / hoursOfData) * 24
    const monthlyGB = dailyGB * 30
    
    let tier: CostBreakdown['tier'] = 'free'
    let costPerGB = 0.09
    let baseAllowance = 100
    let baseCost = 0
    
    if (monthlyGB > 1000) {
      tier = 'enterprise'
      costPerGB = 0.05
      baseAllowance = 1000
      baseCost = 250
    } else if (monthlyGB > 500) {
      tier = 'premium'
      costPerGB = 0.06
      baseAllowance = 500
      baseCost = 150
    } else if (monthlyGB > 100) {
      tier = 'standard'
      costPerGB = 0.08
      baseAllowance = 100
      baseCost = 50
    }
    
    const overage = Math.max(0, monthlyGB - baseAllowance)
    const overageCost = overage * costPerGB
    const monthlyCost = baseCost + overageCost
    
    return {
      totalGB,
      costPerGB,
      monthlyCost,
      projectedCost: monthlyGB * costPerGB,
      overage,
      tier
    }
  }

  const costs = calculateCosts()
  const usagePercent = Math.min(100, (costs.totalGB / 1000) * 100)

  const getTierInfo = (tier: CostBreakdown['tier']) => {
    switch (tier) {
      case 'free':
        return { label: 'Free Tier', color: 'bg-green-500', limit: 100 }
      case 'standard':
        return { label: 'Standard Plan', color: 'bg-blue-500', limit: 500 }
      case 'premium':
        return { label: 'Premium Plan', color: 'bg-purple-500', limit: 1000 }
      case 'enterprise':
        return { label: 'Enterprise Plan', color: 'bg-orange-500', limit: 5000 }
    }
  }

  const tierInfo = getTierInfo(costs.tier)
  const isNearLimit = (costs.totalGB / tierInfo.limit) > 0.8

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CurrencyDollar size={20} />
              Bandwidth Cost Estimator
            </CardTitle>
            <CardDescription>
              Monthly cost projection based on current usage
            </CardDescription>
          </div>
          <Badge className={tierInfo.color}>
            {tierInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="text-sm text-muted-foreground mb-1">Current Usage</div>
            <div className="text-2xl font-bold">{costs.totalGB.toFixed(2)} GB</div>
            <div className="text-xs text-muted-foreground mt-1">
              Last {Math.ceil(flows.length / 10)} hours
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="text-sm text-muted-foreground mb-1">Projected Monthly</div>
            <div className="text-2xl font-bold">
              ${costs.monthlyCost.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {costs.monthlyCost > 50 ? (
                <>
                  <TrendUp size={12} className="text-destructive" />
                  <span className="text-destructive">Above budget</span>
                </>
              ) : (
                <>
                  <TrendDown size={12} className="text-success" />
                  <span className="text-success">Within budget</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usage vs Tier Limit</span>
            <span className="font-medium">
              {costs.totalGB.toFixed(1)} / {tierInfo.limit} GB
            </span>
          </div>
          <Progress 
            value={usagePercent} 
            className="h-2"
          />
          {isNearLimit && (
            <div className="flex items-center gap-2 text-xs text-warning mt-2">
              <Warning size={14} />
              <span>Approaching tier limit - consider upgrading</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Cost Breakdown</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base Tier Cost</span>
              <span className="font-medium">
                ${costs.tier === 'free' ? '0.00' : costs.tier === 'standard' ? '50.00' : costs.tier === 'premium' ? '150.00' : '250.00'}
              </span>
            </div>
            
            {costs.overage > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Overage ({costs.overage.toFixed(1)} GB @ ${costs.costPerGB}/GB)
                </span>
                <span className="font-medium text-warning">
                  ${(costs.overage * costs.costPerGB).toFixed(2)}
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="font-medium">Estimated Monthly Total</span>
              <span className="text-xl font-bold">
                ${costs.monthlyCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="text-xs font-medium mb-1">💡 Cost Saving Tip</div>
          <div className="text-xs text-muted-foreground">
            {costs.monthlyCost > 200 
              ? 'Consider implementing data compression and caching to reduce bandwidth costs by up to 40%'
              : costs.monthlyCost > 100
              ? 'Optimize large file transfers during off-peak hours for better rate negotiation'
              : 'Your usage is efficient! Continue monitoring for anomalies'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
