"""
Packet capture service using Scapy
Captures network traffic and extracts flow information
"""
import asyncio
import logging
import socket
from typing import Optional, Callable, Dict
from datetime import datetime
import uuid

try:
    from scapy.all import sniff, get_if_list, IP, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    logging.warning("Scapy not available. Packet capture will be disabled.")

from models.types import NetworkFlow, Device
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.storage import StorageService

logger = logging.getLogger(__name__)


class PacketCaptureService:
    def __init__(
        self,
        interface: str = "eth0",
        device_service: Optional[DeviceFingerprintingService] = None,
        threat_service: Optional[ThreatDetectionService] = None,
        storage: Optional[StorageService] = None,
        on_flow_update: Optional[Callable] = None
    ):
        self.interface = interface
        self.device_service = device_service
        self.threat_service = threat_service
        self.storage = storage
        self.on_flow_update = on_flow_update

        self._running = False
        self._capture_task: Optional[asyncio.Task] = None
        self.packets_captured = 0
        self.flows_detected = 0

        # Active flows tracking: (src_ip, src_port, dst_ip, dst_port, protocol) -> flow_data
        self._active_flows: Dict[str, dict] = {}

    def is_running(self) -> bool:
        """Check if capture is running"""
        return self._running

    async def start(self):
        """Start packet capture"""
        if not SCAPY_AVAILABLE:
            logger.error("Scapy not available. Cannot start packet capture.")
            return

        if self._running:
            logger.warning("Packet capture already running")
            return

        # Verify interface exists
        interfaces = get_if_list()
        if self.interface not in interfaces:
            logger.warning(f"Interface {self.interface} not found. Available: {interfaces}")
            if interfaces:
                self.interface = interfaces[0]
                logger.info(f"Using interface: {self.interface}")

        self._running = True
        self._capture_task = asyncio.create_task(self._capture_loop())
        logger.info(f"Packet capture started on {self.interface}")

    async def stop(self):
        """Stop packet capture"""
        if not self._running:
            return

        self._running = False
        if self._capture_task:
            self._capture_task.cancel()
            try:
                await self._capture_task
            except asyncio.CancelledError:
                pass

        logger.info("Packet capture stopped")

    async def _capture_loop(self):
        """Main capture loop - runs packet capture in executor"""
        loop = asyncio.get_event_loop()

        def packet_handler(packet):
            """Handle captured packet"""
            try:
                self.packets_captured += 1
                asyncio.run_coroutine_threadsafe(
                    self._process_packet(packet),
                    loop
                )
            except Exception as e:
                logger.error(f"Error processing packet: {e}")

        try:
            # Run sniff in executor (blocking call)
            await asyncio.to_thread(
                sniff,
                iface=self.interface,
                prn=packet_handler,
                stop_filter=lambda x: not self._running,
                store=False
            )
        except Exception as e:
            logger.error(f"Capture error: {e}")
            self._running = False

    async def _process_packet(self, packet):
        """Process captured packet and extract flow information"""
        try:
            # Extract IP layer
            if not packet.haslayer(IP):
                return

            ip_layer = packet[IP]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst

            # Determine protocol and ports
            protocol = "OTHER"
            src_port = 0
            dst_port = 0

            if packet.haslayer(TCP):
                protocol = "TCP"
                tcp_layer = packet[TCP]
                src_port = tcp_layer.sport
                dst_port = tcp_layer.dport
            elif packet.haslayer(UDP):
                protocol = "UDP"
                udp_layer = packet[UDP]
                src_port = udp_layer.sport
                dst_port = udp_layer.dport
            elif packet.haslayer(ICMP):
                protocol = "ICMP"
            elif packet.haslayer(ARP):
                protocol = "ARP"
                # Handle ARP for device discovery
                if self.device_service:
                    await self.device_service.process_arp_packet(packet)
                return
            else:
                return

            # Skip if no valid ports
            if protocol in ["TCP", "UDP"] and (src_port == 0 or dst_port == 0):
                return

            # Create flow key
            flow_key = f"{src_ip}:{src_port}-{dst_ip}:{dst_port}-{protocol}"
            reverse_key = f"{dst_ip}:{dst_port}-{src_ip}:{src_port}-{protocol}"

            # Get packet size
            packet_size = len(packet)
            timestamp_ms = int(datetime.now().timestamp() * 1000)

            # Determine direction (incoming vs outgoing)
            is_incoming = self._is_local_ip(dst_ip)

            # Find or create flow
            flow_data = self._active_flows.get(flow_key) or self._active_flows.get(reverse_key)

            if flow_data:
                # Update existing flow
                if is_incoming:
                    flow_data["bytes_in"] += packet_size
                    flow_data["packets_in"] += 1
                else:
                    flow_data["bytes_out"] += packet_size
                    flow_data["packets_out"] += 1
                flow_data["last_seen"] = timestamp_ms
                flow_data["duration"] = timestamp_ms - flow_data["first_seen"]
            else:
                # Create new flow
                # Determine source device
                device_id = await self._get_or_create_device(src_ip, packet)

                flow_data = {
                    "id": str(uuid.uuid4()),
                    "source_ip": src_ip,
                    "source_port": src_port,
                    "dest_ip": dst_ip,
                    "dest_port": dst_port,
                    "protocol": protocol,
                    "bytes_in": packet_size if is_incoming else 0,
                    "bytes_out": packet_size if not is_incoming else 0,
                    "packets_in": 1 if is_incoming else 0,
                    "packets_out": 1 if not is_incoming else 0,
                    "first_seen": timestamp_ms,
                    "last_seen": timestamp_ms,
                    "duration": 0,
                    "device_id": device_id,
                    "status": "active"
                }

                self._active_flows[flow_key] = flow_data
                self.flows_detected += 1

            # Extract domain from DNS (if available)
            # TODO: Add DNS parsing

            # Periodically flush active flows (every 60 seconds of inactivity)
            if timestamp_ms - flow_data["last_seen"] > 60000:
                await self._finalize_flow(flow_key, flow_data)

        except Exception as e:
            logger.error(f"Error processing packet: {e}")

    async def _get_or_create_device(self, ip: str, packet) -> str:
        """Get or create device from IP address"""
        if not self.device_service:
            return "unknown"

        # Extract MAC from Ethernet layer
        mac = None
        if packet.haslayer(Ether):
            mac = packet[Ether].src

        device = await self.device_service.get_or_create_device(ip, mac, packet)
        return device.id

    def _is_local_ip(self, ip: str) -> bool:
        """Check if IP is local/private"""
        try:
            ip_obj = socket.inet_aton(ip)
            # Private IP ranges
            return (
                ip.startswith("192.168.") or
                ip.startswith("10.") or
                ip.startswith("172.16.") or
                ip.startswith("127.") or
                ip.startswith("169.254.")  # Link-local
            )
        except:
            return False

    async def _finalize_flow(self, flow_key: str, flow_data: dict):
        """Finalize and save flow"""
        try:
            # Determine threat level
            threat_level = "safe"
            if self.threat_service:
                threat_level = await self.threat_service.analyze_flow(flow_data)

            # Create NetworkFlow object
            flow = NetworkFlow(
                id=flow_data["id"],
                timestamp=flow_data["first_seen"],
                sourceIp=flow_data["source_ip"],
                sourcePort=flow_data["source_port"],
                destIp=flow_data["dest_ip"],
                destPort=flow_data["dest_port"],
                protocol=flow_data["protocol"],
                bytesIn=flow_data["bytes_in"],
                bytesOut=flow_data["bytes_out"],
                packetsIn=flow_data["packets_in"],
                packetsOut=flow_data["packets_out"],
                duration=flow_data["duration"],
                status="closed",
                threatLevel=threat_level,
                deviceId=flow_data["device_id"]
            )

            # Save to storage
            if self.storage:
                await self.storage.add_flow(flow)

            # Notify clients
            if self.on_flow_update:
                await self.on_flow_update({
                    "type": "flow_update",
                    "flow": flow.dict()
                })

            # Remove from active flows
            if flow_key in self._active_flows:
                del self._active_flows[flow_key]

        except Exception as e:
            logger.error(f"Error finalizing flow: {e}")

