import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Layout, BarChart3, TrendingUp, Smartphone } from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { formatBytes } from '@/lib/formatters';

interface ApplicationUsageDashboardProps {
  hours?: number;
  deviceId?: string;
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

export function ApplicationUsageDashboard({
  hours = 24,
  deviceId,
}: ApplicationUsageDashboardProps) {
  const [applicationBreakdown, setApplicationBreakdown] = useState<any[]>([]);
  const [applicationTrends, setApplicationTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHours, setSelectedHours] = useState(hours);
  const [selectedApplication, setSelectedApplication] = useState<string>('all');
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  useEffect(() => {
    if (!USE_REAL_API) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [breakdown, trends] = await Promise.all([
          apiClient.getApplicationBreakdown(selectedHours, deviceId),
          apiClient.getApplicationTrends(
            selectedHours,
            selectedApplication === 'all' ? undefined : selectedApplication
          ),
        ]);

        setApplicationBreakdown(breakdown);
        setApplicationTrends(trends);
      } catch (error) {
        console.error('Failed to fetch application usage data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedHours, deviceId, selectedApplication, USE_REAL_API]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const totalBytes = applicationBreakdown.reduce((sum, app) => sum + app.bytes, 0);
  const totalConnections = applicationBreakdown.reduce((sum, app) => sum + app.connections, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layout size={24} />
            Application Usage Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Application protocol usage and trends
          </p>
        </div>
        <div className="flex gap-2">
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
          <Select value={selectedApplication} onValueChange={setSelectedApplication}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              {applicationBreakdown.slice(0, 10).map(app => (
                <SelectItem key={app.application} value={app.application}>
                  {app.application}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{applicationBreakdown.length}</div>
            <p className="text-xs text-muted-foreground mt-2">Unique applications detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalConnections.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-2">Across all applications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatBytes(totalBytes)}</div>
            <p className="text-xs text-muted-foreground mt-2">Bytes transferred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Application</CardTitle>
          </CardHeader>
          <CardContent>
            {applicationBreakdown.length > 0 ? (
              <>
                <div className="text-lg font-bold">{applicationBreakdown[0].application}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {applicationBreakdown[0].traffic_percentage.toFixed(1)}% of traffic
                </p>
              </>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">N/A</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Application Breakdown */}
      {applicationBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} />
                Top Applications by Traffic
              </CardTitle>
              <CardDescription>Applications sorted by total bytes transferred</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={applicationBreakdown.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="application" type="category" width={90} />
                  <Tooltip formatter={(value: number) => [formatBytes(value), 'Bytes']} />
                  <Bar dataKey="bytes" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone size={20} />
                Application Distribution
              </CardTitle>
              <CardDescription>Traffic percentage by application</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={applicationBreakdown.slice(0, 8).map(app => ({
                      name: app.application,
                      value: app.traffic_percentage,
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {applicationBreakdown.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Traffic']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Application Details Table */}
      {applicationBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>Detailed metrics for each application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Application</th>
                    <th className="text-right p-2">Connections</th>
                    <th className="text-right p-2">Traffic</th>
                    <th className="text-right p-2">Packets</th>
                    <th className="text-right p-2">Devices</th>
                    <th className="text-right p-2">Avg RTT</th>
                    <th className="text-right p-2">% of Traffic</th>
                  </tr>
                </thead>
                <tbody>
                  {applicationBreakdown.map((app, idx) => (
                    <tr key={app.application} className="border-b hover:bg-accent/5">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={
                              {
                                backgroundColor: COLORS[idx % COLORS.length],
                              } as React.CSSProperties
                            }
                          />
                          <span className="font-medium">{app.application}</span>
                        </div>
                      </td>
                      <td className="text-right p-2">{app.connections.toLocaleString()}</td>
                      <td className="text-right p-2 font-mono">{formatBytes(app.bytes)}</td>
                      <td className="text-right p-2">{app.packets.toLocaleString()}</td>
                      <td className="text-right p-2">{app.unique_devices}</td>
                      <td className="text-right p-2">
                        {app.avg_rtt ? `${app.avg_rtt.toFixed(0)}ms` : 'N/A'}
                      </td>
                      <td className="text-right p-2">
                        <Badge variant="outline">{app.traffic_percentage.toFixed(1)}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Trends */}
      {applicationTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} />
              Application Usage Trends
            </CardTitle>
            <CardDescription>
              {selectedApplication === 'all'
                ? 'Traffic trends for all applications'
                : `Traffic trends for ${selectedApplication}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={applicationTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis label={{ value: 'Bytes', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  labelFormatter={value => new Date(value).toLocaleString()}
                  formatter={(value: number) => [formatBytes(value), 'Bytes']}
                />
                <Legend />
                {selectedApplication === 'all' ? (
                  applicationBreakdown.slice(0, 5).map((app, idx) => (
                    <Line
                      key={app.application}
                      type="monotone"
                      dataKey={data => {
                        const appData = data.applications.find(
                          (a: any) => a.application === app.application
                        );
                        return appData?.bytes || 0;
                      }}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      name={app.application}
                      dot={false}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey={data => {
                      const appData = data.applications.find(
                        (a: any) => a.application === selectedApplication
                      );
                      return appData?.bytes || 0;
                    }}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name={selectedApplication}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
