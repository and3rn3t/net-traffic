# Cloudflare Tunnel Quick Start

## 🚀 5-Minute Setup

### 1. Install Cloudflared on Raspberry Pi

```bash
# Download to home directory first (requires sudo for /usr/local/bin)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared
sudo mv ~/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Or use sudo directly:
# sudo curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared

cloudflared --version
```

### 2. Login to Cloudflare

```bash
cloudflared tunnel login
```
Opens browser - authorize the tunnel.

### 3. Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create netinsight-backend

# Create DNS route (replace with your subdomain)
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

### 4. Configure Tunnel

```bash
nano ~/.cloudflared/config.yml
```

**Add:**

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  - service: http_status:404
```

Replace `<tunnel-uuid>` with the UUID from step 3.

### 5. Test Tunnel

```bash
cloudflared tunnel run netinsight-backend
```

Test: `curl https://net-backend.andernet.dev/api/health`

### 6. Install as Service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### 7. Update Configurations

**Backend CORS (`docker-compose.backend-only.yml` or `.env`):**
```env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev,https://net-backend.andernet.dev
```

**Frontend (Cloudflare Dashboard > Pages > Environment Variables):**
```
VITE_API_BASE_URL=https://net-backend.andernet.dev
VITE_USE_REAL_API=true
```

## ✅ Verify

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Test backend
curl https://net-backend.andernet.dev/api/health

# View logs
sudo journalctl -u cloudflared -f
```

## 📖 Full Guide

See [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) for detailed instructions and troubleshooting.

