import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Warning, CheckCircle, Info } from '@phosphor-icons/react';
import { NetworkFlow, Device } from '@/lib/types';

interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  score: number;
  affectedDevices: string[];
}

interface AnomalyDetectionProps {
  flows: NetworkFlow[];
  devices: Device[];
}

export const AnomalyDetection = memo(function AnomalyDetection({
  flows,
  devices,
}: AnomalyDetectionProps) {
  const detectAnomalies = useMemo((): Anomaly[] => {
    const anomalies: Anomaly[] = [];

    const deviceTraffic = devices.map(device => {
      const deviceFlows = flows.filter(f => f.deviceId === device.id);
      const totalBytes = deviceFlows.reduce((sum, f) => sum + f.bytesIn + f.bytesOut, 0);
      const avgBytes = totalBytes / (deviceFlows.length || 1);

      return { device, totalBytes, avgBytes, flowCount: deviceFlows.length };
    });

    const avgTotalBytes =
      deviceTraffic.reduce((sum, d) => sum + d.totalBytes, 0) / (devices.length || 1);
    const threshold = avgTotalBytes * 2.5;

    deviceTraffic.forEach(({ device, totalBytes }) => {
      if (totalBytes > threshold) {
        anomalies.push({
          id: `anomaly-bandwidth-${device.id}`,
          type: 'Excessive Bandwidth',
          severity: totalBytes > threshold * 2 ? 'high' : 'medium',
          description: `${device.name} consuming ${(totalBytes / 1024 / 1024).toFixed(1)}MB, ${((totalBytes / avgTotalBytes - 1) * 100).toFixed(0)}% above average`,
          score: Math.min(100, (totalBytes / avgTotalBytes - 1) * 50),
          affectedDevices: [device.id],
        });
      }
    });

    const nightHours = flows.filter(f => {
      const hour = new Date(f.timestamp).getHours();
      return hour >= 2 && hour <= 5;
    });

    if (nightHours.length > flows.length * 0.15) {
      const nightDevices = [...new Set(nightHours.map(f => f.deviceId))];
      anomalies.push({
        id: 'anomaly-unusual-hours',
        type: 'Unusual Activity Hours',
        severity: 'medium',
        description: `${nightDevices.length} devices active during late night hours (2AM-5AM)`,
        score: (nightHours.length / flows.length) * 100,
        affectedDevices: nightDevices,
      });
    }

    const portScans = flows.filter(f => f.packetsOut > 100 && f.bytesOut < 10000);
    if (portScans.length > 20) {
      const scanningDevices = [...new Set(portScans.map(f => f.deviceId))];
      anomalies.push({
        id: 'anomaly-port-scan',
        type: 'Potential Port Scanning',
        severity: 'high',
        description: `${portScans.length} connections detected with high packet count but low data transfer`,
        score: Math.min(100, (portScans.length / flows.length) * 200),
        affectedDevices: scanningDevices,
      });
    }

    const exfiltration = flows.filter(f => f.bytesOut > f.bytesIn * 5 && f.bytesOut > 10000000);
    if (exfiltration.length > 0) {
      const exfilDevices = [...new Set(exfiltration.map(f => f.deviceId))];
      anomalies.push({
        id: 'anomaly-data-exfil',
        type: 'Large Data Upload',
        severity: 'high',
        description: `${exfiltration.length} connections with unusual upload/download ratio detected`,
        score: Math.min(100, exfiltration.length * 15),
        affectedDevices: exfilDevices,
      });
    }

    const repeatedConnections = flows.reduce(
      (acc, flow) => {
        const key = `${flow.deviceId}-${flow.destIp}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const suspicious = Object.entries(repeatedConnections).filter(([_, count]) => count > 50);
    if (suspicious.length > 0) {
      const suspiciousDevices = [...new Set(suspicious.map(([key]) => key.split('-')[0]))];
      anomalies.push({
        id: 'anomaly-repeated',
        type: 'Repetitive Connection Pattern',
        severity: 'low',
        description: `${suspicious.length} destination IPs contacted repeatedly (possible C&C communication)`,
        score: Math.min(100, suspicious.length * 2),
        affectedDevices: suspiciousDevices,
      });
    }

    return anomalies.sort((a, b) => b.score - a.score);
  }, [flows, devices]);
  const overallScore =
    anomalies.length === 0
      ? 0
      : Math.min(100, anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-destructive';
      case 'medium':
        return 'text-warning';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive/10 border-destructive/30';
      case 'medium':
        return 'bg-warning/10 border-warning/30';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30';
      default:
        return 'bg-muted/10 border-border';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 20) return 'text-success';
    if (score < 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {anomalies.length === 0 ? (
                <CheckCircle className="text-success" size={20} />
              ) : (
                <Warning className={getSeverityColor(anomalies[0]?.severity || 'low')} size={20} />
              )}
              Anomaly Detection
            </CardTitle>
            <CardDescription>AI-powered behavioral analysis of network patterns</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              <span className={getScoreColor(overallScore)}>{overallScore.toFixed(0)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Anomaly Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle size={48} className="text-success mb-3" />
            <p className="text-sm font-medium">No Anomalies Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              All network patterns within normal parameters
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map(anomaly => {
              const affectedDeviceNames = anomaly.affectedDevices
                .map(id => devices.find(d => d.id === id)?.name)
                .filter(Boolean)
                .slice(0, 3);

              return (
                <div
                  key={anomaly.id}
                  className={`p-4 rounded-lg border ${getSeverityBg(anomaly.severity)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {anomaly.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-sm">{anomaly.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{anomaly.description}</p>
                      {affectedDeviceNames.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Info size={14} />
                          <span>
                            Affected: {affectedDeviceNames.join(', ')}
                            {anomaly.affectedDevices.length > 3 &&
                              ` +${anomaly.affectedDevices.length - 3} more`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(anomaly.score)}`}>
                        {anomaly.score.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
