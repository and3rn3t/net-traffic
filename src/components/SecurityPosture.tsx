import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, ShieldWarning, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';
import { NetworkFlow, Device, Threat } from '@/lib/types';

interface SecurityPostureProps {
  flows: NetworkFlow[];
  devices: Device[];
  threats: Threat[];
}

interface SecurityMetric {
  name: string;
  score: number;
  status: 'pass' | 'warning' | 'fail';
  description: string;
}

export function SecurityPosture({ flows, devices, threats }: SecurityPostureProps) {
  const calculateSecurityScore = (): { overall: number; metrics: SecurityMetric[] } => {
    const metrics: SecurityMetric[] = [];

    const encryptedFlows = flows.filter(f => f.protocol === 'HTTPS' || f.protocol === 'SSH').length;
    const encryptionRate = (encryptedFlows / (flows.length || 1)) * 100;
    metrics.push({
      name: 'Traffic Encryption',
      score: encryptionRate,
      status: encryptionRate > 80 ? 'pass' : encryptionRate > 60 ? 'warning' : 'fail',
      description: `${encryptionRate.toFixed(0)}% of traffic is encrypted`,
    });

    const highThreatFlows = flows.filter(
      f => f.threatLevel === 'high' || f.threatLevel === 'critical'
    ).length;
    const threatRate = (highThreatFlows / (flows.length || 1)) * 100;
    const threatScore = Math.max(0, 100 - threatRate * 10);
    metrics.push({
      name: 'Threat Level',
      score: threatScore,
      status: threatScore > 80 ? 'pass' : threatScore > 60 ? 'warning' : 'fail',
      description: `${highThreatFlows} high-risk connections detected`,
    });

    const activeThreats = threats.filter(t => !t.dismissed).length;
    const threatResponseScore = Math.max(0, 100 - activeThreats * 10);
    metrics.push({
      name: 'Threat Response',
      score: threatResponseScore,
      status: threatResponseScore > 80 ? 'pass' : threatResponseScore > 60 ? 'warning' : 'fail',
      description: `${activeThreats} unaddressed threat${activeThreats !== 1 ? 's' : ''}`,
    });

    const avgDeviceThreatScore =
      devices.reduce((sum, d) => sum + d.threatScore, 0) / (devices.length || 1);
    const deviceHealthScore = Math.max(0, 100 - avgDeviceThreatScore);
    metrics.push({
      name: 'Device Health',
      score: deviceHealthScore,
      status: deviceHealthScore > 70 ? 'pass' : deviceHealthScore > 50 ? 'warning' : 'fail',
      description: `Average device threat score: ${avgDeviceThreatScore.toFixed(0)}%`,
    });

    const uniqueDestinations = new Set(flows.map(f => f.destIp)).size;
    const destinationDiversityScore = Math.min(100, (uniqueDestinations / 100) * 100);
    const concentrationRisk =
      uniqueDestinations < 20 ? 100 : Math.max(0, 100 - (uniqueDestinations - 20) * 2);
    metrics.push({
      name: 'Connection Diversity',
      score: concentrationRisk,
      status: concentrationRisk > 70 ? 'pass' : concentrationRisk > 50 ? 'warning' : 'fail',
      description: `${uniqueDestinations} unique destinations`,
    });

    const recentDevices = devices.filter(d => Date.now() - d.lastSeen < 300000).length;
    const deviceActivityScore = (recentDevices / (devices.length || 1)) * 100;
    metrics.push({
      name: 'Device Activity',
      score: deviceActivityScore,
      status: deviceActivityScore > 70 ? 'pass' : deviceActivityScore > 50 ? 'warning' : 'fail',
      description: `${recentDevices} of ${devices.length} devices active recently`,
    });

    const overallScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;

    return { overall: overallScore, metrics };
  };

  const { overall, metrics } = calculateSecurityScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getStatusIcon = (status: SecurityMetric['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle size={16} className="text-success" />;
      case 'warning':
        return <Warning size={16} className="text-warning" />;
      case 'fail':
        return <XCircle size={16} className="text-destructive" />;
    }
  };

  const getStatusColor = (status: SecurityMetric['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-success/10 border-success/30';
      case 'warning':
        return 'bg-warning/10 border-warning/30';
      case 'fail':
        return 'bg-destructive/10 border-destructive/30';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {overall >= 80 ? (
                <ShieldCheck className="text-success" size={20} />
              ) : (
                <ShieldWarning className="text-warning" size={20} />
              )}
              Security Posture
            </CardTitle>
            <CardDescription>Overall network security health assessment</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              <span className={getScoreColor(overall)}>{getScoreGrade(overall)}</span>
            </div>
            <div className="text-xs text-muted-foreground">{overall.toFixed(0)}/100</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Security Score</span>
            <span className={`font-medium ${getScoreColor(overall)}`}>{overall.toFixed(0)}%</span>
          </div>
          <Progress value={overall} className="h-2" />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Security Metrics</div>
          {metrics.map((metric, index) => (
            <div key={index} className={`p-3 rounded-lg border ${getStatusColor(metric.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  {getStatusIcon(metric.status)}
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{metric.name}</div>
                    <div className="text-xs text-muted-foreground">{metric.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${getScoreColor(metric.score)}`}>
                    {metric.score.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">score</div>
                </div>
              </div>
              <div className="mt-2">
                <Progress value={metric.score} className="h-1" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-sm">
            {overall >= 80 ? (
              <>
                <CheckCircle size={16} className="text-success mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-success mb-1">Strong Security Posture</div>
                  <div className="text-xs text-muted-foreground">
                    Your network demonstrates good security practices. Continue monitoring for
                    emerging threats.
                  </div>
                </div>
              </>
            ) : overall >= 60 ? (
              <>
                <Warning size={16} className="text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-warning mb-1">Moderate Security Concerns</div>
                  <div className="text-xs text-muted-foreground">
                    Some security metrics need attention. Review failed checks and take corrective
                    action.
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-destructive mb-1">Critical Security Issues</div>
                  <div className="text-xs text-muted-foreground">
                    Immediate action required. Multiple security metrics are below acceptable
                    thresholds.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
