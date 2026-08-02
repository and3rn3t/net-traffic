"""
Device fingerprinting and identification service
"""
import logging
import uuid
import socket
from typing import Optional, Callable
from datetime import datetime

try:
    from scapy.all import ARP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

from models.types import Device, Threat
from services.storage import StorageService
from services.oui_lookup import OuiLookup, PRIVATE_RANDOMIZED_VENDOR
from utils.constants import VENDOR_DB

logger = logging.getLogger(__name__)

# Hostname substrings (checked case-insensitively) mapped to a device type.
# Checked before vendor, since a resolved hostname is a stronger signal than
# a vendor that makes many kinds of devices (e.g. Apple, Samsung).
_HOSTNAME_TYPE_HINTS = [
    (("iphone", "android", "galaxy", "pixel"), "smartphone"),
    (("ipad", "tablet"), "tablet"),
    (("macbook", "laptop", "notebook"), "laptop"),
    (("imac", "homepc", "desktop", "workstation"), "desktop"),
    (("printer",), "iot"),
    (("watch",), "iot"),
    (("appletv", "apple-tv", "roku", "firetv", "fire-tv", "chromecast", "shield"), "iot"),
    (("cam", "arlo", "ring", "nest", "doorbell"), "iot"),
    (("echo", "alexa", "homepod", "sonos", "speaker"), "iot"),
    (("switch", "accesspoint", "access-point", "router", "gateway", "poe"), "server"),
]

# Vendor substrings (checked case-insensitively) mapped to a device type, used
# only when the hostname gave no signal - limited to vendors that are
# essentially single-purpose (unlike e.g. Apple, Samsung, Intel).
_VENDOR_TYPE_HINTS = [
    (("espressif",), "iot"),
    (("sonos",), "iot"),
    (("roku",), "iot"),
    (("arlo",), "iot"),
    (("amazon",), "iot"),
    (("ubiquiti",), "server"),
]


