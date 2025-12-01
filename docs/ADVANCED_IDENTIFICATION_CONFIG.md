# Advanced Identification Configuration

This document describes advanced configurations for improving hostname resolution, server name identification, and application detection in packet flows.

## Overview

The enhanced identification system provides multiple methods to identify:

1. **Hostnames**: Domain names and hostnames for IP addresses
2. **Server Names**: TLS SNI, HTTP Host headers, ALPN
3. **Application Purpose**: Deep packet inspection, service fingerprinting, protocol detection

## Configuration Options

### Environment Variables

Add these to your `.env` file:

```env
# DNS Tracking
ENABLE_DNS_TRACKING=true              # Track DNS queries to map IPs to domains
ENABLE_REVERSE_DNS=true               # Perform reverse DNS lookups
REVERSE_DNS_TIMEOUT=2.0               # Timeout for reverse DNS (seconds)
REVERSE_DNS_RETRIES=2                 # Number of retries for reverse DNS
DNS_SERVERS=8.8.8.8,1.1.1.1          # Custom DNS servers (optional)

# Service Identification
ENABLE_SERVICE_FINGERPRINTING=true    # Enable banner grabbing
ENABLE_DEEP_PACKET_INSPECTION=true    # Enable DPI for application detection
ENABLE_HTTP_HOST_EXTRACTION=true      # Extract HTTP Host header
ENABLE_ALPN_DETECTION=true            # Detect ALPN in TLS handshakes
```

## Features

### 1. DNS Query Tracking

**What it does:**

- Tracks DNS queries and responses to build IP-to-domain mappings
- More reliable than reverse DNS for many cases
- Automatically maps IPs to domains when DNS responses are captured

**How it works:**

```
DNS Query: example.com → DNS Response: 93.184.216.34
System tracks: 93.184.216.34 → example.com
Later packets to 93.184.216.34 are identified as example.com
```

**Configuration:**

```python
ENABLE_DNS_TRACKING=true  # Enable/disable DNS tracking
```

**Benefits:**

- ✅ More accurate than reverse DNS
- ✅ Works for CDNs and load balancers
- ✅ No additional network requests
- ✅ Real-time mapping

### 2. Enhanced Reverse DNS

**What it does:**

- Performs reverse DNS lookups with retry logic
- Caches results to avoid repeated lookups
- Configurable timeout and retry count

**Configuration:**

```python
ENABLE_REVERSE_DNS=true        # Enable/disable reverse DNS
REVERSE_DNS_TIMEOUT=2.0       # Timeout per lookup (seconds)
REVERSE_DNS_RETRIES=2         # Number of retries
DNS_SERVERS=8.8.8.8,1.1.1.1   # Custom DNS servers (optional)
```

**Benefits:**

- ✅ Fallback when DNS tracking doesn't have mapping
- ✅ Works for IPs not seen in DNS queries
- ✅ Configurable reliability (timeout/retries)

**Limitations:**

- ⚠️ Slower than DNS tracking (network request)
- ⚠️ May not work for all IPs (PTR records required)
- ⚠️ Can be blocked by firewalls

### 3. HTTP Host Header Extraction

**What it does:**

- Extracts `Host` header from HTTP requests
- More reliable than SNI for HTTP traffic
- Works for both HTTP/1.1 and HTTP/2

**Configuration:**

```python
ENABLE_HTTP_HOST_EXTRACTION=true  # Enable/disable Host extraction
```

**Example:**

```
HTTP Request:
GET /index.html HTTP/1.1
Host: example.com

System extracts: example.com
```

**Benefits:**

- ✅ More accurate than SNI for HTTP
- ✅ Works for non-TLS traffic
- ✅ No additional processing needed

### 4. TLS ALPN Detection

**What it does:**

- Detects Application-Layer Protocol Negotiation (ALPN) in TLS handshakes
- Identifies HTTP/2, HTTP/1.1, gRPC, etc.
- Provides better application identification

**Configuration:**

```python
ENABLE_ALPN_DETECTION=true  # Enable/disable ALPN detection
```

