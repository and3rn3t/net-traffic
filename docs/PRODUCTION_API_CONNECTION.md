# Production API Connection Guide

## Connecting Cloudflare Frontend to Raspberry Pi Backend with SCAPY

This guide walks you through configuring the API connection between your Cloudflare Pages frontend and your Raspberry Pi 5 backend with SCAPY packet capture.

## Architecture Overview

```
┌─────────────────────┐         HTTPS/WSS          ┌──────────────────┐
│  Cloudflare Pages   │ ──────────────────────────> │  Raspberry Pi 5  │
│  (Frontend - CDN)   │                             │  (Backend API)   │
└─────────────────────┘                             └──────────────────┘
                                                             │
                                                             │ SCAPY
                                                             ▼
                                                      ┌──────────────┐
                                                      │ Network      │
                                                      │ Interface    │
                                                      │ (eth0/wlan0) │
                                                      └──────────────┘
```

## Prerequisites

1. ✅ Frontend deployed to Cloudflare Pages
2. ✅ Backend running on Raspberry Pi 5
3. ✅ SCAPY installed on Raspberry Pi (included in Docker image)
4. ✅ Backend accessible from internet (via Cloudflare Tunnel, port forwarding, or VPN)

## Step 1: Backend Configuration (Raspberry Pi)

### 1.1 Update CORS Settings

The backend must allow requests from your Cloudflare Pages domain.

**Option A: Using Environment Variables (Recommended)**

Create or update `.env` file in your backend directory:

```env
# Network interface for packet capture (eth0 for wired, wlan0 for WiFi)
NETWORK_INTERFACE=eth0

# Server configuration
HOST=0.0.0.0
PORT=8000

# Database path
DB_PATH=/app/data/netinsight.db

# CORS: Add your Cloudflare Pages domain(s)
# Replace with your actual Cloudflare Pages URL
ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com

# Optional: Add localhost for local development
# ALLOWED_ORIGINS=https://your-app.pages.dev,http://localhost:5173

# Other settings
DEBUG=false
DATA_RETENTION_DAYS=30
RATE_LIMIT_PER_MINUTE=600
```

**Option B: Using Docker Compose**

Update `docker-compose.backend-only.yml`:

```yaml
services:
  backend:
    environment:
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://your-app.pages.dev,https://your-custom-domain.com}
```

Or set in your shell before running:

```bash
export ALLOWED_ORIGINS="https://your-app.pages.dev,https://your-custom-domain.com"
docker-compose -f docker-compose.backend-only.yml up -d
```

### 1.2 Verify Network Interface

Check which network interface your Raspberry Pi is using:

```bash
# List all interfaces
ip link show

# Or
ifconfig

# Common interfaces:
# - eth0: Wired Ethernet
# - wlan0: WiFi
# - usb0: USB network adapter
```

Update `NETWORK_INTERFACE` in your `.env` to match your active interface.

### 1.3 Verify SCAPY Installation

SCAPY should be included in the Docker image, but verify:

```bash
# Inside the container
docker exec -it netinsight-backend python3 -c "from scapy.all import sniff; print('SCAPY OK')"

# Or check requirements
docker exec -it netinsight-backend pip list | grep scapy
```

If SCAPY is missing, the backend will log a warning but still run (capture will be disabled).

### 1.4 Verify Packet Capture Permissions

Packet capture requires elevated privileges. The Docker setup includes:

```yaml
cap_add:
  - NET_ADMIN
  - NET_RAW
```

If capture doesn't start, check logs:

```bash
docker logs netinsight-backend | grep -i "packet capture\|scapy\|interface"
```

## Step 2: Frontend Configuration (Cloudflare Pages)

### 2.1 Set Environment Variables

In Cloudflare Dashboard:

1. Go to **Pages** > Your Project > **Settings** > **Environment Variables**
2. Add the following variables:

**For Production:**

```
VITE_API_BASE_URL = https://your-backend-url.com
VITE_USE_REAL_API = true
```

**For Preview/Development:**

```
VITE_API_BASE_URL = http://your-raspberry-pi-ip:8000
VITE_USE_REAL_API = true
```

**Important Notes:**

- Replace `your-backend-url.com` with your actual backend URL
- If using Cloudflare Tunnel: `https://your-tunnel-url.trycloudflare.com`
- If using direct IP: `http://your-raspberry-pi-ip:8000` (HTTP only)
- Environment variables prefixed with `VITE_` are baked into the build at build time

### 2.2 Rebuild After Environment Changes

After changing environment variables:

1. Go to **Pages** > Your Project > **Deployments**
2. Click **Retry deployment** on the latest deployment
3. Or push a new commit to trigger automatic rebuild

## Step 3: Backend Accessibility

Your Raspberry Pi backend must be accessible from the internet for the Cloudflare frontend to connect.

> 📖 **Detailed Tunnel Guide**: For complete Cloudflare Tunnel setup instructions, see [docs/CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md)

### Option A: Cloudflare Tunnel (Recommended)

1. Install `cloudflared` on Raspberry Pi:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

2. Create a tunnel:

```bash
cloudflared tunnel create netinsight-backend
cloudflared tunnel route dns netinsight-backend your-backend.example.com
```

3. Create config file `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: your-backend.example.com
    service: http://localhost:8000
  - service: http_status:404
```

4. Run tunnel:

```bash
cloudflared tunnel run netinsight-backend
```

