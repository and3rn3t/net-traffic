# Fix: Tunnel Cannot Reach Backend (Unable to reach the origin service)

## Problem

Tunnel logs show:

```
ERR error="Unable to reach the origin service"
ERR Request failed error="Unable to reach the origin service"
```

But the tunnel is connected and running.

## Cause

The tunnel cannot connect to the backend. This happens when:

1. **Wrong service URL in config** - Using `http://backend:8000` when running as systemd (Docker service names don't resolve from host)
2. **Backend not running** - Backend container is stopped
3. **Port not exposed** - Docker backend not exposing port 8000 to host
4. **Backend not accessible** - Backend container not responding

## Solution

### Step 1: Verify Backend is Running

```bash
# Check if backend container is running
docker ps | grep netinsight-backend

# Check if backend is responding locally
curl http://localhost:8000/api/health
```

If backend is not responding, start it:

```bash
docker compose -f docker-compose.backend-only.yml up -d backend
```

### Step 2: Check Config File

Since you're using a **systemd service** (not Docker), the config must use `localhost`:

```bash
cat ~/.cloudflared/config.yml
```

**It should say:**

```yaml
ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000 # ✅ Correct for systemd service
```

**NOT:**

```yaml
ingress:
  - hostname: net-backend.andernet.dev
    service: http://backend:8000 # ❌ Wrong - 'backend' is Docker service name, won't resolve from host
```

### Step 3: Fix Config (If Needed)

If your config says `http://backend:8000`, change it:

```bash
nano ~/.cloudflared/config.yml
```

Change to:

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000 # Use localhost for systemd service
  - service: http_status:404
```

### Step 4: Verify Backend Port is Exposed

Check your `docker-compose.backend-only.yml`:

```yaml
ports:
  - '8000:8000' # Must expose port to host
```

### Step 5: Restart Tunnel Service

```bash
# Validate config
cloudflared tunnel validate

# Restart service
sudo systemctl restart cloudflared

# Check logs
sudo journalctl -u cloudflared -f
```

## Quick Diagnosis

Run these commands to diagnose:

```bash
# 1. Is backend running?
docker ps | grep backend

# 2. Is backend accessible on host?
curl http://localhost:8000/api/health

# 3. What does config say?
cat ~/.cloudflared/config.yml | grep service

# 4. Is port exposed?
docker port netinsight-backend 2>/dev/null || echo "Container not running"
```

## Common Config Mistakes

| Your Setup                          | Config Should Use       | Why                                                   |
| ----------------------------------- | ----------------------- | ----------------------------------------------------- |
| Systemd service + Docker backend    | `http://localhost:8000` | Systemd runs on host, connects to exposed Docker port |
| Docker cloudflared + Docker backend | `http://backend:8000`   | Both in Docker, use service name                      |
| Systemd service + Host backend      | `http://localhost:8000` | Both on host                                          |

## Verification

After fixing, verify:

```bash
# 1. Backend responds locally
curl http://localhost:8000/api/health

# 2. Tunnel service is running
sudo systemctl status cloudflared

# 3. Tunnel logs show no errors
sudo journalctl -u cloudflared -n 20

# 4. Tunnel endpoint works
curl https://net-backend.andernet.dev/api/health
```
