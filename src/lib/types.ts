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
  // DNS details
  dnsQueryType?: string;
  dnsResponseCode?: string;
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
}

export interface Threat {
  id: string;
  timestamp: number;
  type: 'malware' | 'exfiltration' | 'scan' | 'botnet' | 'phishing' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviceId: string;
  flowId: string;
  description: string;
  recommendation: string;
  dismissed: boolean;
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
