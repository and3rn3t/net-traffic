"""
Stateless per-packet protocol decoders (TCP flags/state, TLS SNI/version,
HTTP request/response info, application detection, DNS query/answer details).

None of these hold instance state - they only read from the packet/args
passed in - so they're plain module functions shared by
`PacketCaptureService._process_packet()` rather than methods on it.
"""
import logging
from typing import Dict, List, Optional

try:
    from scapy.all import TCP
    from scapy.layers.dns import DNS
    from scapy.layers.tls.handshake import TLSClientHello
    try:
        from scapy.layers.http import HTTPRequest
    except ImportError:
        HTTPRequest = None
except ImportError:
    TCP = None
    DNS = None
    TLSClientHello = None
    HTTPRequest = None

logger = logging.getLogger(__name__)

TLS_VERSION_MAP = {
    (3, 1): "TLS 1.0",
    (3, 2): "TLS 1.1",
    (3, 3): "TLS 1.2",
    (3, 4): "TLS 1.3",
}


def has_layer_cached(packet, layer_name) -> bool:
    """Check if packet has layer.

    NOTE: This intentionally does NOT cache across calls. Packet objects are
    short-lived and Python can reuse id(packet) for a brand-new object once the
    old one is garbage collected, which previously caused stale True/False
    results to leak onto unrelated packets (manifesting as spurious
    "Layer [IP]/[IPv6] not found" errors when a cached True hit didn't
    actually apply to the current packet).
    """
    return packet.haslayer(layer_name)


def extract_tcp_flags(packet) -> Optional[List[str]]:
    """Extract TCP flags from packet"""
    if not packet.haslayer(TCP):
        return None
    tcp = packet[TCP]
    return extract_tcp_flags_fast(tcp)


def extract_tcp_flags_fast(tcp) -> Optional[List[str]]:
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


def get_connection_state(tcp_flags: Optional[List[str]], current_state: Optional[str]) -> str:
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


def extract_tls_sni(packet) -> Optional[str]:
    """Extract Server Name Indication (SNI) from TLS handshake (enhanced)"""
    # Method 1: Try Scapy TLS layer (most reliable)
    try:
        if has_layer_cached(packet, "TLS"):
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
        if TLSClientHello and has_layer_cached(packet, TLSClientHello):
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
        if not has_layer_cached(packet, TCP):
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


def extract_tls_version(packet) -> Optional[str]:
    """Extract the negotiated/offered TLS version from a ClientHello.

    For TLS 1.3, the legacy record/handshake version stays 0x0303 (TLS
    1.2) for backwards compatibility - the real version is signalled via
    the 'supported_versions' extension (type 0x002b), so that extension
    is checked first when present.
    """
    # Method 1: Scapy TLS layer (most reliable when available)
    try:
        if TLSClientHello and has_layer_cached(packet, TLSClientHello):
            tls_hello = packet.getlayer(TLSClientHello)
            if tls_hello and hasattr(tls_hello, 'version'):
                version = tls_hello.version
                if isinstance(version, int):
                    major, minor = (version >> 8) & 0xFF, version & 0xFF
                    mapped = TLS_VERSION_MAP.get((major, minor))
                    if mapped:
                        return mapped
    except Exception:
        pass

    # Method 2: Raw packet inspection (fallback)
    try:
        if not has_layer_cached(packet, TCP):
            return None
        tcp = packet.getlayer(TCP)
        if not tcp or tcp.dport not in (443, 8443, 993, 995):
            return None

        try:
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
        except Exception:
            raw = bytes(packet)

        handshake_start = raw.find(b'\x16\x03')
        if handshake_start == -1 or handshake_start + 2 >= len(raw):
            return None

        # supported_versions extension (0x002b): if present, its first
        # listed version reflects the real (possibly TLS 1.3) version.
        ext_start = raw.find(b'\x00\x2b', handshake_start)
        if ext_start != -1 and ext_start + 6 < len(raw):
            major, minor = raw[ext_start + 5], raw[ext_start + 6]
            mapped = TLS_VERSION_MAP.get((major, minor))
            if mapped:
                return mapped

        # Otherwise fall back to the legacy record version bytes.
        major, minor = raw[handshake_start + 1], raw[handshake_start + 2]
        return TLS_VERSION_MAP.get((major, minor))
    except Exception:
        pass

    return None