class DeviceFingerprintingService:
    def __init__(
        self,
        storage: StorageService,
        on_device_update: Optional[Callable] = None,
        on_threat_update: Optional[Callable] = None,
        oui_lookup: Optional[OuiLookup] = None,
    ):
        self.storage = storage
        self.on_device_update = on_device_update
        self.on_threat_update = on_threat_update
        self.oui_lookup = oui_lookup or OuiLookup()

    async def process_arp_packet(self, packet):
        """Process ARP packet for device discovery"""
        if not SCAPY_AVAILABLE or not packet.haslayer(ARP):
            return

        try:
            arp = packet[ARP]
            ip = arp.psrc
            mac = arp.hwsrc

            if arp.op == 1:  # ARP request
                # Device is asking "who has this IP?"
                return

            if arp.op == 2:  # ARP reply
                # Device is announcing its IP and MAC
                await self.get_or_create_device(ip, mac, packet)

        except Exception as e:
            logger.error(f"Error processing ARP packet: {e}")

    async def get_or_create_device(
        self, ip: str, mac: Optional[str] = None, packet=None
    ) -> Device:
        """Get existing device or create new one"""
        # Try to find by MAC first (most reliable)
        device = None
        if mac:
            device = await self.storage.get_device_by_mac(mac)

        if device:
            # Update last seen
            device.lastSeen = int(datetime.now().timestamp() * 1000)
            await self.storage.upsert_device(device)
            # Notify of device update
            if self.on_device_update:
                await self.on_device_update(device)
            return device

        # Create new device
        vendor = self._detect_vendor(mac) if mac else "Unknown"
        hostname = self._resolve_hostname(ip)
        device_type = self._detect_device_type(ip, mac, vendor, hostname)
        device_name = hostname or self._fallback_device_name(ip, vendor, device_type)

        now = int(datetime.now().timestamp() * 1000)

        device = Device(
            id=str(uuid.uuid4()),
            name=device_name,
            ip=ip,
            mac=mac or "unknown",
            type=device_type,
            vendor=vendor,
            firstSeen=now,
            lastSeen=now,
            bytesTotal=0,
            connectionsCount=0,
            threatScore=0.0,
            behavioral={
                "peakHours": [],
                "commonPorts": [],
                "commonDomains": [],
                "anomalyCount": 0
            }
        )

        await self.storage.upsert_device(device)
        logger.info(f"New device discovered: {device.name} ({device.ip})")

        # Notify of new device
        if self.on_device_update:
            await self.on_device_update(device)

        # Surface first-seen devices as a dismissible, low-severity alert so
        # they're noticed immediately instead of silently appearing in the
        # device list.
        if self.on_threat_update:
            threat = Threat(
                id=str(uuid.uuid4()),
                timestamp=now,
                type="new_device",
                severity="low",
                deviceId=device.id,
                flowId="n/a",
                description=f"New device detected on the network: {device.name} ({device.ip})",
                recommendation="Verify this device is recognized. If unexpected, investigate or block it.",
                dismissed=False,
            )
            await self.storage.add_threat(threat)
            await self.on_threat_update(threat)

        return device

    def _detect_device_type(
        self,
        ip: str,
        mac: Optional[str],
        vendor: str = "Unknown",
        hostname: Optional[str] = None,
    ) -> str:
        """Infer a coarse device type from gateway heuristics, hostname keywords, and vendor"""
        # Check if it's a router/gateway (typically .1)
        if ip.endswith(".1"):
            return "server"

        # Check vendor from MAC
        if mac:
            mac_prefix = mac.upper()[:8]
            raspberry_pi_prefixes = ["B8:27:EB", "DC:A6:32", "E4:5F:01"]
            if any(v in mac_prefix for v in raspberry_pi_prefixes):
                return "server"  # Raspberry Pi

        name = (hostname or "").lower()
        for keywords, device_type in _HOSTNAME_TYPE_HINTS:
            if any(k in name for k in keywords):
                return device_type

        vendor_lower = vendor.lower()
        for keywords, device_type in _VENDOR_TYPE_HINTS:
            if any(k in vendor_lower for k in keywords):
                return device_type

        return "unknown"

    def _detect_vendor(self, mac: str) -> str:
        """Detect vendor from MAC address OUI, preferring the full offline OUI database"""
        if not mac:
            return "Unknown"

        vendor = self.oui_lookup.lookup(mac)
        if vendor:
            return vendor

        # Fall back to the small built-in table (e.g. if the OUI database
        # file hasn't been downloaded via scripts/update-oui-db.sh yet)
        mac_prefix = mac.upper()[:8]
        for prefix, legacy_vendor in VENDOR_DB.items():
            if mac_prefix.startswith(prefix):
                return legacy_vendor

        return "Unknown"

    def _resolve_hostname(self, ip: str) -> Optional[str]:
        """Try a reverse DNS lookup; returns the short hostname, or None if unresolved"""
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            if hostname and hostname != ip:
                return hostname.split('.')[0]
        except (socket.herror, OSError):
            # Hostname resolution failed - use fallback
            pass
        return None

    def _fallback_device_name(self, ip: str, vendor: str, device_type: str) -> str:
        """Build a display name when no hostname could be resolved"""
        if vendor not in ("Unknown", PRIVATE_RANDOMIZED_VENDOR):
            return f"{vendor} {device_type.title()}"

        return f"Device {ip.split('.')[-1]}"

    async def backfill_vendor_and_type(self) -> int:
        """Recompute vendor/type for all stored devices using the current OUI
        database and heuristics - run once at startup so devices created
        before an OUI database was available (or before this logic existed)
        get upgraded automatically, without touching user-assigned names."""
        updated = 0
        devices = await self.storage.get_devices()
        for device in devices:
            vendor = self._detect_vendor(device.mac)
            device_type = self._detect_device_type(device.ip, device.mac, vendor, device.name)
            if vendor == device.vendor and device_type == device.type:
                continue
            device.vendor = vendor
            device.type = device_type
            await self.storage.upsert_device(device)
            updated += 1
        if updated:
            logger.info(f"Backfilled vendor/type for {updated} existing device(s)")
        return updated



