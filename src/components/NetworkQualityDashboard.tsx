import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge, Pulse, Warning, TrendUp } from '@phosphor-icons/react';
import { apiClient } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NetworkQualityDashboardProps {
  hours?: number;
  deviceId?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export function NetworkQualityDashboard({ hours = 24, deviceId }: NetworkQualityDashboardProps) {
  const [rttTrends, setRttTrends] = useState<
    Array<{
      timestamp: number;
      avg_rtt: number;
      min_rtt: number;
      max_rtt: number;
      count: number;
    }>
  >([]);
  const [jitterAnalysis, setJitterAnalysis] = useState<{
    avg_jitter: number;
    min_jitter: number;
    max_jitter: number;
    count: number;
    distribution: Array<{ range: string; count: number }>;
  } | null>(null);
  const [retransmissionReport, setRetransmissionReport] = useState<{
    total_flows: number;
    flows_with_retransmissions: number;
    total_retransmissions: number;
    total_packets: number;
    retransmission_rate: number;
    by_protocol: Array<{
      protocol: string;
      flows: number;
      retransmissions: number;
      rate: number;
    }>;
  } | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<{
    total_flows: number;
    flows_with_metrics: number;
    quality_score: number;
    avg_rtt: number;
    avg_jitter: number;
    avg_retransmissions: number;
    quality_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHours, setSelectedHours] = useState(hours);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  useEffect(() => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [rtt, jitter, retrans, quality] = await Promise.all([
          apiClient.getRttTrends(selectedHours, deviceId),
          apiClient.getJitterAnalysis(selectedHours, deviceId),
          apiClient.getRetransmissionReport(selectedHours, deviceId),
          apiClient.getConnectionQualitySummary(selectedHours, deviceId),
        ]);

        setRttTrends(rtt);
        setJitterAnalysis(jitter);
        setRetransmissionReport(retrans);
        setConnectionQuality(quality);
      } catch (error) {
        console.error('Failed to fetch network quality data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedHours, deviceId, USE_REAL_API]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header with time selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gauge size={24} />
            Network Quality Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time network performance metrics
          </p>
        </div>
        <Select
          value={selectedHours.toString()}
          onValueChange={v => setSelectedHours(Number.parseInt(v, 10))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last Hour</SelectItem>
            <SelectItem value="24">Last 24 Hours</SelectItem>
            <SelectItem value="168">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Connection Quality Summary */}
      {connectionQuality && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold">
                  {connectionQuality.quality_score.toFixed(0)}
                </div>
                <Badge
                  variant={
                    connectionQuality.quality_score >= 80
                      ? 'default'
                      : connectionQuality.quality_score >= 60
                        ? 'secondary'
                        : connectionQuality.quality_score >= 40
                          ? 'outline'
                          : 'destructive'
                  }
                >
                  {connectionQuality.quality_score >= 80
                    ? 'Excellent'
                    : connectionQuality.quality_score >= 60
                      ? 'Good'
                      : connectionQuality.quality_score >= 40
                        ? 'Fair'
                        : 'Poor'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {connectionQuality.flows_with_metrics} flows analyzed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg RTT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{connectionQuality.avg_rtt.toFixed(0)}ms</div>
              <p className="text-xs text-muted-foreground mt-2">
                {connectionQuality.avg_rtt < 50
                  ? 'Excellent'
                  : connectionQuality.avg_rtt < 100
                    ? 'Good'
                    : connectionQuality.avg_rtt < 200
                      ? 'Fair'
                      : 'Poor'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Jitter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{connectionQuality.avg_jitter.toFixed(1)}ms</div>
              <p className="text-xs text-muted-foreground mt-2">
                {connectionQuality.avg_jitter < 10
                  ? 'Excellent'
                  : connectionQuality.avg_jitter < 30
                    ? 'Good'
                    : 'Fair'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Retransmissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {connectionQuality.avg_retransmissions.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {connectionQuality.avg_retransmissions === 0
                  ? 'None'
                  : connectionQuality.avg_retransmissions < 3
                    ? 'Low'
                    : 'High'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quality Distribution */}
      {connectionQuality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pulse size={20} />
              Connection Quality Distribution
            </CardTitle>
            <CardDescription>Breakdown of connection quality across all flows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: 'Excellent',
                          value: connectionQuality.quality_distribution.excellent,
                        },
                        { name: 'Good', value: connectionQuality.quality_distribution.good },
                        { name: 'Fair', value: connectionQuality.quality_distribution.fair },
                        { name: 'Poor', value: connectionQuality.quality_distribution.poor },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2, 3].map(entry => (
                        <Cell key={`cell-${entry}`} fill={COLORS[entry]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-success/10">
                  <span className="text-sm font-medium">Excellent</span>
                  <Badge variant="default">
                    {connectionQuality.quality_distribution.excellent}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                  <span className="text-sm font-medium">Good</span>
                  <Badge variant="secondary">{connectionQuality.quality_distribution.good}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-warning/10">
                  <span className="text-sm font-medium">Fair</span>
                  <Badge variant="outline">{connectionQuality.quality_distribution.fair}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-destructive/10">
                  <span className="text-sm font-medium">Poor</span>
                  <Badge variant="destructive">{connectionQuality.quality_distribution.poor}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RTT Trends */}
      {rttTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp size={20} />
              Round-Trip Time (RTT) Trends
            </CardTitle>
            <CardDescription>Average RTT over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rttTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis label={{ value: 'RTT (ms)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  labelFormatter={value => new Date(value).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}ms`, 'RTT']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_rtt"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Average RTT"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="min_rtt"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Min RTT"
                />
                <Line
                  type="monotone"
                  dataKey="max_rtt"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Max RTT"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Retransmission Report */}
      {retransmissionReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warning size={20} />
                Retransmission Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Retransmissions</p>
                  <p className="text-2xl font-bold">
                    {retransmissionReport.total_retransmissions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Retransmission Rate</p>
                  <p className="text-2xl font-bold">
                    {retransmissionReport.retransmission_rate.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Flows with Retransmissions</p>
                  <p className="text-2xl font-bold">
                    {retransmissionReport.flows_with_retransmissions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Packets</p>
                  <p className="text-2xl font-bold">
                    {retransmissionReport.total_packets.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retransmissions by Protocol</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={retransmissionReport.by_protocol.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="protocol" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Rate']} />
                  <Bar dataKey="rate" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Jitter Analysis */}
      {jitterAnalysis && jitterAnalysis.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jitter Analysis</CardTitle>
            <CardDescription>
              Average: {jitterAnalysis.avg_jitter.toFixed(2)}ms | Min:{' '}
              {jitterAnalysis.min_jitter.toFixed(2)}ms | Max: {jitterAnalysis.max_jitter.toFixed(2)}
              ms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={jitterAnalysis.distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
