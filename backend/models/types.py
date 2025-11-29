"""
Type definitions matching frontend types
"""
from typing import Optional, List
from pydantic import BaseModel


class NetworkFlow(BaseModel):
    id: str
    timestamp: int  # Unix timestamp in milliseconds
    sourceIp: str
    sourcePort: int
    destIp: str
    destPort: int
    protocol: str
    bytesIn: int
    bytesOut: int
    packetsIn: int
    packetsOut: int
    duration: int
    status: str  # 'active' | 'closed'
    country: Optional[str] = None
    city: Optional[str] = None
    asn: Optional[int] = None  # Autonomous System Number
    domain: Optional[str] = None
    sni: Optional[str] = None  # Server Name Indication from TLS
    threatLevel: str  # 'safe' | 'low' | 'medium' | 'high' | 'critical'
    deviceId: str
    # TCP layer details
    tcpFlags: Optional[List[str]] = None  # SYN, ACK, FIN, RST, PSH, URG
    ttl: Optional[int] = None  # Time To Live
    connectionState: Optional[str] = None  # SYN_SENT, ESTABLISHED, FIN_WAIT, etc.
    # Network quality metrics
    rtt: Optional[int] = None  # Round-trip time in milliseconds
    retransmissions: Optional[int] = None
    jitter: Optional[float] = None  # Packet delay variation
    # Application layer
    application: Optional[str] = None  # HTTP, HTTPS, SSH, FTP, etc.
    userAgent: Optional[str] = None  # From HTTP headers
    httpMethod: Optional[str] = None  # GET, POST, PUT, DELETE, etc.
    url: Optional[str] = None  # From HTTP requests
    # DNS details
    dnsQueryType: Optional[str] = None  # A, AAAA, MX, TXT, etc.
    dnsResponseCode: Optional[str] = None  # NOERROR, NXDOMAIN, etc.


class Device(BaseModel):
    id: str
    name: str
    ip: str
    mac: str
    type: str  # 'smartphone' | 'laptop' | 'desktop' | 'tablet' | 'iot' | 'server' | 'unknown'
    vendor: str
    os: Optional[str] = None  # Detected operating system
    firstSeen: int  # Unix timestamp
    lastSeen: int  # Unix timestamp
    bytesTotal: int
    connectionsCount: int
    threatScore: float
    behavioral: dict  # Contains peakHours, commonPorts, commonDomains, anomalyCount, applications
    # Enhanced fields
    ipv6Support: Optional[bool] = None
    avgRtt: Optional[float] = None  # Average round-trip time
    connectionQuality: Optional[str] = None  # 'good' | 'fair' | 'poor'
    applications: Optional[List[str]] = None  # Detected applications


class Threat(BaseModel):
    id: str
    timestamp: int  # Unix timestamp
    type: str  # 'malware' | 'exfiltration' | 'scan' | 'botnet' | 'phishing' | 'anomaly'
    severity: str  # 'low' | 'medium' | 'high' | 'critical'
    deviceId: str
    flowId: str
    description: str
    recommendation: str
    dismissed: bool = False


class AnalyticsData(BaseModel):
    timestamp: int  # Unix timestamp
    totalBytes: int
    totalConnections: int
    threatCount: int
    activeDevices: int


class ProtocolStats(BaseModel):
    protocol: str
    bytes: int
    connections: int
    percentage: float

