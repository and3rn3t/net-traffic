"""
Configuration validation and management
"""
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


class Config:
    """Application configuration with validation"""

    def __init__(self):
        load_dotenv()
        self._validate()

    def _validate(self):
        """Validate configuration values"""
        errors = []

        # Network interface
        interface = os.getenv("NETWORK_INTERFACE", "eth0")
        if not interface or len(interface.strip()) == 0:
            errors.append("NETWORK_INTERFACE cannot be empty")

        # Host and port
        try:
            port = int(os.getenv("PORT", "8000"))
            if port < 1 or port > 65535:
                errors.append(f"PORT must be between 1 and 65535, got {port}")
        except ValueError:
            errors.append("PORT must be a valid integer")

        host = os.getenv("HOST", "0.0.0.0")
        if not host:
            errors.append("HOST cannot be empty")

        # Database path
        db_path = os.getenv("DB_PATH", "netinsight.db")
        if not db_path:
            errors.append(
                "DB_PATH cannot be empty"
            )

        if errors:
            error_msg = "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info("Configuration validated successfully")

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


# Global config instance
config = Config()

