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
    from scapy.all import sniff, get_if_list, IP, IPv6, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    from scapy.layers.dns import DNS
    from scapy.layers.tls.handshake import TLSClientHello
    try:
        from scapy.layers.http import HTTPRequest
    except ImportError:
        HTTPRequest = None
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    HTTPRequest = None
    IPv6 = None
    TLSClientHello = None
    logging.warning("Scapy not available. Packet capture will be disabled.")

from models.types import NetworkFlow
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.storage import StorageService
from services.geolocation import GeolocationService
from services.enhanced_identification import EnhancedIdentificationService

logger = logging.getLogger(__name__)


class PacketCaptureService:
    def __init__(
        self,
        interface: str = "eth0",
        device_service: Optional[DeviceFingerprintingService] = None,
        threat_service: Optional[ThreatDetectionService] = None,
        storage: Optional[StorageService] = None,
        geolocation_service: Optional[GeolocationService] = None,
        on_flow_update: Optional[Callable] = None,
        enhanced_identification: Optional[EnhancedIdentificationService] = None
    ):
        self.interface = interface
        self.device_service = device_service
        self.threat_service = threat_service
        self.storage = storage
        self.geolocation_service = geolocation_service
        self.on_flow_update = on_flow_update
        self.enhanced_identification = enhanced_identification

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

        # Batch write queue for database operations (Pi optimization)
        self._write_queue: List[NetworkFlow] = []
        self._write_queue_lock = asyncio.Lock()
        self._batch_size = 50  # Write in batches of 50 flows
        self._batch_interval = 5.0  # Or every 5 seconds, whichever comes first
        self._last_batch_write = datetime.now().timestamp()

        # Memory limits for Pi (prevent unbounded growth)
        self._max_active_flows = 10000  # Max concurrent flows
        self._max_dns_cache_size = 1000  # Max DNS cache entries
        self._max_rtt_tracking_size = 5000  # Max RTT tracking entries
        self._max_retransmission_tracking = 10000  # Max retransmission entries

        # Packet capture optimizations
        self._bpf_filter = None  # BPF filter string (e.g., "tcp or udp")
        self._packet_sampling_rate = 1.0  # 1.0 = capture all, 0.5 = 50%, etc.
        self._sampling_counter = 0
        self._enable_ipv6 = True  # Enable IPv6 support
        self._skip_local_traffic = False  # Skip localhost traffic
        
        # Layer cache for performance (avoid repeated haslayer() calls)
        self._layer_cache: Dict[str, bool] = {}
        self._layer_cache_size = 1000

        # Packet processing queue for batching (reduces async overhead)
        self._packet_queue: List = []
        self._packet_queue_lock = asyncio.Lock()
        self._packet_batch_size = 100  # Process packets in batches
        self._packet_queue_task: Optional[asyncio.Task] = None

        # Device lookup cache (reduce async database calls)
        self._device_cache: Dict[str, str] = {}  # IP -> device_id
        self._device_cache_ttl: Dict[str, float] = {}  # IP -> timestamp
        self._device_cache_max_age = 300.0  # 5 minutes

        # Flow key cache (avoid string concatenation overhead)
        self._flow_key_cache: Dict[tuple, str] = {}
        self._flow_key_cache_size = 5000

        # Packet deduplication (skip duplicate packets)
        self._packet_hash_cache: Dict[int, float] = {}  # hash -> timestamp
        self._packet_hash_cache_size = 10000
        self._packet_dedup_window = 0.001  # 1ms window for duplicates

        # Performance metrics
        self._processing_times: List[float] = []
        self._packets_dropped = 0
        self._packets_duplicate = 0

    def is_running(self) -> bool:
        """Check if capture is running"""
        return self._running

    async def start(self, bpf_filter: Optional[str] = None, sampling_rate: float = 1.0):
        """Start packet capture
        
        Args:
            bpf_filter: BPF filter string (e.g., "tcp or udp" to skip ICMP/ARP)
            sampling_rate: Packet sampling rate (1.0 = all, 0.5 = 50%, etc.)
        """
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

        # Set capture optimizations
        self._bpf_filter = bpf_filter or "ip or ip6"  # Default: capture IP/IPv6
        self._packet_sampling_rate = max(0.01, min(1.0, sampling_rate))  # Clamp 0.01-1.0
        
        self._running = True
        self._capture_task = asyncio.create_task(self._capture_loop())
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
        self._batch_write_task = asyncio.create_task(self._batch_write_loop())
        self._packet_queue_task = asyncio.create_task(self._process_packet_queue())
        logger.info(
            f"Packet capture started on {self.interface} "
            f"(filter: {self._bpf_filter}, sampling: {self._packet_sampling_rate*100:.1f}%)"
        )

    async def stop(self):
        """Stop packet capture"""
        if not self._running:
            return

        self._running = False

        # Flush any pending writes
        await self._flush_write_queue()

        # Cancel tasks
        if self._capture_task:
            self._capture_task.cancel()
            try:
                await self._capture_task
            except asyncio.CancelledError:
                pass

        if self._batch_write_task:
            self._batch_write_task.cancel()
            try:
                await self._batch_write_task
            except asyncio.CancelledError:
                pass

        if self._packet_queue_task:
            self._packet_queue_task.cancel()
            try:
                await self._packet_queue_task
            except asyncio.CancelledError:
                pass

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
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
            """Handle captured packet with early filtering and queuing"""
            try:
                # Packet sampling for high-rate traffic (Pi optimization)
                if self._packet_sampling_rate < 1.0:
                    self._sampling_counter += 1
                    if (self._sampling_counter % int(1.0 / self._packet_sampling_rate)) != 0:
                        return  # Skip this packet
                
                # Packet deduplication (skip duplicates within 1ms window)
                packet_hash = hash((packet.time, len(packet)))
                current_time = datetime.now().timestamp()
                if packet_hash in self._packet_hash_cache:
                    cache_time = self._packet_hash_cache[packet_hash]
                    if current_time - cache_time < self._packet_dedup_window:
                        self._packets_duplicate += 1
                        return  # Skip duplicate
                
                # Update deduplication cache
                if len(self._packet_hash_cache) > self._packet_hash_cache_size:
                    # Remove oldest 20%
                    keys_to_remove = list(self._packet_hash_cache.keys())[:self._packet_hash_cache_size // 5]
                    for key in keys_to_remove:
                        del self._packet_hash_cache[key]
                self._packet_hash_cache[packet_hash] = current_time
                
                self.packets_captured += 1
                
                # Queue packet for batch processing (reduces async overhead)
                asyncio.run_coroutine_threadsafe(
                    self._queue_packet(packet),
                    loop
                )
            except Exception as e:
                logger.error(f"Error handling packet: {e}")
                self._packets_dropped += 1

        try:
            # Run sniff in executor with BPF filter for performance
            await asyncio.to_thread(
                sniff,
                iface=self.interface,
                prn=packet_handler,
                stop_filter=lambda x: not self._running,
                store=False,
                filter=self._bpf_filter  # BPF filter reduces kernel->user overhead
            )
        except Exception as e:
            logger.error(f"Capture error: {e}")
            self._running = False

    def _extract_tcp_flags(self, packet) -> Optional[List[str]]:
        """Extract TCP flags from packet"""
        if not packet.haslayer(TCP):
            return None
        tcp = packet[TCP]
        return self._extract_tcp_flags_fast(tcp)

    def _extract_tcp_flags_fast(self, tcp) -> Optional[List[str]]:
        """Extract TCP flags from TCP layer (optimized, no packet lookup)"""
        flags = []
        flags_int = tcp.flags
        if flags_int & 0x02:  # SYN
            flags.append("SYN")
        if flags_int & 0x10:  # ACK
            flags.append("ACK")
        if flags_int & 0x01:  # FIN
            flags.append("FIN")
        if flags_int & 0x04:  # RST
            flags.append("RST")
        if flags_int & 0x08:  # PSH
            flags.append("PSH")
        if flags_int & 0x20:  # URG
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
        """Extract Server Name Indication (SNI) from TLS handshake (enhanced)"""
        # Method 1: Try Scapy TLS layer (most reliable)
        try:
            if self._has_layer_cached(packet, "TLS"):
                tls = packet.getlayer("TLS")
                if tls:
                    # Look for ClientHello message
                    if hasattr(tls, 'msg') and hasattr(tls.msg, 'ext'):
                        for ext in tls.msg.ext:
                            if hasattr(ext, 'servernames'):
                                for name in ext.servernames:
                                    if hasattr(name, 'servername'):
                                        sni = name.servername
                                        if isinstance(sni, bytes):
                                            sni = sni.decode('utf-8', errors='ignore')
                                        if sni and '.' in sni:
                                            return sni
        except Exception:
            pass

        # Method 2: Try TLSClientHello layer (Scapy 2.4.5+)
        try:
            if TLSClientHello and self._has_layer_cached(packet, TLSClientHello):
                tls_hello = packet.getlayer(TLSClientHello)
                if tls_hello and hasattr(tls_hello, 'servernames'):
                    for name in tls_hello.servernames:
                        if hasattr(name, 'servername'):
                            sni = name.servername
                            if isinstance(sni, bytes):
                                sni = sni.decode('utf-8', errors='ignore')
                            if sni and '.' in sni:
                                return sni
        except Exception:
            pass

        # Method 3: Raw packet inspection (fallback, optimized)
        try:
            # Only check TCP packets on common TLS ports
            if not self._has_layer_cached(packet, TCP):
                return None
            
            tcp = packet.getlayer(TCP)
            if not tcp or tcp.dport not in [443, 8443, 993, 995]:  # Common TLS ports
                return None
            
            # Use raw() method if available (zero-copy), fallback to bytes()
            try:
                raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            except Exception:
                raw = bytes(packet)
            # Look for TLS handshake (0x16) followed by ClientHello (0x01)
            # Then look for SNI extension (0x0000)
            tls_handshake = raw.find(b'\x16\x03')  # TLS handshake record
            if tls_handshake == -1:
                return None
            
            # Look for SNI extension type (0x0000) after handshake
            sni_start = raw.find(b'\x00\x00', tls_handshake)
            if sni_start == -1 or sni_start > len(raw) - 10:
                return None
            
            # SNI structure: extension type (2) + length (2) + server name list length (2) + server name type (1) + server name length (2) + hostname
            try:
                name_list_len = int.from_bytes(raw[sni_start+2:sni_start+4], 'big')
                if name_list_len < 3 or name_list_len > 256:
                    return None
                
                name_type = raw[sni_start+4]
                if name_type != 0:  # host_name type
                    return None
                
                name_len = int.from_bytes(raw[sni_start+5:sni_start+7], 'big')
                if name_len < 1 or name_len > 255:
                    return None
                
                hostname = raw[sni_start+7:sni_start+7+name_len].decode('utf-8', errors='ignore')
                if hostname and '.' in hostname and len(hostname) < 256:
                    return hostname
            except (IndexError, ValueError):
                pass
        except Exception:
            pass

        return None

    def _extract_http_info(self, packet) -> Dict[str, Optional[str]]:
        """Extract HTTP information from packet (optimized)"""
        result = {
            "method": None,
            "url": None,
            "user_agent": None,
            "application": None
        }

        # Early exit: Only check TCP packets on HTTP ports
        if not self._has_layer_cached(packet, TCP):
            return result
        
        tcp = packet.getlayer(TCP)
        if not tcp or tcp.dport not in [80, 8080, 8000, 8888]:  # Common HTTP ports
            return result

        try:
            # Try Scapy HTTP layer first (most reliable)
            if HTTPRequest and self._has_layer_cached(packet, HTTPRequest):
                http = packet.getlayer(HTTPRequest)
                if http:
                    if hasattr(http, 'Method'):
                        method = http.Method
                        if isinstance(method, bytes):
                            method = method.decode('utf-8', errors='ignore')
                        result["method"] = method
                    if hasattr(http, 'Path'):
                        path = http.Path
                        if isinstance(path, bytes):
                            path = path.decode('utf-8', errors='ignore')
                        result["url"] = path
                    if hasattr(http, 'User_Agent'):
                        ua = http.User_Agent
                        if isinstance(ua, bytes):
                            ua = ua.decode('utf-8', errors='ignore')
                        result["user_agent"] = ua
                    result["application"] = "HTTP"
                    return result  # Early return if found

            # Try raw packet inspection for HTTP (fallback, optimized)
            # Use raw() method if available (zero-copy), fallback to bytes()
            try:
                raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            except Exception:
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

    def _has_layer_cached(self, packet, layer_name: str) -> bool:
        """Check if packet has layer (with caching for performance)"""
        cache_key = f"{id(packet)}_{layer_name}"
        if cache_key in self._layer_cache:
            return self._layer_cache[cache_key]
        
        # Limit cache size
        if len(self._layer_cache) > self._layer_cache_size:
            # Clear 50% of cache (oldest entries)
            keys_to_remove = list(self._layer_cache.keys())[:self._layer_cache_size // 2]
            for key in keys_to_remove:
                del self._layer_cache[key]
        
        has_layer = packet.haslayer(layer_name)
        self._layer_cache[cache_key] = has_layer
        return has_layer

    async def _queue_packet(self, packet):
        """Queue packet for batch processing (reduces async overhead)"""
        async with self._packet_queue_lock:
            self._packet_queue.append(packet)
            # Process immediately if batch size reached
            if len(self._packet_queue) >= self._packet_batch_size:
                # Trigger processing (non-blocking)
                asyncio.create_task(self._process_packet_batch())

    async def _process_packet_queue(self):
        """Process queued packets in batches"""
        while self._running:
            try:
                await asyncio.sleep(0.01)  # 10ms batching window
                await self._process_packet_batch()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in packet queue processing: {e}")

    async def _process_packet_batch(self):
        """Process a batch of queued packets"""
        packets_to_process = []
        async with self._packet_queue_lock:
            if not self._packet_queue:
                return
            # Take up to batch_size packets
            batch = self._packet_queue[:self._packet_batch_size]
            self._packet_queue = self._packet_queue[self._packet_batch_size:]
            packets_to_process = batch

        # Process packets in batch (parallel where possible)
        if packets_to_process:
            # Process packets concurrently (but limit concurrency)
            tasks = [self._process_packet(packet) for packet in packets_to_process]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_packet(self, packet):
        """Process captured packet and extract flow information"""
        try:
            # Early exit: Skip if packet is too small (likely malformed)
            if len(packet) < 20:  # Minimum IP header size
                return
            
            # Extract IP layer (support both IPv4 and IPv6)
            ip_layer = None
            src_ip = None
            dst_ip = None
            ttl = None
            
            # Check IPv4 first (most common)
            if self._has_layer_cached(packet, IP):
                ip_layer = packet[IP]
                src_ip = ip_layer.src
                dst_ip = ip_layer.dst
                ttl = ip_layer.ttl
            # Check IPv6 if enabled
            elif self._enable_ipv6 and IPv6 and self._has_layer_cached(packet, IPv6):
                ip_layer = packet[IPv6]
                src_ip = ip_layer.src
                dst_ip = ip_layer.dst
                ttl = ip_layer.hlim  # IPv6 uses hop limit instead of TTL
            else:
                return  # Not an IP packet we care about
            
            # Skip localhost traffic if configured
            if self._skip_local_traffic and (src_ip.startswith("127.") or dst_ip.startswith("127.")):
                return

            # Determine protocol and ports (optimized layer checks)
            protocol = "OTHER"
            src_port = 0
            dst_port = 0
            tcp_flags = None
            connection_state = None

            # Use cached layer checks for better performance
            if self._has_layer_cached(packet, TCP):
                protocol = "TCP"
                tcp_layer = packet.getlayer(TCP)  # More efficient than [TCP]
                if tcp_layer:
                    src_port = tcp_layer.sport
                    dst_port = tcp_layer.dport
                    tcp_flags = self._extract_tcp_flags_fast(tcp_layer)
            elif self._has_layer_cached(packet, UDP):
                protocol = "UDP"
                udp_layer = packet.getlayer(UDP)
                if udp_layer:
                    src_port = udp_layer.sport
                    dst_port = udp_layer.dport
            elif self._has_layer_cached(packet, ICMP):
                protocol = "ICMP"
            elif self._has_layer_cached(packet, ARP):
                protocol = "ARP"
                # Handle ARP for device discovery
                if self.device_service:
                    await self.device_service.process_arp_packet(packet)
                return
            else:
                return  # Unsupported protocol

            # Skip if no valid ports
            if protocol in ["TCP", "UDP"] and (src_port == 0 or dst_port == 0):
                return

            # Create flow key (optimized with caching)
            flow_tuple = (src_ip, src_port, dst_ip, dst_port, protocol)
            reverse_tuple = (dst_ip, dst_port, src_ip, src_port, protocol)
            
            # Use cached flow keys to avoid string concatenation
            if flow_tuple in self._flow_key_cache:
                flow_key = self._flow_key_cache[flow_tuple]
            else:
                flow_key = f"{src_ip}:{src_port}-{dst_ip}:{dst_port}-{protocol}"
                if len(self._flow_key_cache) < self._flow_key_cache_size:
                    self._flow_key_cache[flow_tuple] = flow_key
            
            if reverse_tuple in self._flow_key_cache:
                reverse_key = self._flow_key_cache[reverse_tuple]
            else:
                reverse_key = f"{dst_ip}:{dst_port}-{src_ip}:{src_port}-{protocol}"
                if len(self._flow_key_cache) < self._flow_key_cache_size:
                    self._flow_key_cache[reverse_tuple] = reverse_key

            # Get packet size
            packet_size = len(packet)
            timestamp_ms = int(datetime.now().timestamp() * 1000)
            timestamp_sec = datetime.now().timestamp()

            # Determine direction (incoming vs outgoing) - cached
            is_incoming = self._is_local_ip_cached(dst_ip)

            # Determine source device (cached to reduce async overhead)
            device_id = await self._get_or_create_device_cached(src_ip, packet)

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

    async def _flush_write_queue(self):
        """Flush queued flows to database in batch (Pi optimization)"""
        if not self._write_queue or not self.storage:
            return

        flows_to_write = []
        async with self._write_queue_lock:
            flows_to_write = self._write_queue[:self._batch_size]
            self._write_queue = self._write_queue[self._batch_size:]
            self._last_batch_write = datetime.now().timestamp()

        # Batch write to database
        if flows_to_write:
            try:
                await self.storage.add_flows_batch(flows_to_write)
                logger.debug(f"Batch wrote {len(flows_to_write)} flows to database")
            except Exception as e:
                logger.error(f"Error in batch write: {e}")

    async def _batch_write_loop(self):
        """Periodic batch write loop (Pi optimization)"""
        while self._running:
            try:
                await asyncio.sleep(self._batch_interval)
                current_time = datetime.now().timestamp()
                
                # Flush if interval elapsed
                if current_time - self._last_batch_write >= self._batch_interval:
                    await self._flush_write_queue()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in batch write loop: {e}")

    async def _cleanup_old_flows(self):
        """Cleanup old flows to prevent memory exhaustion (Pi optimization)"""
        current_time = datetime.now().timestamp() * 1000
        timeout_ms = 300000  # 5 minutes
        
        flows_to_remove = []
        for flow_key, flow_data in self._active_flows.items():
            last_seen = flow_data.get("last_seen", 0)
            if current_time - last_seen > timeout_ms:
                flows_to_remove.append(flow_key)
        
        # Remove old flows (limit to 20% to avoid blocking)
        remove_count = min(len(flows_to_remove), self._max_active_flows // 5)
        for flow_key in flows_to_remove[:remove_count]:
            flow_data = self._active_flows.get(flow_key)
            if flow_data:
                await self._finalize_flow(flow_key, flow_data)
        
        # Cleanup tracking data
        self._cleanup_tracking_data()

    def _cleanup_tracking_data(self):
        """Cleanup tracking data structures to prevent memory growth (Pi optimization)"""
        # Limit DNS cache
        if len(self._dns_cache) > self._max_dns_cache_size:
            # Remove oldest 20%
            items_to_remove = list(self._dns_cache.keys())[:self._max_dns_cache_size // 5]
            for key in items_to_remove:
                del self._dns_cache[key]
        
        # Limit RTT tracking
        if len(self._rtt_tracking) > self._max_rtt_tracking_size:
            items_to_remove = list(self._rtt_tracking.keys())[:self._max_rtt_tracking_size // 5]
            for key in items_to_remove:
                del self._rtt_tracking[key]
        
        # Limit retransmission tracking
        if len(self._retransmissions) > self._max_retransmission_tracking:
            items_to_remove = list(self._retransmissions.keys())[:self._max_retransmission_tracking // 5]
            for key in items_to_remove:
                del self._retransmissions[key]

    async def _periodic_cleanup(self):
        """Periodic cleanup of old flows and memory management (Pi optimization)"""
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
                            
                            # Track DNS query for enhanced identification
                            if self.enhanced_identification:
                                self.enhanced_identification.track_dns_query(query_name, ip)
                            
                            return query_name
                # Check for CNAME records
                for i in range(dns.ancount):
                    if dns.an[i].type == 5:  # CNAME record
                        if dns.qd:
                            query_name = dns.qd.qname.decode('utf-8').rstrip('.')
                            async with self._dns_cache_lock:
                                self._dns_cache[ip] = query_name
                            
                            # Track DNS query for enhanced identification
                            if self.enhanced_identification:
                                self.enhanced_identification.track_dns_query(query_name, ip)
                            
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

    def _is_local_ip_cached(self, ip: str) -> bool:
        """Check if IP is local/private (cached for performance)"""
        # Cache local IP checks (most IPs are repeated)
        if ip in self._device_cache:
            # Use device cache as local IP cache too (if cached, it's local)
            return True
        
        return self._is_local_ip(ip)

    async def _get_or_create_device_cached(self, ip: str, packet) -> str:
        """Get or create device from IP address (with caching)"""
        if not self.device_service:
            return "unknown"

        # Check cache first (avoid async database call)
        current_time = datetime.now().timestamp()
        if ip in self._device_cache:
            cache_time = self._device_cache_ttl.get(ip, 0)
            if current_time - cache_time < self._device_cache_max_age:
                return self._device_cache[ip]
            # Cache expired, remove it
            del self._device_cache[ip]
            if ip in self._device_cache_ttl:
                del self._device_cache_ttl[ip]

        # Extract MAC from Ethernet layer (optimized)
        mac = None
        if self._has_layer_cached(packet, Ether):
            ether = packet.getlayer(Ether)
            if ether:
                mac = ether.src

        # Get or create device (async database call)
        device = await self.device_service.get_or_create_device(ip, mac, packet)
        device_id = device.id

        # Update cache
        self._device_cache[ip] = device_id
        self._device_cache_ttl[ip] = current_time

        # Limit cache size
        if len(self._device_cache) > self._max_dns_cache_size:
            # Remove oldest 20%
            items_to_remove = list(self._device_cache.keys())[:self._max_dns_cache_size // 5]
            for key in items_to_remove:
                del self._device_cache[key]
                if key in self._device_cache_ttl:
                    del self._device_cache_ttl[key]

        return device_id

    async def _get_or_create_device(self, ip: str, packet) -> str:
        """Get or create device from IP address (legacy method, use cached version)"""
        return await self._get_or_create_device_cached(ip, packet)

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

            # Queue for batch write (Pi optimization)
            if self.storage:
                async with self._write_queue_lock:
                    self._write_queue.append(flow)
                    # Flush if batch size reached
                    if len(self._write_queue) >= self._batch_size:
                        await self._flush_write_queue()

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

