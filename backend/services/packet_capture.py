"""
Packet capture service using Scapy
Captures network traffic and extracts flow information
"""
import asyncio
import logging
import socket
from typing import Optional, Callable, Dict, List
from datetime import datetime
import uuid
from collections import defaultdict

try:
    from scapy.all import sniff, get_if_list, IP, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    from scapy.layers.dns import DNS
    try:
        from scapy.layers.http import HTTPRequest
    except ImportError:
        HTTPRequest = None
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    HTTPRequest = None
    logging.warning("Scapy not available. Packet capture will be disabled.")

from models.types import NetworkFlow
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.storage import StorageService
from services.geolocation import GeolocationService

logger = logging.getLogger(__name__)


class PacketCaptureService:
    def __init__(
        self,
        interface: str = "eth0",
        device_service: Optional[DeviceFingerprintingService] = None,
        threat_service: Optional[ThreatDetectionService] = None,
        storage: Optional[StorageService] = None,
        geolocation_service: Optional[GeolocationService] = None,
        on_flow_update: Optional[Callable] = None
    ):
        self.interface = interface
        self.device_service = device_service
        self.threat_service = threat_service
        self.storage = storage
        self.geolocation_service = geolocation_service
        self.on_flow_update = on_flow_update

        self._running = False
        self._capture_task: Optional[asyncio.Task] = None
        self.packets_captured = 0
        self.flows_detected = 0

        # Active flows tracking:
        # (src_ip, src_port, dst_ip, dst_port, protocol) -> flow_data
        self._active_flows: Dict[str, dict] = {}

        # Lock for thread-safe access to _active_flows
        self._flows_lock = asyncio.Lock()

        # DNS resolution cache: IP -> domain
        self._dns_cache: Dict[str, str] = {}

        # Lock for thread-safe access to _dns_cache
        self._dns_cache_lock = asyncio.Lock()

        # RTT tracking: flow_key -> list of timestamps for RTT calculation
        self._rtt_tracking: Dict[str, List[float]] = defaultdict(list)

        # Packet timestamps for jitter calculation
        self._packet_timestamps: Dict[str, List[float]] = defaultdict(list)

        # Retransmission tracking: (src_ip, src_port, dst_ip, dst_port, seq) -> count
        self._retransmissions: Dict[str, int] = defaultdict(int)

        # Connection state tracking: flow_key -> state
        self._connection_states: Dict[str, str] = {}

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

    def _extract_tcp_flags(self, packet) -> Optional[List[str]]:
        """Extract TCP flags from packet"""
        if not packet.haslayer(TCP):
            return None

        tcp = packet[TCP]
        flags = []
        if tcp.flags & 0x02:  # SYN
            flags.append("SYN")
        if tcp.flags & 0x10:  # ACK
            flags.append("ACK")
        if tcp.flags & 0x01:  # FIN
            flags.append("FIN")
        if tcp.flags & 0x04:  # RST
            flags.append("RST")
        if tcp.flags & 0x08:  # PSH
            flags.append("PSH")
        if tcp.flags & 0x20:  # URG
            flags.append("URG")

        return flags if flags else None

    def _get_connection_state(self, tcp_flags: Optional[List[str]], current_state: Optional[str]) -> str:
        """Determine TCP connection state from flags"""
        if not tcp_flags:
            return current_state or "UNKNOWN"

        flags_set = set(tcp_flags)

        if "SYN" in flags_set and "ACK" not in flags_set:
            return "SYN_SENT"
        elif "SYN" in flags_set and "ACK" in flags_set:
            return "SYN_RECEIVED"
        elif "ACK" in flags_set and "SYN" not in flags_set and "FIN" not in flags_set:
            if current_state in ["SYN_SENT", "SYN_RECEIVED"]:
                return "ESTABLISHED"
            return current_state or "ESTABLISHED"
        elif "FIN" in flags_set:
            return "FIN_WAIT"
        elif "RST" in flags_set:
            return "RESET"

        return current_state or "ESTABLISHED"

    def _extract_tls_sni(self, packet) -> Optional[str]:
        """Extract Server Name Indication (SNI) from TLS handshake"""
        try:
            # Try to find TLS layer
            if packet.haslayer("TLS"):
                tls = packet["TLS"]
                # Look for ClientHello
                if hasattr(tls, 'msg') and hasattr(tls.msg, 'ext'):
                    for ext in tls.msg.ext:
                        if hasattr(ext, 'servernames'):
                            for name in ext.servernames:
                                if hasattr(name, 'servername'):
                                    return name.servername.decode('utf-8', errors='ignore')
        except Exception:
            pass

        # Try alternative method - raw packet inspection
        try:
            raw = bytes(packet)
            # Look for SNI extension (0x0000) in TLS handshake
            sni_pattern = b'\x00\x00'
            if sni_pattern in raw:
                # Extract hostname after SNI extension
                idx = raw.find(sni_pattern)
                if idx > 0 and idx < len(raw) - 10:
                    # SNI structure: length (2 bytes) + hostname
                    length = int.from_bytes(raw[idx+2:idx+4], 'big')
                    if length > 0 and length < 256:
                        hostname = raw[idx+4:idx+4+length].decode('utf-8', errors='ignore')
                        if '.' in hostname:  # Basic validation
                            return hostname
        except Exception:
            pass

        return None

    def _extract_http_info(self, packet) -> Dict[str, Optional[str]]:
        """Extract HTTP information from packet"""
        result = {
            "method": None,
            "url": None,
            "user_agent": None,
            "application": None
        }

        try:
            # Try Scapy HTTP layer
            if HTTPRequest and packet.haslayer(HTTPRequest):
                http = packet[HTTPRequest]
                result["method"] = http.Method.decode('utf-8', errors='ignore') if hasattr(http, 'Method') else None
                result["url"] = http.Path.decode('utf-8', errors='ignore') if hasattr(http, 'Path') else None
                if hasattr(http, 'User_Agent'):
                    result["user_agent"] = http.User_Agent.decode('utf-8', errors='ignore')
                result["application"] = "HTTP"

            # Try raw packet inspection for HTTP
            raw = bytes(packet)
            if b'HTTP/' in raw or b'GET ' in raw or b'POST ' in raw:
                result["application"] = "HTTP"
                # Extract method
                if raw.startswith(b'GET '):
                    result["method"] = "GET"
                elif raw.startswith(b'POST '):
                    result["method"] = "POST"
                elif raw.startswith(b'PUT '):
                    result["method"] = "PUT"
                elif raw.startswith(b'DELETE '):
                    result["method"] = "DELETE"

                # Extract URL
                try:
                    lines = raw.split(b'\r\n')
                    if lines:
                        first_line = lines[0].decode('utf-8', errors='ignore')
                        parts = first_line.split(' ')
                        if len(parts) > 1:
                            result["url"] = parts[1]
                except:
                    pass

                # Extract User-Agent
                for line in raw.split(b'\r\n'):
                    if line.startswith(b'User-Agent:'):
                        ua = line.split(b':', 1)[1].strip().decode('utf-8', errors='ignore')
                        result["user_agent"] = ua
                        break
        except Exception as e:
            logger.debug(f"Error extracting HTTP info: {e}")
            pass

        return result

    def _detect_application(self, packet, protocol: str, dst_port: int) -> Optional[str]:
        """Detect application protocol from packet and port"""
        # Port-based detection
        port_apps = {
            80: "HTTP",
            443: "HTTPS",
            22: "SSH",
            21: "FTP",
            25: "SMTP",
            53: "DNS",
            110: "POP3",
            143: "IMAP",
            993: "IMAPS",
            995: "POP3S",
            3306: "MySQL",
            5432: "PostgreSQL",
            3389: "RDP",
            5900: "VNC",
        }

        if dst_port in port_apps:
            return port_apps[dst_port]

        # Protocol-based detection
        if protocol == "HTTP":
            return "HTTP"

        # Try to detect from packet content
        try:
            raw = bytes(packet)
            if b'SSH-' in raw:
                return "SSH"
            elif b'FTP' in raw[:100]:
                return "FTP"
            elif b'SMTP' in raw[:100]:
                return "SMTP"
        except Exception:
            pass

        return None

    def _extract_dns_details(self, packet) -> Dict[str, Optional[str]]:
        """Extract detailed DNS information"""
        result = {
            "query_type": None,
            "response_code": None
        }

        if not packet.haslayer(DNS):
            return result

        try:
            dns = packet[DNS]

            # Extract query type
            if dns.qd:
                query = dns.qd
                query_types = {
                    1: "A",
                    2: "NS",
                    5: "CNAME",
                    15: "MX",
                    16: "TXT",
                    28: "AAAA",
                }
                result["query_type"] = query_types.get(query.qtype, f"TYPE{query.qtype}")

            # Extract response code
            if dns.qr == 1:  # Response
                response_codes = {
                    0: "NOERROR",
                    1: "FORMERR",
                    2: "SERVFAIL",
                    3: "NXDOMAIN",
                    4: "NOTIMP",
                    5: "REFUSED",
                }
                result["response_code"] = response_codes.get(dns.rcode, f"RCODE{dns.rcode}")
        except Exception as e:
            logger.debug(f"Error extracting DNS details: {e}")

        return result

    def _calculate_rtt(self, flow_key: str, timestamp: float) -> Optional[int]:
        """Calculate round-trip time from packet timestamps"""
        self._rtt_tracking[flow_key].append(timestamp)

        # Keep only last 10 timestamps
        if len(self._rtt_tracking[flow_key]) > 10:
            self._rtt_tracking[flow_key] = self._rtt_tracking[flow_key][-10:]

        # Simple RTT estimation: difference between consecutive packets
        if len(self._rtt_tracking[flow_key]) >= 2:
            timestamps = self._rtt_tracking[flow_key]
            # Calculate average interval
            intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                # RTT is roughly 2x the interval for bidirectional traffic
                rtt_ms = int(avg_interval * 1000 * 2)
                return max(1, min(rtt_ms, 10000))  # Clamp between 1ms and 10s

        return None

    def _calculate_jitter(self, flow_key: str, timestamp: float) -> Optional[float]:
        """Calculate jitter (packet delay variation)"""
        self._packet_timestamps[flow_key].append(timestamp)

        # Keep only last 20 timestamps
        if len(self._packet_timestamps[flow_key]) > 20:
            self._packet_timestamps[flow_key] = self._packet_timestamps[flow_key][-20:]

        if len(self._packet_timestamps[flow_key]) >= 2:
            timestamps = self._packet_timestamps[flow_key]
            # Calculate inter-packet delays
            delays = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
            if len(delays) >= 2:
                # Jitter is the standard deviation of delays
                mean_delay = sum(delays) / len(delays)
                variance = sum((d - mean_delay) ** 2 for d in delays) / len(delays)
                jitter = variance ** 0.5
                return round(jitter * 1000, 2)  # Convert to milliseconds

        return None

    def _detect_retransmission(self, packet, flow_key: str) -> bool:
        """Detect TCP retransmissions"""
        if not packet.haslayer(TCP):
            return False

        try:
            tcp = packet[TCP]
            seq_key = f"{flow_key}:{tcp.seq}"

            if seq_key in self._retransmissions:
                self._retransmissions[seq_key] += 1
                return True
            else:
                self._retransmissions[seq_key] = 1
                return False
        except:
            return False

    async def _process_packet(self, packet):
        """Process captured packet and extract flow information"""
        try:
            # Extract IP layer
            if not packet.haslayer(IP):
                return

            ip_layer = packet[IP]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
            ttl = ip_layer.ttl

            # Determine protocol and ports
            protocol = "OTHER"
            src_port = 0
            dst_port = 0
            tcp_flags = None
            connection_state = None

            if packet.haslayer(TCP):
                protocol = "TCP"
                tcp_layer = packet[TCP]
                src_port = tcp_layer.sport
                dst_port = tcp_layer.dport
                tcp_flags = self._extract_tcp_flags(packet)
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
            timestamp_sec = datetime.now().timestamp()

            # Determine direction (incoming vs outgoing)
            is_incoming = self._is_local_ip(dst_ip)

            # Determine source device (do this outside lock to avoid blocking)
            device_id = await self._get_or_create_device(src_ip, packet)

            # Extract domain from DNS (if available) - do this outside lock
            domain = await self._extract_domain_from_packet(packet, dst_ip)

            # Extract TLS SNI
            sni = self._extract_tls_sni(packet)

            # Extract HTTP information
            http_info = self._extract_http_info(packet)

            # Extract DNS details
            dns_details = self._extract_dns_details(packet)

            # Detect application
            application = self._detect_application(packet, protocol, dst_port) or http_info.get("application")

            # Calculate network quality metrics
            rtt = self._calculate_rtt(flow_key, timestamp_sec)
            jitter = self._calculate_jitter(flow_key, timestamp_sec)
            is_retransmission = self._detect_retransmission(packet, flow_key)

            # Update connection state
            if tcp_flags:
                current_state = self._connection_states.get(flow_key)
                connection_state = self._get_connection_state(tcp_flags, current_state)
                self._connection_states[flow_key] = connection_state

            # Thread-safe access to active flows
            async with self._flows_lock:
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

                    # Update retransmission count
                    if is_retransmission:
                        flow_data["retransmissions"] = flow_data.get("retransmissions", 0) + 1

                    # Update domain/SNI if found
                    if domain:
                        flow_data["domain"] = domain
                    if sni:
                        flow_data["sni"] = sni

                    # Update application if detected
                    if application:
                        flow_data["application"] = application

                    # Update HTTP info
                    if http_info.get("method"):
                        flow_data["http_method"] = http_info["method"]
                    if http_info.get("url"):
                        flow_data["url"] = http_info["url"]
                    if http_info.get("user_agent"):
                        flow_data["user_agent"] = http_info["user_agent"]

                    # Update DNS details
                    if dns_details.get("query_type"):
                        flow_data["dns_query_type"] = dns_details["query_type"]
                    if dns_details.get("response_code"):
                        flow_data["dns_response_code"] = dns_details["response_code"]

                    # Update TCP flags and state
                    if tcp_flags:
                        if "tcp_flags" not in flow_data:
                            flow_data["tcp_flags"] = []
                        # Merge flags (keep unique)
                        existing_flags = set(flow_data["tcp_flags"])
                        existing_flags.update(tcp_flags)
                        flow_data["tcp_flags"] = list(existing_flags)

                    if connection_state:
                        flow_data["connection_state"] = connection_state

                    # Update TTL (use minimum for OS fingerprinting)
                    if "ttl" not in flow_data or ttl < flow_data["ttl"]:
                        flow_data["ttl"] = ttl

                    # Update RTT and jitter
                    if rtt:
                        if "rtt" not in flow_data:
                            flow_data["rtt"] = []
                        flow_data["rtt"].append(rtt)
                        # Keep only last 5 RTT measurements
                        if len(flow_data["rtt"]) > 5:
                            flow_data["rtt"] = flow_data["rtt"][-5:]

                    if jitter is not None:
                        flow_data["jitter"] = jitter
                else:
                    # Create new flow
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
                        "status": "active",
                        "ttl": ttl,
                        "retransmissions": 1 if is_retransmission else 0,
                    }

                    if domain:
                        flow_data["domain"] = domain
                    if sni:
                        flow_data["sni"] = sni
                    if application:
                        flow_data["application"] = application
                    if tcp_flags:
                        flow_data["tcp_flags"] = tcp_flags
                    if connection_state:
                        flow_data["connection_state"] = connection_state
                    if http_info.get("method"):
                        flow_data["http_method"] = http_info["method"]
                    if http_info.get("url"):
                        flow_data["url"] = http_info["url"]
                    if http_info.get("user_agent"):
                        flow_data["user_agent"] = http_info["user_agent"]
                    if dns_details.get("query_type"):
                        flow_data["dns_query_type"] = dns_details["query_type"]
                    if dns_details.get("response_code"):
                        flow_data["dns_response_code"] = dns_details["response_code"]
                    if rtt:
                        flow_data["rtt"] = [rtt]
                    if jitter is not None:
                        flow_data["jitter"] = jitter

                    self._active_flows[flow_key] = flow_data
                    self.flows_detected += 1

            # Cache domain outside of flows lock to avoid deadlock
            if domain:
                async with self._dns_cache_lock:
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

                # Thread-safe access to find inactive flows
                async with self._flows_lock:
                    # Find flows inactive for more than 60 seconds
                    for flow_key, flow_data in self._active_flows.items():
                        if current_time - flow_data["last_seen"] > 60000:
                            # Create a copy of flow_data to avoid holding lock during finalization
                            inactive_flows.append((flow_key, flow_data.copy()))

                # Finalize inactive flows (outside lock to avoid blocking)
                for flow_key, flow_data in inactive_flows:
                    await self._finalize_flow(flow_key, flow_data)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")

    async def _finalize_all_flows(self):
        """Finalize all active flows (called on shutdown)"""
        # Get a snapshot of all flows while holding the lock
        flows_to_finalize = []
        async with self._flows_lock:
            for flow_key, flow_data in self._active_flows.items():
                # Create a copy to avoid holding lock during finalization
                flows_to_finalize.append((flow_key, flow_data.copy()))

        # Finalize flows outside lock to avoid blocking
        for flow_key, flow_data in flows_to_finalize:
            try:
                await self._finalize_flow(flow_key, flow_data)
            except Exception as e:
                logger.error(
                    f"Error finalizing flow {flow_key}: {e}"
                )

    async def _extract_domain_from_packet(self, packet, ip: str) -> Optional[str]:
        """Extract domain name from DNS packet or use cache"""
        # Check DNS cache first (thread-safe)
        async with self._dns_cache_lock:
            if ip in self._dns_cache:
                cached = self._dns_cache[ip]
                # Return None if cached as empty string (failed lookup)
                return cached if cached else None

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
                            async with self._dns_cache_lock:
                                self._dns_cache[ip] = query_name
                            return query_name
                # Check for CNAME records
                for i in range(dns.ancount):
                    if dns.an[i].type == 5:  # CNAME record
                        if dns.qd:
                            query_name = dns.qd.qname.decode('utf-8').rstrip('.')
                            async with self._dns_cache_lock:
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
                        async with self._dns_cache_lock:
                            self._dns_cache[ip] = domain
                        return domain
            except (socket.herror, socket.gaierror, OSError):
                # Reverse DNS lookup failed,
                # cache empty string to avoid retrying
                async with self._dns_cache_lock:
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

            # Get SNI if available
            sni = flow_data.get("sni")

            # Get geolocation for destination IP
            country = None
            city = None
            asn = None
            if self.geolocation_service:
                geo_info = self.geolocation_service.get_location(flow_data["dest_ip"])
                country = geo_info.get("country")
                city = geo_info.get("city")
                asn = geo_info.get("asn")

            # Calculate average RTT
            rtt = None
            if "rtt" in flow_data and flow_data["rtt"]:
                rtt = int(sum(flow_data["rtt"]) / len(flow_data["rtt"]))

            # Get retransmission count
            retransmissions = flow_data.get("retransmissions", 0)

            # Get jitter
            jitter = flow_data.get("jitter")

            # Get TCP flags
            tcp_flags = flow_data.get("tcp_flags")

            # Get connection state
            connection_state = flow_data.get("connection_state")

            # Get TTL
            ttl = flow_data.get("ttl")

            # Get application
            application = flow_data.get("application")

            # Get HTTP info
            user_agent = flow_data.get("user_agent")
            http_method = flow_data.get("http_method")
            url = flow_data.get("url")

            # Get DNS details
            dns_query_type = flow_data.get("dns_query_type")
            dns_response_code = flow_data.get("dns_response_code")

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
                domain=domain if domain else None,
                sni=sni,
                country=country,
                city=city,
                asn=asn,
                tcpFlags=tcp_flags,
                ttl=ttl,
                connectionState=connection_state,
                rtt=rtt,
                retransmissions=retransmissions if retransmissions > 0 else None,
                jitter=jitter,
                application=application,
                userAgent=user_agent,
                httpMethod=http_method,
                url=url,
                dnsQueryType=dns_query_type,
                dnsResponseCode=dns_response_code
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

            # Thread-safe removal from active flows
            async with self._flows_lock:
                if flow_key in self._active_flows:
                    del self._active_flows[flow_key]

            # Clean up tracking data
            if flow_key in self._rtt_tracking:
                del self._rtt_tracking[flow_key]
            if flow_key in self._packet_timestamps:
                del self._packet_timestamps[flow_key]
            if flow_key in self._connection_states:
                del self._connection_states[flow_key]

        except Exception as e:
            logger.error(f"Error finalizing flow: {e}")

