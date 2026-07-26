"""
Constants for threat detection and network analysis
Consolidates magic numbers and thresholds used across the backend
"""

# Time constants
SECONDS_PER_HOUR = 3600
CLEANUP_INTERVAL_HOURS = 24

# Error messages class for consistent error handling
class ErrorMessages:
    """Centralized error message definitions"""
    STORAGE_NOT_INIT = "Storage service not initialized"
    DEVICE_NOT_FOUND = "Device not found"
    FLOW_NOT_FOUND = "Flow not found"
    THREAT_NOT_FOUND = "Threat not found"
    ANALYTICS_NOT_INIT = "Analytics service not initialized"
    ADV_ANALYTICS_NOT_INIT = "Advanced analytics service not initialized"
    BASELINE_NOT_INIT = "Baseline learning service not initialized"
    CAPTURE_NOT_INIT = "Packet capture service not initialized"
    UNAUTHORIZED = "Authentication required"
    FORBIDDEN = "Insufficient permissions"
    INVALID_TOKEN = "Invalid or expired token"
    INVALID_API_KEY = "Invalid API key"

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
# A RESET is only scored as suspicious below this packet count (abrupt/early
# reset, e.g. a rejected or scanned connection) - above it, RST is a normal
# way real connections end (HTTPS keep-alive, CDN behavior, etc).
EARLY_RESET_PACKET_THRESHOLD = 10
# RTT/jitter are estimated from inter-packet arrival gaps (no real
# handshake/ACK pairing). A gap larger than this is almost always
# application-level idle time (e.g. a paused keep-alive connection), not
# network delay - including it produces bogus multi-second "RTT" readings.
MAX_PLAUSIBLE_INTERVAL_SECONDS = 2.0

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

# Baseline learning / predictive anomaly detection
# EMA smoothing factor: higher = baseline adapts faster to recent activity.
BASELINE_EMA_ALPHA = 0.3
# Minimum learning cycles observed before a device's baseline is trusted
# enough to flag anomalies (avoids false positives from a single data point).
BASELINE_MIN_SAMPLES = 3
# A metric must deviate this many standard deviations above its baseline
# mean to be flagged as a predictive anomaly.
BASELINE_ANOMALY_Z_THRESHOLD = 3.0
# Minimum standard deviation used in the z-score denominator, per metric, to
# avoid division-by-near-zero flagging trivial deviations as huge anomalies
# for devices with very stable/flat historical activity.
BASELINE_MIN_STDDEV = {
    "bytesTotal": 1024.0,  # 1KB
    "connections": 1.0,
    "avgRtt": 5.0,  # ms
    "avgJitter": 2.0,  # ms
    "retransmissionRate": 1.0,  # percentage points
}
# Once a device/metric pair triggers a predictive anomaly, suppress repeat
# anomalies for the same pair for this many minutes.
BASELINE_ANOMALY_COOLDOWN_MINUTES = 60

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

