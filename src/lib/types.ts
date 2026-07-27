export interface NetworkFlow {
  id: string;
  timestamp: number;
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
  protocol: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  duration: number;
  status: 'active' | 'closed';
  country?: string;
  city?: string;
  asn?: number;
  domain?: string;
  sni?: string;
  threatLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  deviceId: string;
  // TCP layer details
  tcpFlags?: string[];
  ttl?: number;
  connectionState?: string;
  // Network quality metrics
  rtt?: number;
  retransmissions?: number;
  jitter?: number;
  // Application layer
  application?: string;
  userAgent?: string;
  httpMethod?: string;
  url?: string;
  httpHost?: string;
  httpStatusCode?: number;
  // DNS details
  dnsQueryType?: string;
  dnsResponseCode?: string;
  dnsQueryName?: string;
  dnsAnswers?: string[];
  // TLS details
  tlsVersion?: string;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: 'smartphone' | 'laptop' | 'desktop' | 'tablet' | 'iot' | 'server' | 'unknown';
  vendor: string;
  os?: string;
  firstSeen: number;
  lastSeen: number;
  bytesTotal: number;
  connectionsCount: number;
  threatScore: number;
  behavioral: {
    peakHours: number[];
    commonPorts: number[];
    commonDomains: string[];
    anomalyCount: number;
    applications?: string[];
  };
  // Enhanced fields
  ipv6Support?: boolean;
  avgRtt?: number;
  connectionQuality?: 'good' | 'fair' | 'poor';
  applications?: string[];
  notes?: string; // User-added notes about the device
  tags?: string[]; // User-defined groups, e.g. 'iot', 'trusted', 'guest'
}

export interface Threat {
  id: string;
  timestamp: number;
  type:
    | 'malware'
    | 'exfiltration'
    | 'scan'
    | 'botnet'
    | 'phishing'
    | 'anomaly'
    | 'new_device'
    | 'bandwidth_quota';
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviceId: string;
  flowId: string;
  description: string;
  recommendation: string;
  dismissed: boolean;
}

export interface FilterPreset {
  id: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: number;
}

export type AlertMetric =
  | 'rtt'
  | 'retransmissions'
  | 'jitter'
  | 'country'
  | 'application'
  | 'sni'
  | 'tcp_flags'
  | 'threat_level';

export type AlertOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'in' | 'contains';

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold?: number;
  values?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlertRuleInput {
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold?: number;
  values?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  enabled: boolean;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviceId: string;
  flowId: string;
  metric: string;
  value: string;
  description: string;
  acknowledged: boolean;
}

export interface DeviceBaseline {
  deviceId: string;
  bytesTotalMean: number;
  bytesTotalStdDev: number;
  connectionsMean: number;
  connectionsStdDev: number;
  avgRttMean: number;
  avgRttStdDev: number;
  avgJitterMean: number;
  avgJitterStdDev: number;
  retransmissionRateMean: number;
  retransmissionRateStdDev: number;
  sampleCount: number;
  updatedAt: number;
}

export interface AnalyticsData {
  timestamp: number;
  totalBytes: number;
  totalConnections: number;
  threatCount: number;
  activeDevices: number;
}

export interface ProtocolStats {
  protocol: string;
  bytes: number;
  connections: number;
  percentage: number;
}

export interface CaptureStatus {
  running: boolean;
  interface: string;
  packets_captured: number;
  flows_detected: number;
  start_time?: number;
}