**Example:**

```
TLS ClientHello with ALPN: h2, http/1.1
System detects: HTTP/2
```

**Benefits:**

- ✅ Identifies HTTP/2 vs HTTP/1.1
- ✅ Detects gRPC, WebSocket upgrades
- ✅ Better application classification

### 5. Deep Packet Inspection (DPI)

**What it does:**

- Analyzes packet payloads to identify applications
- Detects protocols by content patterns
- Works for non-standard ports

**Configuration:**

```python
ENABLE_DEEP_PACKET_INSPECTION=true  # Enable/disable DPI
```

**Supported Applications:**

- SSH, FTP, SMTP, POP3, IMAP
- MySQL, PostgreSQL, Redis, MongoDB
- Elasticsearch, Kubernetes, Docker
- Git, BitTorrent, QUIC
- HTTP/2 (magic string detection)

**Benefits:**

- ✅ Works for non-standard ports
- ✅ Detects applications by content
- ✅ Identifies custom protocols

**Limitations:**

- ⚠️ Requires packet payload inspection
- ⚠️ May not work for encrypted traffic
- ⚠️ Slightly higher CPU usage

### 6. Service Fingerprinting

**What it does:**

- Extracts service banners from packets
- Identifies services by their banners
- Useful for SSH, FTP, SMTP, etc.

**Configuration:**

```python
ENABLE_SERVICE_FINGERPRINTING=true  # Enable/disable fingerprinting
```

**Example:**

```
SSH Banner: SSH-2.0-OpenSSH_8.2
System identifies: SSH (OpenSSH 8.2)
```

**Benefits:**

- ✅ Identifies service versions
- ✅ Works for protocol banners
- ✅ Useful for security analysis

## Usage Examples

### Basic Configuration

```python
# In main.py
from services.enhanced_identification import EnhancedIdentificationService
from utils.config import config

# Create enhanced identification service
enhanced_id = EnhancedIdentificationService(
    enable_dns_tracking=config.enable_dns_tracking,
    enable_reverse_dns=config.enable_reverse_dns,
    reverse_dns_timeout=config.reverse_dns_timeout,
    reverse_dns_retries=config.reverse_dns_retries,
    enable_service_fingerprinting=config.enable_service_fingerprinting,
    enable_deep_packet_inspection=config.enable_deep_packet_inspection,
    enable_http_host_extraction=config.enable_http_host_extraction,
    enable_alpn_detection=config.enable_alpn_detection,
    dns_servers=config.dns_servers if config.dns_servers else None
)

# Pass to packet capture service
packet_capture = PacketCaptureService(
    interface=config.network_interface,
    device_service=device_service,
    threat_service=threat_service,
    storage=storage,
    geolocation_service=geolocation_service,
    enhanced_identification=enhanced_id  # Add this
)
```

### Custom Configuration

```python
# High-accuracy mode (slower)
enhanced_id = EnhancedIdentificationService(
    enable_dns_tracking=True,
    enable_reverse_dns=True,
    reverse_dns_timeout=5.0,      # Longer timeout
    reverse_dns_retries=3,        # More retries
    enable_service_fingerprinting=True,
    enable_deep_packet_inspection=True,
    enable_http_host_extraction=True,
    enable_alpn_detection=True,
)

# Performance mode (faster, less accurate)
enhanced_id = EnhancedIdentificationService(
    enable_dns_tracking=True,
    enable_reverse_dns=False,    # Disable slow reverse DNS
    enable_service_fingerprinting=False,  # Disable banner grabbing
    enable_deep_packet_inspection=True,   # Keep DPI (fast)
    enable_http_host_extraction=True,
    enable_alpn_detection=True,
)
```

## Identification Priority

The system uses the following priority order for domain/hostname identification:

1. **DNS Query Tracking** (highest priority)
   - Most accurate, no network delay
   - Works for CDNs and load balancers

2. **HTTP Host Header**
   - Accurate for HTTP traffic
   - No network delay

