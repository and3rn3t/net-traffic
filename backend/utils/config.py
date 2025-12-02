"""
Configuration validation and management
"""
import os
import logging
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


class Config:
    """Application configuration with validation"""

    def __init__(self):
        load_dotenv()
        self._validate()

    def _validate(self):
        """Validate configuration values with enhanced checks"""
        errors: List[str] = []
        warnings: List[str] = []

        # Network interface
        interface = os.getenv("NETWORK_INTERFACE", "eth0")
        if not interface or len(interface.strip()) == 0:
            errors.append("NETWORK_INTERFACE cannot be empty")
        else:
            # Check if interface exists (platform-dependent)
            if not self._check_interface_exists(interface):
                warnings.append(
                    f"Network interface '{interface}' may not exist. "
                    "Available interfaces will be checked at startup."
                )

        # Host and port
        try:
            port = int(os.getenv("PORT", "8000"))
            if port < 1 or port > 65535:
                errors.append(f"PORT must be between 1 and 65535, got {port}")
            elif port < 1024:
                warnings.append(
                    f"Port {port} is in privileged range (< 1024). "
                    "May require root/admin privileges."
                )
        except ValueError:
            errors.append("PORT must be a valid integer")

        host = os.getenv("HOST", "0.0.0.0")
        if not host:
            errors.append("HOST cannot be empty")
        elif host not in ["0.0.0.0", "127.0.0.1", "localhost"]:
            warnings.append(
                f"Host '{host}' is not a standard binding address. "
                "Ensure it's correct for your deployment."
            )

        # Database path
        db_path = os.getenv("DB_PATH", "netinsight.db")
        if not db_path:
            errors.append("DB_PATH cannot be empty")
        else:
            db_path_obj = Path(db_path)
            db_dir = db_path_obj.parent

            # Check if directory exists and is writable
            if db_dir.exists():
                if not os.access(db_dir, os.W_OK):
                    errors.append(
                        f"Database directory '{db_dir}' is not writable"
                    )
            else:
                # Try to create parent directory
                try:
                    db_dir.mkdir(parents=True, exist_ok=True)
                    if not os.access(db_dir, os.W_OK):
                        errors.append(
                            f"Cannot write to database directory '{db_dir}'"
                        )
                except (OSError, PermissionError) as e:
                    errors.append(
                        f"Cannot create database directory '{db_dir}': {e}"
                    )

        # Data retention days
        try:
            retention = int(os.getenv("DATA_RETENTION_DAYS", "30"))
            if retention < 1:
                errors.append("DATA_RETENTION_DAYS must be at least 1")
            elif retention > 365:
                warnings.append(
                    f"Data retention of {retention} days is very long. "
                    "Consider impact on database size."
                )
        except ValueError:
            errors.append("DATA_RETENTION_DAYS must be a valid integer")

        # Rate limit
        try:
            rate_limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
            if rate_limit < 1:
                errors.append("RATE_LIMIT_PER_MINUTE must be at least 1")
            elif rate_limit > 10000:
                warnings.append(
                    f"Rate limit of {rate_limit} per minute is very high. "
                    "Consider security implications."
                )
        except ValueError:
            errors.append("RATE_LIMIT_PER_MINUTE must be a valid integer")

        # Log warnings
        if warnings:
            for warning in warnings:
                logger.warning(f"Configuration warning: {warning}")

        # Raise errors if any
        if errors:
            error_msg = "Configuration errors:\n" + "\n".join(
                f"  - {e}" for e in errors
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info("Configuration validated successfully")

    def _check_interface_exists(self, interface: str) -> bool:
        """Check if network interface exists (platform-dependent)"""
        try:
            # Try to import platform-specific modules
            if os.name == "nt":  # Windows
                import subprocess
                result = subprocess.run(
                    ["netsh", "interface", "show", "interface"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                return interface in result.stdout
            else:  # Unix-like
                import subprocess
                result = subprocess.run(
                    ["ip", "link", "show"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                return interface in result.stdout
        except Exception:
            # If check fails, assume interface might exist
            # Actual check will happen at packet capture startup
            return True

    @property
    def network_interface(self) -> str:
        """Get network interface name"""
        return os.getenv("NETWORK_INTERFACE", "eth0")

    @property
    def host(self) -> str:
        """Get server host"""
        return os.getenv("HOST", "0.0.0.0")

    @property
    def port(self) -> int:
        """Get server port"""
        return int(os.getenv("PORT", "8000"))

    @property
    def allowed_origins(self) -> list[str]:
        """Get allowed CORS origins"""
        origins = os.getenv("ALLOWED_ORIGINS", "*")
        return [o.strip() for o in origins.split(",") if o.strip()]

    @property
    def debug(self) -> bool:
        """Check if debug mode is enabled"""
        return os.getenv("DEBUG", "false").lower() == "true"

    @property
    def db_path(self) -> str:
        """Get database path"""
        return os.getenv("DB_PATH", "netinsight.db")

    @property
    def data_retention_days(self) -> int:
        """Get data retention period in days"""
        try:
            return int(os.getenv("DATA_RETENTION_DAYS", "30"))
        except ValueError:
            return 30

    @property
    def rate_limit_per_minute(self) -> int:
        """Get rate limit per minute"""
        try:
            return int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
        except ValueError:
            return 120

    @property
    def enable_dns_tracking(self) -> bool:
        """Enable DNS query tracking for IP-to-domain mapping"""
        return os.getenv("ENABLE_DNS_TRACKING", "true").lower() == "true"

    @property
    def enable_reverse_dns(self) -> bool:
        """Enable reverse DNS lookups"""
        return os.getenv("ENABLE_REVERSE_DNS", "true").lower() == "true"

    @property
    def reverse_dns_timeout(self) -> float:
        """Timeout for reverse DNS lookups (seconds)"""
        try:
            return float(os.getenv("REVERSE_DNS_TIMEOUT", "2.0"))
        except ValueError:
            return 2.0

    @property
    def reverse_dns_retries(self) -> int:
        """Number of retries for reverse DNS lookups"""
        try:
            return int(os.getenv("REVERSE_DNS_RETRIES", "2"))
        except ValueError:
            return 2

    @property
    def enable_service_fingerprinting(self) -> bool:
        """Enable service banner fingerprinting"""
        return os.getenv("ENABLE_SERVICE_FINGERPRINTING", "true").lower() == "true"

    @property
    def enable_deep_packet_inspection(self) -> bool:
        """Enable deep packet inspection for application detection"""
        return os.getenv("ENABLE_DEEP_PACKET_INSPECTION", "true").lower() == "true"

    @property
    def enable_http_host_extraction(self) -> bool:
        """Enable HTTP Host header extraction"""
        return os.getenv("ENABLE_HTTP_HOST_EXTRACTION", "true").lower() == "true"

    @property
    def enable_alpn_detection(self) -> bool:
        """Enable ALPN (Application-Layer Protocol Negotiation) detection"""
        return os.getenv("ENABLE_ALPN_DETECTION", "true").lower() == "true"

    @property
    def dns_servers(self) -> List[str]:
        """Get custom DNS servers (comma-separated)"""
        servers = os.getenv("DNS_SERVERS", "")
        if servers:
            return [s.strip() for s in servers.split(",") if s.strip()]
        return []

    @property
    def log_level(self) -> str:
        """Get logging level"""
        level = os.getenv("LOG_LEVEL", "INFO").upper()
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        return level if level in valid_levels else "INFO"

    @property
    def use_json_logging(self) -> bool:
        """Use JSON formatted logging for structured logs"""
        return os.getenv("USE_JSON_LOGGING", "true").lower() == "true"

    @property
    def log_file(self) -> Optional[str]:
        """Get log file path (None to disable file logging)"""
        log_file = os.getenv("LOG_FILE", "").strip()
        # Return None if empty, starts with # (comment), or is just whitespace
        if not log_file or log_file.startswith("#"):
            return None
        return log_file

    @property
    def redis_host(self) -> str:
        """Get Redis host for caching"""
        return os.getenv("REDIS_HOST", "localhost")

    @property
    def redis_port(self) -> int:
        """Get Redis port"""
        try:
            return int(os.getenv("REDIS_PORT", "6379"))
        except ValueError:
            return 6379


# Global config instance
config = Config()

