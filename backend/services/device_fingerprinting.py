"""
Device fingerprinting and identification service
"""
import logging
import uuid
import socket
from typing import Optional, Callable
from datetime import datetime
import re

try:
    from scapy.all import ARP, Ether
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

from models.types import Device
from services.storage import StorageService

logger = logging.getLogger(__name__)

# Vendor MAC prefixes (simplified - in production, use full OUI database)
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


class DeviceFingerprintingService:
    def __init__(self, storage: StorageService, on_device_update: Optional[Callable] = None):
        self.storage = storage
        self.on_device_update = on_device_update

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

    async def get_or_create_device(self, ip: str, mac: Optional[str] = None,
                                   packet=None) -> Device:
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
        device_type = self._detect_device_type(ip, mac, packet)
        vendor = self._detect_vendor(mac) if mac else "Unknown"
        device_name = self._generate_device_name(ip, vendor, device_type)

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

        return device

    def _detect_device_type(self, ip: str, mac: Optional[str], packet) -> str:
        """Detect device type from IP, MAC, and traffic patterns"""
        # Check if it's a router/gateway (typically .1)
        if ip.endswith(".1"):
            return "server"

        # Check vendor from MAC
        if mac:
            mac_prefix = mac.upper()[:8]
            if any(v in mac_prefix for v in ["B8:27:EB", "DC:A6:32", "E4:5F:01"]):
                return "server"  # Raspberry Pi

        # Default to unknown - could be improved with more heuristics
        return "unknown"

    def _detect_vendor(self, mac: str) -> str:
        """Detect vendor from MAC address OUI"""
        if not mac:
            return "Unknown"

        mac_prefix = mac.upper()[:8]

        for prefix, vendor in VENDOR_DB.items():
            if mac_prefix.startswith(prefix):
                return vendor

        return "Unknown"

    def _generate_device_name(self, ip: str, vendor: str, device_type: str) -> str:
        """Generate device name"""
        # Try to resolve hostname
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            if hostname and hostname != ip:
                return hostname.split('.')[0]
        except:
            pass

        # Fallback to vendor + type
        if vendor != "Unknown":
            return f"{vendor} {device_type.title()}"

        return f"Device {ip.split('.')[-1]}"

