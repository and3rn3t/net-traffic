# Quick Start: API Connection Setup

## 🚀 5-Minute Setup

### 1. Backend Configuration (Raspberry Pi)

Edit `.env` or `docker-compose.backend-only.yml`:

```env
ALLOWED_ORIGINS=https://your-app.pages.dev
NETWORK_INTERFACE=eth0
```

Restart:

```bash
docker-compose -f docker-compose.backend-only.yml restart backend
```

### 2. Frontend Configuration (Cloudflare Pages)

In Cloudflare Dashboard > Pages > Settings > Environment Variables:

```
VITE_API_BASE_URL = https://your-backend-url.com
VITE_USE_REAL_API = true
```

**Retry deployment** to apply changes.

### 3. Verify Connection

```bash
# Test backend
curl https://your-backend-url.com/api/health

# Should return:
# { "status": "healthy", "capture": { "running": true, ... } }
```

## ✅ Status Check

| Component          | Check | Command                          |
| ------------------ | ----- | -------------------------------- |
| Backend Running    | ✓     | `docker ps \| grep netinsight`   |
| Capture Active     | ✓     | `curl .../api/capture/status`    |
| CORS Configured    | ✓     | Browser console (no CORS errors) |
| Frontend Connected | ✓     | Frontend shows data              |

## 🔍 Troubleshooting

**No data in frontend?**

1. Generate traffic: `curl https://google.com` on Pi
2. Wait 5 seconds
3. Refresh frontend

**CORS errors?**

- Verify `ALLOWED_ORIGINS` includes exact frontend URL
- Restart backend after change

**Capture not running?**

- Check logs: `docker logs netinsight-backend`
- Verify interface: `ip link show`
- Check SCAPY: `docker exec netinsight-backend pip list \| grep scapy`

## 📖 Full Guides

- [PRODUCTION_API_CONNECTION.md](./PRODUCTION_API_CONNECTION.md) - Complete API connection setup
- [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) - Detailed Cloudflare Tunnel guide
- [CLOUDFLARE_TUNNEL_QUICK_START.md](./CLOUDFLARE_TUNNEL_QUICK_START.md) - 5-minute tunnel setup
