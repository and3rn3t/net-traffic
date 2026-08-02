# Architecture

## Deployment topology

```
┌─────────────────────────────────┐
│   Cloudflare Pages (Frontend)   │
│   - React App (static assets)   │
│   - Served via global CDN       │
└──────────────┬──────────────────┘
               │ HTTPS/WSS
               │ API calls + WebSocket
               ▼
┌─────────────────────────────────┐
│   Raspberry Pi 5 (Backend)      │
│   - FastAPI server              │
│   - Packet capture (Scapy)      │
│   - SQLite database             │
│   - Device fingerprinting       │
│   - Threat detection            │
│   - Analytics                   │
│   - WebSocket server            │
└─────────────────────────────────┘
```

- **Frontend**: `net-traffic.andernet.dev`, deployed to Cloudflare Pages via Git push (`npm run build` → `dist/`).
- **Backend**: runs on a Raspberry Pi 5 (`pi@192.168.1.23`, systemd unit `netinsight-backend.service`), exposed publicly at `net-backend.andernet.dev` through a `cloudflared` tunnel (see [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md)).
- Router is a UniFi UDM Pro; see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md) for interface layout and how packet capture reaches the backend.

## Why the database and processing stay on the Pi (not Cloudflare D1/Workers)

| Concern | On Pi | Cloudflare D1/Workers |
|---|---|---|
| Packet capture | ✅ direct NIC access via Scapy `sniff()`/raw socket | ❌ Workers can't access local network interfaces |
| Write latency | <1ms (local disk) | 100-500ms network round-trip |
| Privacy | Traffic data never leaves the local network | Data would leave the network |
| Cost | $0 | ~$0.09/GB egress (e.g. ~$0.90/month at 10GB/day of flow data) |
| Real-time WebSocket updates | Immediate | Delayed by network hop |

Packet capture, device fingerprinting, and threat detection all require immediate access to freshly-captured packets, so they must run wherever capture happens. Given that, keeping the SQLite database and all analytics colocated on the Pi avoids streaming every packet/flow off-box. Cloudflare's role is deliberately limited to:

- Frontend hosting + CDN
- DDoS protection / SSL termination
- Cloudflare Tunnel (secure backend exposure, no open inbound ports)

Cloudflare is **not** used for storage, processing, or packet capture.

## Frontend ↔ backend connection

- WebSocket URL is derived from `VITE_API_BASE_URL` (`https://` → `wss://`, `http://` → `ws://`) — see `src/lib/api.ts`.
- Backend `ALLOWED_ORIGINS` must include the exact frontend origin(s); see [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md).
- Deploying frontend changes: push to `main`, Cloudflare Pages rebuilds automatically. See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md).
- Deploying backend changes: `rsync` straight to the Pi's working tree (not `git pull`) and restart the systemd service — see [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md).

## When a different architecture might make sense

Revisit "everything on one Pi" only if you need: multiple Pi locations with centralized storage, 99.99% uptime, low-latency access from multiple sites, or automatic off-site backup/DR. Those needs imply a differently-shaped system (centralized multi-device monitoring), not moving today's single-Pi setup to the edge.
