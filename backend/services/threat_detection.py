"""
Threat detection and analysis service
"""
import logging
from typing import Dict, Optional, Callable
from datetime import datetime
import uuid

from models.types import Threat
from services.storage import StorageService
from utils.constants import (
    LARGE_UPLOAD_BYTES,
    SUSPICIOUS_PORTS,
    HIGH_PACKET_COUNT,
    LOW_DATA_TRANSFER,
    HIGH_JITTER_MS,
    HIGH_RTT_MS,
    THREAT_SCORE_CRITICAL,
    THREAT_SCORE_HIGH,
    THREAT_SCORE_MEDIUM,
    THREAT_SCORE_LOW,
    HIGH_RETRANSMISSION_RATE,
    SUSPICIOUS_DOMAIN_PATTERNS,
    HIGH_RISK_COUNTRIES,
    ALLOWED_APPLICATIONS,
    DNS_NOERROR,
    THREAT_SCORE_EXFILTRATION,
    THREAT_SCORE_SUSPICIOUS_PORT,
    THREAT_SCORE_PORT_SCAN,
    THREAT_SCORE_TCP_ANOMALY,
    THREAT_SCORE_CONNECTION_RESET,
    THREAT_SCORE_HIGH_RETRANSMISSION,
    THREAT_SCORE_HIGH_JITTER,
    THREAT_SCORE_HIGH_RTT,
    THREAT_SCORE_SUSPICIOUS_DOMAIN,
    THREAT_SCORE_HIGH_RISK_COUNTRY,
    THREAT_SCORE_UNAUTHORIZED_APP,
    THREAT_SCORE_DNS_ANOMALY,
    DDoS_RETRANSMISSION_THRESHOLD,
    DDoS_JITTER_THRESHOLD,
)

logger = logging.getLogger(__name__)


