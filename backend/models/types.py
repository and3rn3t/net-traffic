"""
Type definitions matching frontend types
"""
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


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
    domain: Optional[str] = None
    threatLevel: str  # 'safe' | 'low' | 'medium' | 'high' | 'critical'
    deviceId: str


class Device(BaseModel):
    id: str
    name: str
    ip: str
    mac: str
    type: str  # 'smartphone' | 'laptop' | 'desktop' | 'tablet' | 'iot' | 'server' | 'unknown'
    vendor: str
    firstSeen: int  # Unix timestamp
    lastSeen: int  # Unix timestamp
    bytesTotal: int
    connectionsCount: int
    threatScore: float
    behavioral: dict  # Contains peakHours, commonPorts, commonDomains, anomalyCount


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

