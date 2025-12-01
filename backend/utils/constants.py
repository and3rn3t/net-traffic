"""
Constants for threat detection and network analysis
Consolidates magic numbers and thresholds used across the backend
"""

# Data size thresholds (in bytes)
LARGE_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
VERY_LARGE_UPLOAD_BYTES = 100 * 1024 * 1024  # 100MB

# Suspicious ports commonly used by malware/attacks
SUSPICIOUS_PORTS = [4444, 5555, 6666, 6667, 31337]

# Network thresholds
HIGH_PACKET_COUNT = 1000
LOW_DATA_TRANSFER = 1000  # bytes
HIGH_JITTER_MS = 100
HIGH_RTT_MS = 1000  # milliseconds

# Threat detection thresholds
THREAT_SCORE_CRITICAL = 70
THREAT_SCORE_HIGH = 50
THREAT_SCORE_MEDIUM = 30
THREAT_SCORE_LOW = 15

# Retransmission thresholds
HIGH_RETRANSMISSION_RATE = 10  # percentage

# Suspicious domain patterns (TLDs often used for malicious purposes)
SUSPICIOUS_DOMAIN_PATTERNS = [".tk", ".ml", ".ga", ".cf", ".xyz"]

# High-risk countries (example list - customize based on your needs)
HIGH_RISK_COUNTRIES = ["CN", "RU", "KP", "IR"]

# Allowed applications (whitelist approach)
ALLOWED_APPLICATIONS = ["HTTP", "HTTPS", "SSH", "DNS"]

# DNS response codes
DNS_NOERROR = "NOERROR"

# Device vendor MAC prefixes (OUI database - simplified)
# In production, use a full OUI database
VENDOR_DB = {
    "00:50:56": "VMware",
    "00:0C:29": "VMware",
    "00:05:69": "VMware",
    "08:00:27": "VirtualBox",
    "52:54:00": "QEMU",
    "B8:27:EB": "Raspberry Pi",
    "DC:A6:32": "Raspberry Pi",
    "E4:5F:01": "Raspberry Pi",
    "28:CD:C1": "Raspberry Pi",
    "D8:3A:DD": "Raspberry Pi",
}

# Threat score increments
THREAT_SCORE_EXFILTRATION = 30
THREAT_SCORE_SUSPICIOUS_PORT = 50
THREAT_SCORE_PORT_SCAN = 20
THREAT_SCORE_TCP_ANOMALY = 25
THREAT_SCORE_CONNECTION_RESET = 15
THREAT_SCORE_HIGH_RETRANSMISSION = 20
THREAT_SCORE_HIGH_JITTER = 10
THREAT_SCORE_HIGH_RTT = 10
THREAT_SCORE_SUSPICIOUS_DOMAIN = 30
THREAT_SCORE_HIGH_RISK_COUNTRY = 25
THREAT_SCORE_UNAUTHORIZED_APP = 15
THREAT_SCORE_DNS_ANOMALY = 10

# Retransmission and jitter thresholds for DDoS detection
DDoS_RETRANSMISSION_THRESHOLD = 10
DDoS_JITTER_THRESHOLD = 100

