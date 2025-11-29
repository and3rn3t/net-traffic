import { useState, useEffect } from 'react';
import { Device } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartBar,
  Globe,
  Network,
  Shield,
  Pulse,
  AppWindow,
  ArrowDown,
  ArrowUp,
} from '@phosphor-icons/react';
import { apiClient } from '@/lib/api';
import { formatBytes } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DeviceAnalyticsViewProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function DeviceAnalyticsView({ device, open, onOpenChange }: DeviceAnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<{
    device: { id: string; name: string; ip: string; type: string };
    summary: {
      total_bytes_in: number;
      total_bytes_out: number;
      total_bytes: number;
      connections: number;
      threats: number;
    };
    protocols: Array<{ protocol: string; bytes: number; connections: number }>;
    top_domains: Array<{ domain: string; bytes: number }>;
    top_ports: Array<{ port: number; connections: number }>;
  } | null>(null);
  const [applicationProfile, setApplicationProfile] = useState<{
    device_id: string;
    total_applications: number;
    total_connections: number;
    total_bytes: number;
    applications: Array<{
      application: string;
      connections: number;
      bytes: number;
      avg_duration: number;
      traffic_percentage: number;
    }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHours, setSelectedHours] = useState(24);
  const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

  useEffect(() => {
    if (!device || !open || !USE_REAL_API) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [analyticsData, appProfile] = await Promise.all([
          apiClient.getDeviceAnalytics(device.id, selectedHours),
          apiClient.getDeviceApplicationProfile(device.id, selectedHours),
        ]);
        setAnalytics(analyticsData);
        setApplicationProfile(appProfile);
      } catch (error) {
        console.error('Failed to fetch device analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [device, open, selectedHours, USE_REAL_API]);

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Pulse size={20} />
                Device Analytics: {device.name}
              </DialogTitle>
              <DialogDescription>
                Detailed analytics and usage patterns for {device.ip}
              </DialogDescription>
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
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : analytics ? (
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="protocols">Protocols</TabsTrigger>
              <TabsTrigger value="domains">Domains</TabsTrigger>
              <TabsTrigger value="ports">Ports</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ArrowDown size={16} />
                      Bytes In
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatBytes(analytics.summary.total_bytes_in)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ArrowUp size={16} />
                      Bytes Out
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatBytes(analytics.summary.total_bytes_out)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Network size={16} />
                      Connections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.summary.connections.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield size={16} />
                      Threats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.threats}</div>
                    {analytics.summary.threats > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        High Risk
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pulse size={20} />
                    Traffic Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Traffic</span>
                      <span className="text-lg font-semibold">
                        {formatBytes(analytics.summary.total_bytes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Inbound</span>
                      <span className="text-sm">
                        {formatBytes(analytics.summary.total_bytes_in)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Outbound</span>
                      <span className="text-sm">
                        {formatBytes(analytics.summary.total_bytes_out)}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Inbound %</span>
                        <span className="text-sm font-medium">
                          {(
                            (analytics.summary.total_bytes_in / analytics.summary.total_bytes) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Outbound %</span>
                        <span className="text-sm font-medium">
                          {(
                            (analytics.summary.total_bytes_out / analytics.summary.total_bytes) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Protocols Tab */}
            <TabsContent value="protocols" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartBar size={20} />
                    Protocol Breakdown
                  </CardTitle>
                  <CardDescription>Traffic by protocol</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.protocols.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.protocols}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="protocol" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => [formatBytes(value), 'Bytes']} />
                          <Bar dataKey="bytes" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {analytics.protocols.map((proto, idx) => (
                          <div
                            key={proto.protocol}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={
                                  {
                                    backgroundColor: COLORS[idx % COLORS.length],
                                  } as React.CSSProperties
                                }
                              />
                              <span className="font-medium">{proto.protocol}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">
                                {proto.connections} connections
                              </span>
                              <span className="font-semibold">{formatBytes(proto.bytes)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No protocol data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Domains Tab */}
            <TabsContent value="domains" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe size={20} />
                    Top Domains
                  </CardTitle>
                  <CardDescription>Most accessed domains by this device</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.top_domains.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.top_domains.map((domain, idx) => (
                        <div
                          key={domain.domain}
                          className="flex items-center justify-between p-3 rounded border"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{idx + 1}</Badge>
                            <span className="font-mono text-sm">{domain.domain}</span>
                          </div>
                          <span className="font-semibold">{formatBytes(domain.bytes)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No domain data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Ports Tab */}
            <TabsContent value="ports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network size={20} />
                    Top Ports
                  </CardTitle>
                  <CardDescription>Most connected ports</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.top_ports.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.top_ports.map((port, idx) => (
                        <div
                          key={port.port}
                          className="flex items-center justify-between p-3 rounded border"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              Port {port.port}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {port.connections} connections
                            </span>
                          </div>
                          <Badge variant="secondary">{idx + 1}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No port data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Applications Tab */}
            <TabsContent value="applications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AppWindow size={20} />
                    Application Usage
                  </CardTitle>
                  <CardDescription>Applications used by this device</CardDescription>
                </CardHeader>
                <CardContent>
                  {applicationProfile && applicationProfile.applications.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Applications</p>
                          <p className="text-2xl font-bold">
                            {applicationProfile.total_applications}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Connections</p>
                          <p className="text-2xl font-bold">
                            {applicationProfile.total_connections.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Traffic</p>
                          <p className="text-2xl font-bold">
                            {formatBytes(applicationProfile.total_bytes)}
                          </p>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={applicationProfile.applications.slice(0, 10)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="application" type="category" width={100} />
                          <Tooltip formatter={(value: number) => [formatBytes(value), 'Bytes']} />
                          <Bar dataKey="bytes" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {applicationProfile.applications.map((app, idx) => (
                          <div
                            key={app.application}
                            className="flex items-center justify-between p-3 rounded border"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={
                                  {
                                    backgroundColor: COLORS[idx % COLORS.length],
                                  } as React.CSSProperties
                                }
                              />
                              <span className="font-medium">{app.application}</span>
                              <Badge variant="outline">{app.connections} connections</Badge>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">
                                {app.traffic_percentage.toFixed(1)}% of traffic
                              </span>
                              <span className="font-semibold">{formatBytes(app.bytes)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No application data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No analytics data available for this device</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
