# Architecture Decision: Database & Components Location

## Executive Summary

**Recommendation: Keep database and all backend components on Raspberry Pi**

While Cloudflare offers database solutions (D1, Durable Objects), the current architecture benefits significantly from keeping everything on the Pi. Here's why:

## Component Analysis

### Must Stay on Raspberry Pi

#### 1. Packet Capture Service ⚠️ **CRITICAL**

- **Why**: Requires direct access to network interface (`eth0`)
- **Technical**: Uses Scapy's `sniff()` which needs raw socket access
- **Cloudflare Limitation**: Workers cannot access local network interfaces
- **Impact**: Cannot be moved to Cloudflare

```python
# This requires direct network interface access
from scapy.all import sniff
sniff(iface="eth0", prn=process_packet)
```

#### 2. Real-Time Data Processing

- **Why**: Processes packets immediately as they're captured
- **Latency**: Sub-millisecond processing needed for flow tracking
- **Volume**: High packet volume (thousands per second)
- **Cloudflare Limitation**: Would require streaming all packets to Cloudflare (expensive, high latency)

#### 3. Database (SQLite) ✅ **RECOMMENDED TO KEEP**

- **Current**: SQLite with aiosqlite, local file storage
- **Why Keep on Pi**:
  - **Privacy**: Network traffic data stays local
  - **Latency**: Zero network latency for writes
  - **Cost**: No egress costs for data storage
  - **Volume**: High write volume (flows, packets)
  - **Simplicity**: No additional infrastructure needed

#### 4. Device Fingerprinting

- **Why**: Processes packets in real-time to identify devices
- **Dependency**: Requires packet capture data immediately
- **Latency**: Needs low-latency access to flow data

#### 5. Threat Detection

- **Why**: Analyzes packets/flows in real-time
- **Dependency**: Needs immediate access to captured data
- **Performance**: Pattern matching on high-volume data

### Could Move to Cloudflare (But Not Recommended)

#### 1. Database (Cloudflare D1)

**Pros:**

- Global edge distribution
- Automatic backups
- Managed service

**Cons:**

- ❌ **Privacy**: Network traffic data leaves local network
- ❌ **Latency**: Network round-trip for every write (100-500ms)
- ❌ **Cost**: Egress costs for all data sent to Cloudflare
- ❌ **Volume**: High write volume would be expensive
- ❌ **Complexity**: Requires data streaming from Pi to Cloudflare
- ❌ **Reliability**: Depends on internet connection

#### 2. Analytics Processing

**Pros:**

- Could use Cloudflare Workers for computation
- Edge computing benefits

**Cons:**

- ❌ **Data Transfer**: All data must be sent to Cloudflare first
- ❌ **Latency**: Delayed analytics (not real-time)
- ❌ **Cost**: High egress costs
- ❌ **Privacy**: Network data exposed

#### 3. API Endpoints (Some)

**Pros:**

- Could proxy some read-only endpoints
- Edge caching benefits

**Cons:**

- ❌ **Complexity**: Split architecture
- ❌ **WebSocket**: Direct connection still needed
- ❌ **Data Sync**: Requires keeping data in sync

## Recommended Architecture

```
┌─────────────────────────────────┐
│   Cloudflare Pages (Frontend)   │
│   - Static React App            │
│   - Served via CDN              │
└──────────────┬──────────────────┘
               │ HTTPS/WSS
               │ API Calls
               ▼
┌─────────────────────────────────┐
│   Raspberry Pi 5 (Backend)      │
│   ┌───────────────────────────┐ │
│   │ Packet Capture (Scapy)   │ │ ← Must be local
│   │ Real-time Processing     │ │ ← Low latency needed
│   │ SQLite Database          │ │ ← Privacy + Performance
│   │ Device Fingerprinting   │ │ ← Real-time analysis
│   │ Threat Detection         │ │ ← Real-time analysis
│   │ Analytics                │ │ ← Local data access
│   │ Geolocation              │ │ ← Can use external APIs
│   │ FastAPI Server          │ │ ← API endpoints
│   │ WebSocket Server        │ │ ← Real-time updates
│   └───────────────────────────┘ │
└─────────────────────────────────┘
```

## Hybrid Approach (If Needed)

If you need some Cloudflare features, consider a **hybrid approach**:

