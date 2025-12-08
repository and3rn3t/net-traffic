# API Connection Setup Summary

Quick reference guide for connecting Cloudflare Frontend to Raspberry Pi Backend with SCAPY.

## ✅ What's Already Working

1. **SCAPY Integration**: Fully integrated in `backend/services/packet_capture.py`
   - Automatically detects if SCAPY is available
   - Falls back gracefully if SCAPY is missing (logs warning, continues)
   - Starts capture automatically on backend startup

2. **Automatic Capture Start**: Backend starts packet capture automatically in `main.py` lifespan function
   - No manual start required
   - Captures on configured network interface (eth0/wlan0)
   - Optimized for Raspberry Pi 5 performance

3. **API Endpoints**: All endpoints are ready
   - Health check: `/api/health`
   - Capture status: `/api/capture/status`
   - Devices, flows, analytics, etc.

4. **Frontend API Client**: Configured in `src/lib/api.ts`
   - Uses `VITE_API_BASE_URL` environment variable
   - Automatic WebSocket URL conversion (http→ws, https→wss)
   - Retry logic and error handling

## 🔧 Configuration Required

### Backend (Raspberry Pi)

**1. Set CORS to allow Cloudflare Pages domain:**

```env
ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
```

**2. Verify network interface:**

```env
NETWORK_INTERFACE=eth0  # or wlan0 for WiFi
```

**3. Restart backend after changes:**

```bash
docker-compose -f docker-compose.backend-only.yml restart backend
```

### Frontend (Cloudflare Pages)

**Set environment variables in Cloudflare Dashboard:**

```
VITE_API_BASE_URL=https://your-backend-url.com
VITE_USE_REAL_API=true
```

**Then rebuild deployment** (Cloudflare Pages > Deployments > Retry)

## 🧪 Verification

### Quick Test Script

**Linux/Mac:**

```bash
./scripts/verify-api-connection.sh https://your-backend-url.com https://your-app.pages.dev
```

**Windows:**

```powershell
.\scripts\verify-api-connection.ps1 https://your-backend-url.com https://your-app.pages.dev
```

**Manual Test:**

```bash
# 1. Test backend health
curl https://your-backend-url.com/api/health

# 2. Test capture status
curl https://your-backend-url.com/api/capture/status

# 3. Test from frontend (browser console)
fetch('https://your-backend-url.com/api/health')
  .then(r => r.json())
  .then(console.log)
```

## 📋 Checklist

- [ ] Backend running on Raspberry Pi
- [ ] SCAPY installed (included in Docker image)
- [ ] `ALLOWED_ORIGINS` includes Cloudflare Pages domain
- [ ] `NETWORK_INTERFACE` matches your active interface
- [ ] Backend accessible from internet (Tunnel/Port Forwarding/VPN)
- [ ] Frontend `VITE_API_BASE_URL` set correctly
- [ ] Frontend rebuilt after environment variable changes
- [ ] Health endpoint returns `capture.running: true`
- [ ] Frontend can fetch data from backend
- [ ] Network traffic generates flows in database

## 🐛 Common Issues

### CORS Errors

- **Symptom**: Browser console shows CORS policy errors
- **Fix**: Update `ALLOWED_ORIGINS` in backend, include exact frontend URL

### Capture Not Running

- **Symptom**: `/api/capture/status` shows `running: false`
- **Fix**: Check SCAPY installation, verify interface exists, check container permissions

### No Data in Frontend

- **Symptom**: Frontend connects but shows no devices/flows
- **Fix**: Generate network traffic, wait a few seconds, check database

### Backend Not Accessible

- **Symptom**: Frontend can't connect (timeout)
- **Fix**: Check backend is running, verify firewall, test with curl

## 📚 Full Documentation

See [PRODUCTION_API_CONNECTION.md](./PRODUCTION_API_CONNECTION.md) for detailed setup instructions.

## 🔗 Key Files

- Backend API: `backend/main.py`
- Packet Capture: `backend/services/packet_capture.py`
- Frontend API Client: `src/lib/api.ts`
- Frontend Hook: `src/hooks/useApiData.ts`
- Backend Config: `backend/utils/config.py`
- Docker Compose: `docker-compose.backend-only.yml`
