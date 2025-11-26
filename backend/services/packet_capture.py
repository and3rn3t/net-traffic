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
    from scapy.layers.dns import DNS
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    logging.warning("Scapy not available. Packet capture will be disabled.")

from models.types import NetworkFlow
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

        # Active flows tracking:
        # (src_ip, src_port, dst_ip, dst_port, protocol) -> flow_data
        self._active_flows: Dict[str, dict] = {}

        # DNS resolution cache: IP -> domain
        self._dns_cache: Dict[str, str] = {}

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
            logger.warning(
                f"Interface {self.interface} not found. "
                f"Available: {interfaces}"
            )
            if interfaces:
                self.interface = interfaces[0]
                logger.info(f"Using interface: {self.interface}")

        self._running = True
        self._capture_task = asyncio.create_task(self._capture_loop())
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
        logger.info(f"Packet capture started on {self.interface}")

    async def stop(self):
        """Stop packet capture"""
        if not self._running:
            return

        self._running = False
        
        # Cancel capture task
        if self._capture_task:
            self._capture_task.cancel()
            try:
                await self._capture_task
            except asyncio.CancelledError:
                pass
        
        # Cancel cleanup task
        if hasattr(self, '_cleanup_task') and self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Finalize all remaining active flows
        await self._finalize_all_flows()

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
            domain = await self._extract_domain_from_packet(packet, dst_ip)
            if domain:
                flow_data["domain"] = domain
                # Cache domain for this IP
                self._dns_cache[dst_ip] = domain

        except Exception as e:
            logger.error(f"Error processing packet: {e}")

    async def _periodic_cleanup(self):
        """Periodically clean up inactive flows"""
        while self._running:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                if not self._running:
                    break
                
                current_time = int(datetime.now().timestamp() * 1000)
                inactive_flows = []
                
                # Find flows inactive for more than 60 seconds
                for flow_key, flow_data in self._active_flows.items():
                    if current_time - flow_data["last_seen"] > 60000:
                        inactive_flows.append((flow_key, flow_data))
                
                # Finalize inactive flows
                for flow_key, flow_data in inactive_flows:
                    await self._finalize_flow(flow_key, flow_data)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")

    async def _finalize_all_flows(self):
        """Finalize all active flows (called on shutdown)"""
        for flow_key, flow_data in self._active_flows.items():
            try:
                await self._finalize_flow(flow_key, flow_data)
            except Exception as e:
                logger.error(
                    f"Error finalizing flow {flow_key}: {e}"
                )

    async def _extract_domain_from_packet(self, packet, ip: str) -> Optional[str]:
        """Extract domain name from DNS packet or use cache"""
        # Check DNS cache first
        if ip in self._dns_cache:
            return self._dns_cache[ip]
        
        # Try to extract from DNS response packet
        if packet.haslayer(DNS):
            dns = packet[DNS]
            # DNS response (qr=1)
            if dns.qr == 1 and dns.an:
                # Check if this is a response for the IP we're interested in
                for i in range(dns.ancount):
                    if dns.an[i].type == 1:  # A record
                        response_ip = dns.an[i].rdata
                        if response_ip == ip and dns.qd:
                            # Get the queried domain name
                            query_name = dns.qd.qname.decode('utf-8').rstrip('.')
                            self._dns_cache[ip] = query_name
                            return query_name
                # Check for CNAME records
                for i in range(dns.ancount):
                    if dns.an[i].type == 5:  # CNAME record
                        if dns.qd:
                            query_name = dns.qd.qname.decode('utf-8').rstrip('.')
                            self._dns_cache[ip] = query_name
                            return query_name
        
        # Try reverse DNS lookup for destination IP
        # (if not already cached)
        if ip not in self._dns_cache:
            try:
                import socket
                # Only do reverse lookup for non-local IPs
                if not self._is_local_ip(ip):
                    hostname = socket.gethostbyaddr(ip)[0]
                    if hostname and hostname != ip:
                        domain = (
                            hostname.split('.')[0]
                            if '.' in hostname
                            else hostname
                        )
                        self._dns_cache[ip] = domain
                        return domain
            except (socket.herror, socket.gaierror, OSError):
                # Reverse DNS lookup failed,
                # cache empty string to avoid retrying
                self._dns_cache[ip] = ""
        
        return None

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
            socket.inet_aton(ip)
            # Private IP ranges
            return (
                ip.startswith("192.168.") or
                ip.startswith("10.") or
                ip.startswith("172.16.") or
                ip.startswith("127.") or
                ip.startswith("169.254.")  # Link-local
            )
        except (socket.error, OSError):
            return False

    async def _finalize_flow(self, flow_key: str, flow_data: dict):
        """Finalize and save flow"""
        try:
            # Determine threat level
            threat_level = "safe"
            if self.threat_service:
                threat_level = await self.threat_service.analyze_flow(flow_data)

            # Get domain from cache or flow data
            domain = (
                flow_data.get("domain") or
                self._dns_cache.get(flow_data["dest_ip"])
            )
            
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
                deviceId=flow_data["device_id"],
                domain=domain if domain else None
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