def extract_http_info(packet) -> Dict[str, Optional[object]]:
    """Extract HTTP information from packet (optimized), covering both
    the request direction (method/url/host/user-agent) and the response
    direction (status code)."""
    result: Dict[str, Optional[object]] = {
        "method": None,
        "url": None,
        "user_agent": None,
        "application": None,
        "host": None,
        "status_code": None,
    }

    # Early exit: Only check TCP packets on HTTP ports (either direction)
    if not has_layer_cached(packet, TCP):
        return result

    tcp = packet.getlayer(TCP)
    http_ports = (80, 8080, 8000, 8888)
    if not tcp or (tcp.dport not in http_ports and tcp.sport not in http_ports):
        return result

    try:
        # Try Scapy HTTP layer first (most reliable, request direction only)
        if HTTPRequest and has_layer_cached(packet, HTTPRequest):
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
                if hasattr(http, 'Host'):
                    host = http.Host
                    if isinstance(host, bytes):
                        host = host.decode('utf-8', errors='ignore')
                    result["host"] = host
                result["application"] = "HTTP"
                return result  # Early return if found

        # Try raw packet inspection for HTTP (fallback, optimized)
        # Use raw() method if available (zero-copy), fallback to bytes()
        try:
            raw = packet.raw if hasattr(packet, 'raw') else bytes(packet)
        except Exception:
            raw = bytes(packet)

        # Response direction: status line looks like "HTTP/1.1 200 OK"
        if raw.startswith(b'HTTP/'):
            result["application"] = "HTTP"
            try:
                first_line = raw.split(b'\r\n', 1)[0].decode('utf-8', errors='ignore')
                parts = first_line.split(' ')
                if len(parts) > 1 and parts[1].isdigit():
                    result["status_code"] = int(parts[1])
            except Exception:
                pass
            return result

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
            except Exception:
                pass

            # Extract Host and User-Agent headers
            for line in raw.split(b'\r\n'):
                if line.startswith(b'Host:'):
                    host = line.split(b':', 1)[1].strip().decode('utf-8', errors='ignore')
                    result["host"] = host
                elif line.startswith(b'User-Agent:'):
                    ua = line.split(b':', 1)[1].strip().decode('utf-8', errors='ignore')
                    result["user_agent"] = ua
    except Exception as e:
        logger.debug(f"Error extracting HTTP info: {e}")

    return result


def detect_application(packet, protocol: str, dst_port: int) -> Optional[str]:
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


def extract_dns_details(packet) -> Dict[str, Optional[object]]:
    """Extract detailed DNS information: query type/name, response code, and answers"""
    result: Dict[str, Optional[object]] = {
        "query_type": None,
        "response_code": None,
        "query_name": None,
        "answers": None,
    }

    if not packet.haslayer(DNS):
        return result

    try:
        dns = packet[DNS]

        # Extract query type and name
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
            try:
                result["query_name"] = query.qname.decode("utf-8", errors="ignore").rstrip(".")
            except Exception:
                pass

        # Extract response code and answers
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

            if dns.an:
                answers: List[str] = []
                for i in range(dns.ancount):
                    record = dns.an[i]
                    try:
                        if record.type in (1, 28):  # A / AAAA
                            answers.append(str(record.rdata))
                        elif record.type == 5:  # CNAME
                            cname = record.rdata
                            if isinstance(cname, bytes):
                                cname = cname.decode("utf-8", errors="ignore")
                            answers.append(str(cname).rstrip("."))
                    except Exception:
                        continue
                if answers:
                    # Cap to avoid unbounded growth from a malformed/huge response
                    result["answers"] = answers[:10]
    except Exception as e:
        logger.debug(f"Error extracting DNS details: {e}")

    return result