### Option B: Port Forwarding

1. Configure router to forward port 8000 to Raspberry Pi
2. Use your public IP: `http://your-public-ip:8000`
3. **Security Warning**: Exposing the backend directly requires additional security measures (firewall, authentication, etc.)

### Option C: VPN

Connect to your local network via VPN, then use local IP.

## Step 4: Verify Connection

### 4.1 Test Backend Health

```bash
# From Raspberry Pi
curl http://localhost:8000/api/health

# From external machine (replace with your backend URL)
curl https://your-backend-url.com/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00",
  "capture": {
    "running": true,
    "interface": "eth0",
    "packets_captured": 1234,
    "flows_detected": 56
  }
}
```

### 4.2 Test CORS

From browser console on your Cloudflare Pages site:

```javascript
fetch('https://your-backend-url.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

If CORS is misconfigured, you'll see:

```
Access to fetch at '...' from origin 'https://your-app.pages.dev' has been blocked by CORS policy
```

### 4.3 Test Frontend Connection

1. Open your Cloudflare Pages site
2. Open browser DevTools > Network tab
3. Check for requests to `/api/health`
4. Should see successful response (200 OK)

### 4.4 Verify SCAPY Capture

Check backend logs:

```bash
docker logs netinsight-backend | grep -i "packet capture\|scapy"
```

You should see:

```
INFO: Packet capture started on eth0 (filter: ip or ip6, sampling: 100.0%)
```

Check capture status via API:

```bash
curl https://your-backend-url.com/api/capture/status
```

Expected:

```json
{
  "running": true,
  "interface": "eth0",
  "packets_captured": 12345,
  "flows_detected": 789
}
```

## Step 5: Troubleshooting

### Issue: CORS Errors

**Symptom:** Browser console shows CORS errors

**Solution:**

1. Verify `ALLOWED_ORIGINS` includes your exact Cloudflare Pages URL
2. Check for trailing slashes (include both `https://app.pages.dev` and `https://app.pages.dev/`)
3. Restart backend after changing CORS settings
4. Clear browser cache

### Issue: Backend Not Accessible

**Symptom:** Frontend can't connect to backend (timeout, connection refused)

**Solution:**

1. Verify backend is running: `docker ps | grep netinsight-backend`
2. Check firewall: `sudo ufw status`
3. Test local connection: `curl http://localhost:8000/api/health`
4. Test from external: `curl https://your-backend-url.com/api/health`
5. Check Cloudflare Tunnel status if using tunnel

### Issue: Packet Capture Not Starting

**Symptom:** Health check shows `capture.running: false`

**Solution:**

1. Check SCAPY installation: `docker exec netinsight-backend pip list | grep scapy`
2. Verify interface exists: `docker exec netinsight-backend ip link show`
3. Check permissions: Ensure container has `NET_ADMIN` and `NET_RAW` capabilities
4. Try running with `privileged: true` in docker-compose (for testing only)
5. Check logs: `docker logs netinsight-backend | grep -i error`

### Issue: No Data Appearing in Frontend

**Symptom:** Frontend connects but shows no devices/flows

**Solution:**

1. Verify capture is running: Check `/api/capture/status`
2. Generate traffic: Browse websites, ping servers
3. Wait a few seconds for flows to be processed
4. Check database: `docker exec netinsight-backend sqlite3 /app/data/netinsight.db "SELECT COUNT(*) FROM flows;"`
5. Check backend logs for errors

### Issue: WebSocket Connection Fails

**Symptom:** Real-time updates not working

**Solution:**

1. Verify WebSocket URL is correct (automatically derived from `VITE_API_BASE_URL`)
2. Check if backend supports WebSocket: `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://your-backend-url.com/ws`
3. Check Cloudflare Tunnel supports WebSocket (should work automatically)
4. Verify CORS allows WebSocket upgrade

## Step 6: Production Checklist

- [ ] Backend CORS configured with Cloudflare Pages domain
- [ ] Frontend `VITE_API_BASE_URL` set correctly
- [ ] Backend accessible from internet (Tunnel/Port Forwarding/VPN)
- [ ] SCAPY installed and working
- [ ] Packet capture starting automatically
- [ ] Health check endpoint responding
- [ ] Frontend can fetch data from backend
- [ ] Real-time updates working (WebSocket)
- [ ] Network interface correct (eth0/wlan0)
- [ ] Backend logs show no errors
- [ ] Data appearing in frontend dashboard

## Security Considerations

1. **Backend Exposure**: Exposing backend directly to internet requires:
   - Strong authentication (already implemented)
   - Rate limiting (already implemented)
   - Firewall rules
   - Consider using Cloudflare Tunnel with access policies

2. **CORS**: Only allow trusted origins in `ALLOWED_ORIGINS`

3. **HTTPS**: Always use HTTPS in production (Cloudflare Tunnel provides this)

4. **API Keys**: Consider using API key authentication for production

5. **Network Access**: Restrict backend access to specific IPs if possible

## Next Steps

Once connection is verified:

1. Monitor backend logs for errors
2. Check packet capture statistics regularly
3. Set up alerts for backend downtime
4. Configure backup for database
5. Monitor Cloudflare Pages deployment status

## Support

For issues:

1. Check backend logs: `docker logs netinsight-backend`
2. Check frontend browser console
3. Test API endpoints directly with `curl`
4. Verify environment variables are set correctly
