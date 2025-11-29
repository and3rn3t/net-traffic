"""
Geolocation service using GeoIP2
"""
import logging
from typing import Optional, Dict, Tuple
import socket

try:
    import geoip2.database
    import geoip2.errors
    GEOIP_AVAILABLE = True
except ImportError:
    GEOIP_AVAILABLE = False
    logging.warning("GeoIP2 not available. Geolocation will be disabled.")

logger = logging.getLogger(__name__)


class GeolocationService:
    """Service for IP geolocation using MaxMind GeoIP2 database"""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize geolocation service

        Args:
            db_path: Path to GeoLite2 database file. If None, will try to use
                     system-installed database or download one.
        """
        self.db_path = db_path
        self.reader: Optional[geoip2.database.Reader] = None
        self._initialized = False

        if GEOIP_AVAILABLE:
            self._initialize()

    def _initialize(self):
        """Initialize GeoIP2 database reader"""
        if not GEOIP_AVAILABLE:
            return

        # Try to find database
        possible_paths = [
            self.db_path,
            "/usr/share/GeoIP/GeoLite2-City.mmdb",
            "/usr/local/share/GeoIP/GeoLite2-City.mmdb",
            "/var/lib/GeoIP/GeoLite2-City.mmdb",
            "./GeoLite2-City.mmdb",
        ]

        for db_path in possible_paths:
            if db_path and self._try_open_db(db_path):
                logger.info(f"GeoIP2 database loaded: {db_path}")
                self._initialized = True
                return

        logger.warning(
            "GeoIP2 database not found. Geolocation will be disabled. "
            "Download from: https://dev.maxmind.com/geoip/geoip2/geolite2/"
        )

    def _try_open_db(self, db_path: str) -> bool:
        """Try to open GeoIP2 database"""
        try:
            self.reader = geoip2.database.Reader(db_path)
            return True
        except (FileNotFoundError, geoip2.errors.AddressNotFoundError, Exception) as e:
            logger.debug(f"Could not open GeoIP2 database at {db_path}: {e}")
            return False

    def get_location(self, ip: str) -> Dict[str, Optional[str]]:
        """
        Get geolocation information for an IP address

        Returns:
            Dict with keys: country, city, asn (if available)
        """
        if not self._initialized or not self.reader:
            return {"country": None, "city": None, "asn": None}

        # Skip local/private IPs
        if self._is_local_ip(ip):
            return {"country": None, "city": None, "asn": None}

        try:
            response = self.reader.city(ip)

            country = response.country.iso_code if response.country.iso_code else None
            city = response.city.name if response.city.name else None

            # Try to get ASN (requires GeoLite2-ASN database)
            asn = None
            try:
                # This would require a separate ASN database
                # For now, we'll leave it as None
                pass
            except:
                pass

            return {
                "country": country,
                "city": city,
                "asn": asn
            }
        except geoip2.errors.AddressNotFoundError:
            return {"country": None, "city": None, "asn": None}
        except Exception as e:
            logger.debug(f"Error getting location for {ip}: {e}")
            return {"country": None, "city": None, "asn": None}

    def _is_local_ip(self, ip: str) -> bool:
        """Check if IP is local/private"""
        try:
            socket.inet_aton(ip)
            return (
                ip.startswith("192.168.") or
                ip.startswith("10.") or
                ip.startswith("172.16.") or
                ip.startswith("127.") or
                ip.startswith("169.254.")  # Link-local
            )
        except (socket.error, OSError):
            return False

    def close(self):
        """Close GeoIP2 database reader"""
        if self.reader:
            self.reader.close()
            self.reader = None
            self._initialized = False