3. **TLS SNI**
   - Accurate for HTTPS traffic
   - No network delay

4. **Reverse DNS** (lowest priority)
   - Fallback when other methods fail
   - Network delay, may not work for all IPs

## Performance Impact

### CPU Usage

- **DNS Tracking**: Minimal (~1% increase)
- **Reverse DNS**: Low (~2-5% increase, async)
- **HTTP Host Extraction**: Minimal (~0.5% increase)
- **ALPN Detection**: Minimal (~0.5% increase)
- **DPI**: Moderate (~5-10% increase)
- **Service Fingerprinting**: Low (~2-3% increase)

### Memory Usage

- **DNS Cache**: ~1MB per 10,000 mappings
- **Reverse DNS Cache**: ~500KB per 5,000 lookups
- **Service Fingerprints**: ~100KB per 1,000 services

### Network Usage

- **Reverse DNS**: ~1-2 DNS queries per unique IP
- **Other features**: No additional network usage

## Best Practices

### For Maximum Accuracy

```env
ENABLE_DNS_TRACKING=true
ENABLE_REVERSE_DNS=true
ENABLE_HTTP_HOST_EXTRACTION=true
ENABLE_ALPN_DETECTION=true
ENABLE_DEEP_PACKET_INSPECTION=true
ENABLE_SERVICE_FINGERPRINTING=true
REVERSE_DNS_TIMEOUT=3.0
REVERSE_DNS_RETRIES=3
```

### For Maximum Performance (Raspberry Pi)

```env
ENABLE_DNS_TRACKING=true              # Keep (fast, accurate)
ENABLE_REVERSE_DNS=false              # Disable (slow)
ENABLE_HTTP_HOST_EXTRACTION=true      # Keep (fast)
ENABLE_ALPN_DETECTION=true            # Keep (fast)
ENABLE_DEEP_PACKET_INSPECTION=true   # Keep (useful)
ENABLE_SERVICE_FINGERPRINTING=false   # Disable (optional)
```

### For Security Analysis

```env
ENABLE_DNS_TRACKING=true
ENABLE_REVERSE_DNS=true
ENABLE_SERVICE_FINGERPRINTING=true    # Important for security
ENABLE_DEEP_PACKET_INSPECTION=true    # Important for security
ENABLE_HTTP_HOST_EXTRACTION=true
ENABLE_ALPN_DETECTION=true
```

## Troubleshooting

### Reverse DNS Not Working

- Check firewall rules (UDP port 53)
- Verify DNS servers are reachable
- Increase timeout: `REVERSE_DNS_TIMEOUT=5.0`
- Increase retries: `REVERSE_DNS_RETRIES=3`

### Low Identification Rate

- Enable DNS tracking: `ENABLE_DNS_TRACKING=true`
- Enable HTTP Host extraction: `ENABLE_HTTP_HOST_EXTRACTION=true`
- Enable DPI: `ENABLE_DEEP_PACKET_INSPECTION=true`

### High CPU Usage

- Disable reverse DNS: `ENABLE_REVERSE_DNS=false`
- Disable service fingerprinting: `ENABLE_SERVICE_FINGERPRINTING=false`
- Keep DPI enabled (it's optimized)

## API Access

Enhanced identification results are included in flow data:

```json
{
  "domain": "example.com", // From DNS tracking or reverse DNS
  "sni": "example.com", // TLS SNI
  "application": "HTTP/2", // From ALPN or DPI
  "http_method": "GET", // HTTP method
  "url": "/index.html", // HTTP URL
  "user_agent": "Mozilla/5.0...", // HTTP User-Agent
  "dns_query_type": "A", // DNS query type
  "dns_response_code": "NOERROR" // DNS response code
}
```

## Summary

The enhanced identification system provides multiple methods to identify hostnames, server names, and application purposes. Configure based on your needs:

- **Accuracy**: Enable all features
- **Performance**: Disable reverse DNS and service fingerprinting
- **Security**: Enable service fingerprinting and DPI

All features are designed to work together, with automatic fallback to less accurate methods when needed.
