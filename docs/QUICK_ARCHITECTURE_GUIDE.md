# Quick Architecture Guide

## What Goes Where?

### ✅ Cloudflare Pages

- **Frontend (React App)**
  - Static assets
  - CDN distribution
  - Global edge network

### ✅ Raspberry Pi 5

- **Backend API (FastAPI)**
- **Packet Capture (Scapy)**
- **Database (SQLite)**
- **All Data Processing**
  - Device fingerprinting
  - Threat detection
  - Analytics
  - Real-time processing

## Why This Architecture?

### Packet Capture Must Be Local

- Requires direct network interface access
- Cannot be done from Cloudflare Workers
- Needs real-time processing

### Database Should Stay Local

- **Privacy**: Network data stays on your network
- **Performance**: <1ms latency vs 100-500ms
- **Cost**: $0 vs ~$0.09/GB egress
- **Simplicity**: No data streaming needed

### Real-Time Processing Needs Low Latency

- Processes packets immediately
- Updates database in real-time
- Sends WebSocket updates instantly

## Cost Comparison

| Component              | On Pi  | Cloudflare D1 |
| ---------------------- | ------ | ------------- |
| Storage                | Free   | ~$0.001/GB    |
| Processing             | Free   | Free          |
| **Egress**             | **$0** | **~$0.09/GB** |
| **Total (10GB/month)** | **$0** | **~$0.90**    |

## Recommendation

**Keep everything on Pi except the frontend.**

See [ARCHITECTURE_DECISION_DATABASE.md](./ARCHITECTURE_DECISION_DATABASE.md) for detailed analysis.
