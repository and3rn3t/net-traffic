"""
Enhanced hostname, server name, and application identification service
Provides advanced configurations for better flow identification
"""
import asyncio
import logging
import socket
from typing import Optional, Dict, List
from datetime import datetime
from collections import defaultdict
import re

try:
    import dns.resolver
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False
    logging.warning("dnspython not available. Some DNS features may be limited.")

logger = logging.getLogger(__name__)


class EnhancedIdentificationService:
    """Service for enhanced hostname, server name, and application identification"""
    
    def __init__(
        self,
        enable_dns_tracking: bool = True,
        enable_reverse_dns: bool = True,
        enable_dns_over_https: bool = False,
        dns_servers: Optional[List[str]] = None,
        reverse_dns_timeout: float = 2.0,
        reverse_dns_retries: int = 2,
        enable_service_fingerprinting: bool = True,
        enable_deep_packet_inspection: bool = True,
        enable_http_host_extraction: bool = True,
        enable_alpn_detection: bool = True,
    ):
        """
        Initialize enhanced identification service
        
        Args:
            enable_dns_tracking: Track DNS queries to map IPs to domains
            enable_reverse_dns: Perform reverse DNS lookups
            enable_dns_over_https: Use DNS over HTTPS for lookups
            dns_servers: Custom DNS servers (default: system DNS)
            reverse_dns_timeout: Timeout for reverse DNS lookups (seconds)
            reverse_dns_retries: Number of retries for reverse DNS
            enable_service_fingerprinting: Enable service banner grabbing
            enable_deep_packet_inspection: Enable DPI for application detection
            enable_http_host_extraction: Extract Host header from HTTP
            enable_alpn_detection: Detect ALPN in TLS handshakes
        """
        self.enable_dns_tracking = enable_dns_tracking
        self.enable_reverse_dns = enable_reverse_dns
        self.enable_dns_over_https = enable_dns_over_https
        self.dns_servers = dns_servers or []
        self.reverse_dns_timeout = reverse_dns_timeout
        self.reverse_dns_retries = reverse_dns_retries
        self.enable_service_fingerprinting = enable_service_fingerprinting
        self.enable_deep_packet_inspection = enable_deep_packet_inspection
        self.enable_http_host_extraction = enable_http_host_extraction
        self.enable_alpn_detection = enable_alpn_detection
        
        # DNS query tracking: domain -> IP mappings
        self._dns_query_cache: Dict[str, List[str]] = defaultdict(list)
        self._dns_query_timestamps: Dict[str, float] = {}
        self._dns_cache_ttl = 3600.0  # 1 hour
        
        # Reverse DNS cache: IP -> hostname
        self._reverse_dns_cache: Dict[str, str] = {}
        self._reverse_dns_cache_ttl: Dict[str, float] = {}
        self._reverse_dns_cache_max_age = 3600.0  # 1 hour
        
        # Service fingerprinting cache
        self._service_fingerprints: Dict[str, Dict] = {}
        
        # Application detection patterns
        self._app_patterns = self._load_application_patterns()
        
    def _load_application_patterns(self) -> Dict[str, List[bytes]]:
        """Load application detection patterns"""
        return {
            "SSH": [b"SSH-", b"OpenSSH"],
            "FTP": [b"220 ", b"FTP"],
            "SMTP": [b"220 ", b"250 "],
            "POP3": [b"+OK"],
            "IMAP": [b"* OK"],
            "MySQL": [b"\x00\x00\x00"],
            "PostgreSQL": [b"\x00\x00\x00\x08"],
            "Redis": [b"*"],
            "MongoDB": [b"\x00\x00\x00\x00"],
            "Elasticsearch": [b'{"cluster_name"'],
            "Kubernetes": [b"k8s", b"kubernetes"],
            "Docker": [b"docker"],
            "Git": [b"git-upload-pack"],
            "BitTorrent": [b"\x13BitTorrent"],
            "QUIC": [b"Q"],
        }
    
    def track_dns_query(self, domain: str, ip: str):
        """Track DNS query to map domain to IP"""
        if not self.enable_dns_tracking:
            return
        
        current_time = datetime.now().timestamp()
        
        # Add IP to domain mapping
        if ip not in self._dns_query_cache[domain]:
            self._dns_query_cache[domain].append(ip)
        
        # Update timestamp
        self._dns_query_timestamps[domain] = current_time
        
        # Cleanup old entries
        self._cleanup_dns_cache(current_time)
    
    def get_domain_for_ip(self, ip: str) -> Optional[str]:
        """Get domain name for IP from DNS query tracking"""
        if not self.enable_dns_tracking:
            return None
        
        current_time = datetime.now().timestamp()
        
        # Find most recent domain for this IP
        best_domain = None
        best_timestamp = 0
        
        for domain, ips in self._dns_query_cache.items():
            if ip in ips:
                timestamp = self._dns_query_timestamps.get(domain, 0)
                if timestamp > best_timestamp and (current_time - timestamp) < self._dns_cache_ttl:
                    best_domain = domain
                    best_timestamp = timestamp
        
        return best_domain
    
    async def reverse_dns_lookup(self, ip: str) -> Optional[str]:
        """Perform reverse DNS lookup with retry logic"""
        if not self.enable_reverse_dns:
            return None
        
        # Check cache
        current_time = datetime.now().timestamp()
        if ip in self._reverse_dns_cache:
            cache_time = self._reverse_dns_cache_ttl.get(ip, 0)
            if current_time - cache_time < self._reverse_dns_cache_max_age:
                return self._reverse_dns_cache[ip]
        
        # Skip local IPs
        if self._is_local_ip(ip):
            return None
        
        # Try reverse DNS lookup with retries
        for attempt in range(self.reverse_dns_retries):
            try:
                # Use asyncio timeout
                hostname = await asyncio.wait_for(
                    asyncio.to_thread(socket.gethostbyaddr, ip),
                    timeout=self.reverse_dns_timeout
                )
                
                if hostname and len(hostname) > 0:
                    hostname_str = hostname[0]
                    if hostname_str and hostname_str != ip:
                        # Cache result
                        self._reverse_dns_cache[ip] = hostname_str
                        self._reverse_dns_cache_ttl[ip] = current_time
                        return hostname_str
            except (socket.herror, socket.gaierror, OSError, asyncio.TimeoutError) as e:
                if attempt == self.reverse_dns_retries - 1:
                    logger.debug(f"Reverse DNS lookup failed for {ip}: {e}")
                    # Cache failure (empty string)
                    self._reverse_dns_cache[ip] = ""
                    self._reverse_dns_cache_ttl[ip] = current_time
                else:
                    await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
        
        return None
    
    def extract_http_host(self, packet) -> Optional[str]:
        """Extract Host header from HTTP packet"""
        if not self.enable_http_host_extraction:
            return None
        
        try:
            # Try Scapy HTTP layer
            from scapy.layers.http import HTTPRequest
            if packet.haslayer(HTTPRequest):
                http = packet[HTTPRequest]
                if hasattr(http, 'Host'):
                    host = http.Host
                    if isinstance(host, bytes):
                        host = host.decode('utf-8', errors='ignore')
                    return host
            
            # Try raw packet inspection
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            if b'Host:' in raw:
                for line in raw.split(b'\r\n'):
                    if line.startswith(b'Host:'):
                        host = line.split(b':', 1)[1].strip().decode('utf-8', errors='ignore')
                        return host
        except Exception as e:
            logger.debug(f"Error extracting HTTP Host: {e}")
        
        return None
    
    def extract_tls_alpn(self, packet) -> Optional[List[str]]:
        """Extract ALPN (Application-Layer Protocol Negotiation) from TLS"""
        if not self.enable_alpn_detection:
            return None
        
        try:
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            
            # Look for ALPN extension (0x0010)
            alpn_start = raw.find(b'\x00\x10')
            if alpn_start == -1:
                return None
            
            # ALPN structure: extension type (2) + length (2) + protocol list length (2) + protocols
            try:
                ext_len = int.from_bytes(raw[alpn_start+2:alpn_start+4], 'big')
                if ext_len < 2:
                    return None
                
                list_len = int.from_bytes(raw[alpn_start+4:alpn_start+6], 'big')
                if list_len < 1:
                    return None
                
                protocols = []
                offset = alpn_start + 6
                remaining = list_len
                
                while remaining > 0 and offset < len(raw):
                    if offset + 1 > len(raw):
                        break
                    proto_len = raw[offset]
                    if offset + 1 + proto_len > len(raw):
                        break
                    proto = raw[offset+1:offset+1+proto_len].decode('utf-8', errors='ignore')
                    protocols.append(proto)
                    offset += 1 + proto_len
                    remaining -= 1 + proto_len
                
                return protocols if protocols else None
            except (IndexError, ValueError):
                pass
        except Exception:
            pass
        
        return None
    
    def detect_application_dpi(self, packet, protocol: str, dst_port: int) -> Optional[str]:
        """Detect application using deep packet inspection"""
        if not self.enable_deep_packet_inspection:
            return None
        
        try:
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            
            # Check first 200 bytes for patterns
            payload = raw[:200] if len(raw) > 200 else raw
            
            # Check application patterns
            for app_name, patterns in self._app_patterns.items():
                for pattern in patterns:
                    if pattern in payload:
                        return app_name
            
            # HTTP/2 detection (magic string)
            if payload.startswith(b'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'):
                return "HTTP/2"
            
            # QUIC detection
            if len(payload) > 4 and payload[0] == 0x80 and payload[1] == 0x01:
                return "QUIC"
            
        except Exception as e:
            logger.debug(f"Error in DPI: {e}")
        
        return None
    
    def fingerprint_service(self, packet, ip: str, port: int) -> Optional[Dict]:
        """Fingerprint service from packet (banner grabbing)"""
        if not self.enable_service_fingerprinting:
            return None
        
        try:
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
            payload = raw[:500] if len(raw) > 500 else raw
            
            # Extract printable strings
            printable = re.findall(rb'[\x20-\x7E]{4,}', payload)
            
            if printable:
                banner = printable[0].decode('utf-8', errors='ignore')[:100]
                
                fingerprint = {
                    "banner": banner,
                    "port": port,
                    "timestamp": datetime.now().timestamp()
                }
                
                # Cache fingerprint
                cache_key = f"{ip}:{port}"
                self._service_fingerprints[cache_key] = fingerprint
                
                return fingerprint
        except Exception as e:
            logger.debug(f"Error fingerprinting service: {e}")
        
        return None
    
    def _is_local_ip(self, ip: str) -> bool:
        """Check if IP is local/private"""
        if ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("127."):
            return True
        if ip.startswith("172."):
            try:
                parts = ip.split('.')
                if len(parts) >= 2:
                    second_octet = int(parts[1])
                    if 16 <= second_octet <= 31:
                        return True
            except (ValueError, IndexError):
                pass
        if ip.startswith("169.254.") or ip.startswith("fe80:") or ip == "::1":
            return True
        return False
    
    def _cleanup_dns_cache(self, current_time: float):
        """Cleanup old DNS cache entries"""
        keys_to_remove = []
        for domain, timestamp in self._dns_query_timestamps.items():
            if current_time - timestamp > self._dns_cache_ttl:
                keys_to_remove.append(domain)
        
        for domain in keys_to_remove:
            del self._dns_query_cache[domain]
            if domain in self._dns_query_timestamps:
                del self._dns_query_timestamps[domain]