### Option 1: Read Replicas (Not Recommended)

- Keep primary database on Pi
- Sync read-only data to Cloudflare D1
- **Issues**: Complex sync, data privacy, cost

### Option 2: Analytics Caching

- Keep database on Pi
- Cache aggregated analytics in Cloudflare KV
- **Issues**: Still requires data transfer, limited benefit

### Option 3: API Proxy (Minimal Benefit)

- Keep everything on Pi
- Use Cloudflare Worker as API proxy for CORS/security
- **Benefit**: Minimal, already handled by CORS

## Cost Analysis

### Current Architecture (All on Pi)

- **Storage**: Free (local disk)
- **Processing**: Free (Pi CPU)
- **Network**: Free (local network)
- **Egress**: $0
- **Total**: $0/month

### Cloudflare D1 Approach

- **Storage**: ~$0.001/GB-month (cheap)
- **Writes**: Free (but requires egress)
- **Egress**: ~$0.09/GB (expensive!)
- **Example**: 10GB/month = $0.90/month
- **Complexity**: High (streaming, sync, error handling)

### Real-World Example

If capturing 1GB of flow data per day:

- **30 days**: 30GB
- **Egress cost**: ~$2.70/month
- **Plus**: Development time, complexity, privacy concerns

## Performance Comparison

### Database Writes (Flows)

**On Pi (SQLite):**

- Latency: <1ms (local disk)
- Throughput: 1000+ writes/sec
- Cost: $0

**Cloudflare D1:**

- Latency: 100-500ms (network round-trip)
- Throughput: Limited by network
- Cost: $0.09/GB egress

### Real-Time Processing

**On Pi:**

- Packet → Flow: <10ms
- Immediate database write
- Real-time WebSocket updates

**Cloudflare:**

- Packet → Network → Cloudflare: 50-200ms
- Delayed processing
- Not suitable for real-time

## Privacy & Security Considerations

### Keeping Data on Pi

- ✅ Network traffic data stays local
- ✅ No data leaves your network
- ✅ Full control over data
- ✅ Compliance-friendly (GDPR, etc.)

### Moving to Cloudflare

- ❌ Network traffic data in cloud
- ❌ Data leaves your network
- ❌ Third-party data storage
- ❌ Compliance concerns

## When to Consider Cloudflare

Consider Cloudflare for database/components if:

1. **Multiple Pi Locations**: Need centralized database
2. **High Availability**: Need 99.99% uptime
3. **Global Access**: Need low-latency access from multiple locations
4. **Backup/Disaster Recovery**: Need automatic backups
5. **Scaling**: Need to handle multiple Pi devices

**But**: These use cases suggest a different architecture (centralized monitoring system), not moving the current single-Pi setup.

## Recommendation

### ✅ Keep Everything on Pi

**Reasons:**

1. **Packet capture** cannot be moved (technical limitation)
2. **Real-time processing** needs low latency (performance)
3. **Database** benefits from local access (privacy, cost, latency)
4. **Privacy** - network data stays local
5. **Cost** - no egress fees
6. **Simplicity** - single deployment, easier maintenance

### Cloudflare's Role

Use Cloudflare for:

- ✅ **Frontend hosting** (already done)
- ✅ **CDN** for static assets
- ✅ **DDoS protection**
- ✅ **SSL/TLS** termination
- ❌ **NOT** for database or backend processing

## Alternative: Cloudflare Tunnel

Instead of moving components, use **Cloudflare Tunnel** to securely expose your Pi backend:

- ✅ Backend stays on Pi
- ✅ Secure access via Cloudflare
- ✅ No port forwarding needed
- ✅ DDoS protection
- ✅ SSL/TLS automatically handled

This gives you Cloudflare benefits without moving your data.

## Conclusion

**Keep database and all backend components on Raspberry Pi.**

The current architecture is optimal for:

- Privacy
- Performance
- Cost
- Simplicity

Cloudflare's value is in **frontend hosting and security**, not in replacing your backend infrastructure.

## Next Steps

1. ✅ Keep current architecture (database on Pi)
2. ✅ Use Cloudflare Tunnel for secure backend access
3. ✅ Deploy frontend to Cloudflare Pages (already done)
4. ✅ Monitor performance and costs
5. ❌ Don't move database to Cloudflare D1 (not worth it)
