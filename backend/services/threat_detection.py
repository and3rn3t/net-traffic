"""
Threat detection and analysis service
"""
import logging
from typing import Dict, Optional
from datetime import datetime
import uuid

from models.types import Threat
from services.storage import StorageService

logger = logging.getLogger(__name__)


class ThreatDetectionService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def analyze_flow(self, flow_data: Dict) -> str:
        """Analyze flow and determine threat level"""
        # Basic threat analysis
        # In production, this would include ML models, threat intelligence feeds, etc.

        threat_level = "safe"

        # Check for suspicious patterns
        # 1. High data exfiltration
        if flow_data.get("bytes_out", 0) > 10000000:  # >10MB outbound
            threat_level = "medium"

        # 2. Unusual ports
        dest_port = flow_data.get("dest_port", 0)
        suspicious_ports = [4444, 5555, 6666, 6667, 31337]
        if dest_port in suspicious_ports:
            threat_level = "high"

        # 3. High packet count (potential scan)
        total_packets = flow_data.get("packets_in", 0) + flow_data.get("packets_out", 0)
        if total_packets > 1000 and flow_data.get("bytes_in", 0) < 1000:
            threat_level = "low"  # Port scan

        # If threat detected, create threat record
        if threat_level != "safe":
            await self._create_threat(flow_data, threat_level)

        return threat_level

    async def _create_threat(self, flow_data: Dict, threat_level: str):
        """Create threat record"""
        try:
            threat_type = self._classify_threat(flow_data)
            severity_map = {
                "safe": "low",
                "low": "low",
                "medium": "medium",
                "high": "high",
                "critical": "critical"
            }
            severity = severity_map.get(threat_level, "low")

            threat = Threat(
                id=str(uuid.uuid4()),
                timestamp=int(datetime.now().timestamp() * 1000),
                type=threat_type,
                severity=severity,
                deviceId=flow_data.get("device_id", "unknown"),
                flowId=flow_data.get("id", "unknown"),
                description=self._generate_threat_description(flow_data, threat_type),
                recommendation=self._generate_recommendation(threat_type),
                dismissed=False
            )

            await self.storage.add_threat(threat)
            logger.warning(f"Threat detected: {threat.description}")

        except Exception as e:
            logger.error(f"Error creating threat: {e}")

    def _classify_threat(self, flow_data: Dict) -> str:
        """Classify threat type"""
        # Exfiltration
        if flow_data.get("bytes_out", 0) > 10000000:
            return "exfiltration"

        # Port scan
        total_packets = flow_data.get("packets_in", 0) + flow_data.get("packets_out", 0)
        if total_packets > 1000 and flow_data.get("bytes_in", 0) < 1000:
            return "scan"

        # Default to anomaly
        return "anomaly"

    def _generate_threat_description(self, flow_data: Dict, threat_type: str) -> str:
        """Generate human-readable threat description"""
        descriptions = {
            "exfiltration": f"Unusual large data upload detected: {flow_data.get('bytes_out', 0) / 1024 / 1024:.2f} MB",
            "scan": f"Port scanning activity detected on port {flow_data.get('dest_port', 0)}",
            "anomaly": "Behavioral anomaly detected in network traffic"
        }
        return descriptions.get(threat_type, "Suspicious activity detected")

    def _generate_recommendation(self, threat_type: str) -> str:
        """Generate recommendation for threat"""
        recommendations = {
            "exfiltration": "Review device for unauthorized applications and check for data breaches",
            "scan": "Investigate device for compromise and check for malware",
            "anomaly": "Monitor device closely and investigate if behavior continues"
        }
        return recommendations.get(threat_type, "Monitor device and review network activity")

