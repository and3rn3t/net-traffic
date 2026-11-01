"""
Type definitions matching frontend types
"""

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
    country: str | None = None
    city: str | None = None
    asn: int | None = None  # Autonomous System Number
    domain: str | None = None
    sni: str | None = None  # Server Name Indication from TLS
    threatLevel: str  # 'safe' | 'low' | 'medium' | 'high' | 'critical'
    deviceId: str
    # TCP layer details
    tcpFlags: list[str] | None = None  # SYN, ACK, FIN, RST, PSH, URG
    ttl: int | None = None  # Time To Live
    connectionState: str | None = None  # SYN_SENT, ESTABLISHED, FIN_WAIT, etc.
    # Network quality metrics
    rtt: int | None = None  # Round-trip time in milliseconds
    retransmissions: int | None = None
    jitter: float | None = None  # Packet delay variation
    # Application layer
    application: str | None = None  # HTTP, HTTPS, SSH, FTP, etc.
    userAgent: str | None = None  # From HTTP headers
    httpMethod: str | None = None  # GET, POST, PUT, DELETE, etc.
    url: str | None = None  # From HTTP requests
    httpHost: str | None = None  # Host header from HTTP requests
    httpStatusCode: int | None = None  # Status code from HTTP responses
    # DNS details
    dnsQueryType: str | None = None  # A, AAAA, MX, TXT, etc.
    dnsResponseCode: str | None = None  # NOERROR, NXDOMAIN, etc.
    dnsQueryName: str | None = None  # The domain name being queried
    dnsAnswers: list[str] | None = None  # Resolved IPs/CNAMEs from a DNS response
    # TLS details
    tlsVersion: str | None = None  # e.g. "TLS 1.2", "TLS 1.3", from ClientHello


class Device(BaseModel):
    id: str
    name: str
    ip: str
    mac: str
    type: str  # 'smartphone' | 'laptop' | 'desktop' | 'tablet' | 'iot' | 'server' | 'unknown'
    vendor: str
    os: str | None = None  # Detected operating system
    firstSeen: int  # Unix timestamp
    lastSeen: int  # Unix timestamp
    bytesTotal: int
    connectionsCount: int
    threatScore: float
    behavioral: dict  # Contains peakHours, commonPorts, commonDomains, anomalyCount, applications, notes
    notes: str | None = None  # User-added notes about the device
    # Enhanced fields
    ipv6Support: bool | None = None
    avgRtt: float | None = None  # Average round-trip time
    connectionQuality: str | None = None  # 'good' | 'fair' | 'poor'
    applications: list[str] | None = None  # Detected applications
    tags: list[str] | None = None  # User-defined tags/groups, e.g. 'iot', 'trusted', 'guest'


class FilterPreset(BaseModel):
    id: str
    userId: str
    name: str
    filters: dict
    createdAt: int  # Unix timestamp in milliseconds


class Threat(BaseModel):
    id: str
    timestamp: int  # Unix timestamp
    type: str  # 'malware' | 'exfiltration' | 'scan' | 'botnet' | 'phishing' | 'anomaly' | 'new_device' | 'bandwidth_quota'
    severity: str  # 'low' | 'medium' | 'high' | 'critical'
    deviceId: str
    flowId: str
    description: str
    recommendation: str
    dismissed: bool = False
    occurrenceCount: int = 1  # Repeated same type+device threats increment this instead of duplicating rows


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

