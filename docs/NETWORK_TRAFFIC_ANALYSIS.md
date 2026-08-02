# Network Traffic Analysis - Current Capabilities

What NetInsight actually extracts from captured traffic today, and what's still a genuine gap. (Supersedes older docs that described this before geolocation/TCP/TLS/DNS extraction and Deep Protocol Decoding shipped — if you find a stale doc claiming these are "not captured", this file is the current source of truth.)

## Currently extracted

### Flow-level
- Source/destination IP + port, protocol (TCP/UDP/ICMP/ARP/OTHER), bytes/packets in+out, duration, status (active/closed), device association (MAC)
- **TCP**: flags (SYN/ACK/FIN/RST/PSH/URG), connection state, retransmission detection (payload-bearing segments only, pure ACKs excluded — see gotcha below)
- **IP**: TTL (for OS fingerprinting)
- **Network quality**: RTT and jitter, estimated from inter-packet timing (sliding window: last ~10 packets for RTT, ~20 for jitter); gaps over `MAX_PLAUSIBLE_INTERVAL_SECONDS` (2s, idle gaps) are excluded from the estimate
- **Geolocation**: country, city, ASN via GeoIP2/MaxMind (`services/geolocation.py`), cached per IP; requires a GeoLite2 `.mmdb` — see `GEOIP_DB_PATH` in [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md). Without a DB installed, these fields stay empty (a known historical gap on the deployed Pi — verify `GEOIP_DB_PATH` points to a real file if you need geo data).

### Application layer (Deep Protocol Decoding)
- **HTTP**: Host header, response status code, method, URL path, User-Agent (only on unencrypted HTTP — most modern traffic is HTTPS, which limits this)
- **TLS**: negotiated version, detected from the `supported_versions` ClientHello extension (the legacy record version stays `0x0303` even for TLS 1.3, so this extension check is required for accurate detection); SNI (domain name) extracted from the ClientHello
- **DNS**: query name, resolved A/AAAA/CNAME answers, query type, response code

### Device info
MAC/IP, vendor (MAC OUI), device type classification, hostname, first/last seen, total bytes, connection count, threat score, IPv6 support flag, average RTT, connection quality (good/fair/poor).

### Threat detection
Data exfiltration (>10MB outbound), suspicious/scanning ports, connection-reset abuse (only scores abrupt resets under `EARLY_RESET_PACKET_THRESHOLD`, since most connections end via RST normally), baseline/anomaly detection (per-device EMA baseline with z-score threshold, see [ROADMAP.md](./ROADMAP.md)).

> **Threat-detection gotcha**: retransmission/reset/RTT heuristics are crude and sensitive to real-world traffic shifts — pure ACKs no longer count as retransmits, RST-closed flows only score if abrupt, and idle gaps are excluded from RTT/jitter. If threat noise spikes again after a capture-source change, check these three distributions first before assuming a new bug.

## Genuine remaining gaps

- **OS fingerprinting**: TTL is captured but pattern matching (TTL + TCP window + IP ID) is only a framework, not fully built out.
- **TCP window size / options (MSS, SACK)**: not extracted — would help bandwidth/congestion estimation.
- **Behavioral analysis**: no communication graph ("who talks to whom"), no day/night or weekly pattern analysis beyond what's in the analytics dashboards.
- **Threat intelligence feeds**: no IP/domain reputation lookups or known-malware-signature matching.
- **DGA / C2 / tunneling detection**: not implemented.
- **Application-category detection** (streaming vs. gaming vs. browsing): not implemented beyond port/protocol-based guesses.

## Performance & privacy notes

- More extraction = more CPU per packet and more DB columns/storage — the DB observability pass (see repo notes / [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)) exists partly because of this.
- Most modern traffic is HTTPS, so HTTP header/URL extraction only applies to a shrinking slice of real traffic; SNI/TLS-version detection is the main visibility source for encrypted flows.
- Deep packet inspection of this kind stays local to the Pi (see [ARCHITECTURE.md](./ARCHITECTURE.md)) — nothing is sent to a third party.