class ThreatDetectionService:
    def __init__(self, storage: StorageService, on_threat_update: Optional[Callable] = None):
        self.storage = storage
        self.on_threat_update = on_threat_update

    async def analyze_flow(self, flow_data: Dict) -> str:
        """Analyze flow and determine threat level using enhanced data"""
        threat_level = "safe"
        threat_score = 0

        # 1. High data exfiltration
        bytes_out = flow_data.get("bytes_out", 0)
        if bytes_out > LARGE_UPLOAD_BYTES:
            threat_score += THREAT_SCORE_EXFILTRATION
            threat_level = "medium"

        # 2. Unusual ports
        dest_port = flow_data.get("dest_port", 0)
        if dest_port in SUSPICIOUS_PORTS:
            threat_score += THREAT_SCORE_SUSPICIOUS_PORT
            threat_level = "high"

        # 3. Port scanning pattern
        total_packets = flow_data.get("packets_in", 0) + flow_data.get("packets_out", 0)
        if total_packets > HIGH_PACKET_COUNT and flow_data.get("bytes_in", 0) < LOW_DATA_TRANSFER:
            threat_score += THREAT_SCORE_PORT_SCAN
            threat_level = "low"

        # 4. TCP connection anomalies (NEW)
        tcp_flags = flow_data.get("tcp_flags", [])
        if "RST" in tcp_flags and "SYN" not in tcp_flags:
            # RST without proper handshake = port scan
            threat_score += THREAT_SCORE_TCP_ANOMALY
            if threat_level == "safe":
                threat_level = "low"

        connection_state = flow_data.get("connection_state", "")
        if connection_state == "RESET":
            threat_score += THREAT_SCORE_CONNECTION_RESET

        # 5. High retransmission rate (NEW) - indicates network attack
        retransmissions = flow_data.get("retransmissions", 0)
        total_packets = (
            flow_data.get("packets_in", 0) + flow_data.get("packets_out", 0)
        )
        if total_packets > 0:
            retransmission_rate = (retransmissions / total_packets) * 100
            if retransmission_rate > HIGH_RETRANSMISSION_RATE:
                threat_score += THREAT_SCORE_HIGH_RETRANSMISSION
                if threat_level == "safe":
                    threat_level = "low"

        # 6. Poor connection quality (NEW) - could indicate DDoS
        jitter = flow_data.get("jitter")
        rtt = flow_data.get("rtt")
        if jitter and jitter > HIGH_JITTER_MS:
            threat_score += THREAT_SCORE_HIGH_JITTER
        if rtt and rtt > HIGH_RTT_MS:
            threat_score += THREAT_SCORE_HIGH_RTT

        # 7. Suspicious SNI/domains (NEW)
        sni = flow_data.get("sni") or flow_data.get("domain")
        if sni:
            # Check for suspicious patterns
            has_suspicious_pattern = any(
                pattern in sni.lower() for pattern in SUSPICIOUS_DOMAIN_PATTERNS
            )
            if has_suspicious_pattern:
                threat_score += THREAT_SCORE_SUSPICIOUS_DOMAIN
                if threat_level in ["safe", "low"]:
                    threat_level = "medium"

        # 8. High-risk geolocation (NEW)
        country = flow_data.get("country")
        if country in HIGH_RISK_COUNTRIES:
            threat_score += THREAT_SCORE_HIGH_RISK_COUNTRY
            if threat_level == "safe":
                threat_level = "low"

        # 9. Unauthorized applications (NEW)
        application = flow_data.get("application")
        if application and application not in ALLOWED_APPLICATIONS:
            # Unknown/unusual application
            threat_score += THREAT_SCORE_UNAUTHORIZED_APP

        # 10. DNS anomalies (NEW)
        dns_response_code = flow_data.get("dns_response_code")
        if dns_response_code and dns_response_code not in [DNS_NOERROR, None]:
            threat_score += THREAT_SCORE_DNS_ANOMALY

        # Determine final threat level based on score
        if threat_score >= THREAT_SCORE_CRITICAL:
            threat_level = "critical"
        elif threat_score >= THREAT_SCORE_HIGH:
            threat_level = "high"
        elif threat_score >= THREAT_SCORE_MEDIUM:
            threat_level = "medium"
        elif threat_score >= THREAT_SCORE_LOW:
            threat_level = "low"

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

            # Notify of new threat
            if self.on_threat_update:
                await self.on_threat_update(threat)

        except Exception as e:
            logger.error(f"Error creating threat: {e}")

    def _classify_threat(self, flow_data: Dict) -> str:
        """Classify threat type using enhanced data"""
        # Exfiltration
        if flow_data.get("bytes_out", 0) > LARGE_UPLOAD_BYTES:
            return "exfiltration"

        # Port scan (enhanced detection)
        tcp_flags = flow_data.get("tcp_flags", [])
        if "RST" in tcp_flags and "SYN" not in tcp_flags:
            return "scan"

        total_packets = flow_data.get("packets_in", 0) + flow_data.get("packets_out", 0)
        if total_packets > HIGH_PACKET_COUNT and flow_data.get("bytes_in", 0) < LOW_DATA_TRANSFER:
            return "scan"

        # DDoS/Network attack (high retransmissions + jitter)
        retransmissions = flow_data.get("retransmissions", 0)
        jitter = flow_data.get("jitter", 0)
        if retransmissions > DDoS_RETRANSMISSION_THRESHOLD and jitter > DDoS_JITTER_THRESHOLD:
            return "botnet"  # Could be DDoS

        # Phishing (suspicious domains)
        sni = flow_data.get("sni") or flow_data.get("domain")
        if sni:
            if any(pattern in sni.lower() for pattern in SUSPICIOUS_DOMAIN_PATTERNS):
                return "phishing"

        # Default to anomaly
        return "anomaly"

    def _generate_threat_description(self, flow_data: Dict, threat_type: str) -> str:
        """Generate human-readable threat description with enhanced details"""
        dest_ip = flow_data.get("dest_ip", "unknown")
        dest_port = flow_data.get("dest_port", 0)
        country = flow_data.get("country")
        sni = flow_data.get("sni") or flow_data.get("domain")

        descriptions = {
            "exfiltration": (
                f"Large data exfiltration detected: "
                f"{flow_data.get('bytes_out', 0) / 1024 / 1024:.2f} MB to "
                f"{sni or dest_ip}{' (' + country + ')' if country else ''}"
            ),
            "scan": (
                f"Port scanning detected on port {dest_port} "
                f"({flow_data.get('source_ip', 'unknown')} → {dest_ip})"
            ),
            "botnet": (
                f"Potential DDoS/network attack: "
                f"{flow_data.get('retransmissions', 0)} retransmissions, "
                f"jitter: {flow_data.get('jitter', 0):.1f}ms"
            ),
            "phishing": (
                f"Suspicious domain detected: {sni or dest_ip} "
                f"{'(' + country + ')' if country else ''}"
            ),
            "anomaly": (
                f"Behavioral anomaly: {flow_data.get('application', 'unknown protocol')} "
                f"connection to {sni or dest_ip}"
            )
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

