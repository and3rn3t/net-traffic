# Docker + Cloudflare Tunnel Setup Guide

This guide explains how to set up Cloudflare Tunnel with Docker for your NetInsight backend.

## Overview

Two deployment options:

1. **Backend Only** (`docker-compose.backend-only.yml`) - Backend API, no tunnel
2. **Backend + Tunnel** (`docker-compose.backend-with-tunnel.yml`) - Backend API + Cloudflare Tunnel in Docker

## Option 1: Cloudflare Tunnel in Docker (Recommended)

### Prerequisites

1. ✅ Docker and Docker Compose installed on Raspberry Pi
2. ✅ Cloudflare account
3. ✅ Domain added to Cloudflare (optional, for custom subdomain)

> 💡 **Quick Setup**: Use the automated setup script:
>
> ```bash
> ./scripts/setup-cloudflared-config.sh
> ```
>
> This script guides you through all the steps below automatically.

### Step 1: Authenticate Cloudflare Tunnel

**Important**: Run these commands on your Raspberry Pi host (not in Docker).

**On your Raspberry Pi host** (not in container):

```bash
# Install cloudflared if not already installed
# Download to home directory first (requires sudo for /usr/local/bin)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared
sudo mv ~/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Or use sudo directly:
# sudo curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared

# Verify installation
cloudflared --version

# Authenticate (creates ~/.cloudflared/cert.pem)
cloudflared tunnel login
```

### Step 2: Create Tunnel

```bash
# Create tunnel (run as pi user, not with sudo)
cloudflared tunnel create netinsight-backend

# Create DNS route (run as pi user, not with sudo)
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

**Important**: These commands must run as the `pi` user (not root/sudo) because they need access to `~/.cloudflared/cert.pem` which is in `/home/pi/.cloudflared/`.

**Note the tunnel UUID** from the output - you'll need it for the config file.

### Step 3: Create Configuration File

Create `~/.cloudflared/config.yml`:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add configuration (copy from `backend/.cloudflared-config.example.yml`):

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://backend:8000
  - service: http_status:404
```

**Important:**

- Replace `<tunnel-uuid>` with the actual UUID from step 2
- Use `backend:8000` as the service URL (Docker service name, not `localhost`)
- Replace `net-backend.andernet.dev` with your desired subdomain

### Step 4: Deploy with Docker Compose

```bash
# Use the compose file with tunnel included
docker-compose -f docker-compose.backend-with-tunnel.yml up -d

# Check status
docker-compose -f docker-compose.backend-with-tunnel.yml ps

# View logs
docker-compose -f docker-compose.backend-with-tunnel.yml logs -f cloudflared
```

### Step 5: Verify Tunnel

```bash
# Test tunnel endpoint
curl https://net-backend.andernet.dev/api/health

# Check tunnel logs
docker logs netinsight-cloudflared

# Check tunnel status
docker exec netinsight-cloudflared cloudflared tunnel info
```

## Option 2: Cloudflare Tunnel on Host, Backend in Docker

If you prefer to run cloudflared on the host instead of in Docker:

### Step 1: Deploy Backend Only

```bash
docker-compose -f docker-compose.backend-only.yml up -d
```

### Step 2: Install and Configure Cloudflared on Host

Follow steps 1-3 from Option 1, but use `localhost:8000` in config:

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  - service: http_status:404
```

### Step 3: Run Tunnel on Host

```bash
# Run manually (for testing)
cloudflared tunnel run netinsight-backend

# Or install as systemd service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## Configuration Details

### Docker Network Setup

When using Docker Compose, the services communicate via the `netinsight-network` bridge network:

- Backend service name: `backend`
- Cloudflared connects to: `http://backend:8000`

### Volume Mounts

The cloudflared container mounts `~/.cloudflared` from the host:

```yaml
volumes:
  - ~/.cloudflared:/home/nonroot/.cloudflared:ro
```

This provides:

- ✅ Tunnel credentials (`cert.pem`, `*.json`)
- ✅ Configuration file (`config.yml`)
- ✅ Read-only access (prevents container from modifying credentials)

### CORS Configuration

Update backend `ALLOWED_ORIGINS` to include:

- Frontend domain: `https://net.andernet.dev`
- Tunnel URL: `https://net-backend.andernet.dev`
- Local development: `http://localhost:*`

```env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev,https://net-backend.andernet.dev,http://localhost,http://localhost:80,http://localhost:3000
```

## Troubleshooting

### Tunnel Container Won't Start

**Check logs:**

```bash
docker logs netinsight-cloudflared
```

**Common issues:**

- Missing config file: Ensure `~/.cloudflared/config.yml` exists
- Wrong credentials: Verify `*.json` file matches tunnel UUID
- Permission errors: Check file permissions in `~/.cloudflared`

**Verify config:**

```bash
# From host
cloudflared tunnel validate

# Or check mounted files
docker exec netinsight-cloudflared ls -la /home/nonroot/.cloudflared/
```

### Tunnel Starts But Can't Connect to Backend

**Verify backend is accessible:**

```bash
# From cloudflared container
docker exec netinsight-cloudflared wget -O- http://backend:8000/api/health

# From host
curl http://localhost:8000/api/health
```

**Check network:**

```bash
# Verify both containers are on same network
docker network inspect netinsight-network

# Test DNS resolution
docker exec netinsight-cloudflared ping -c 1 backend
```

**Config issue:** Ensure service URL in `config.yml` uses `backend:8000` (Docker service name) not `localhost:8000`

### DNS/SSL Issues

**Check DNS:**

```bash
dig net-backend.andernet.dev
nslookup net-backend.andernet.dev
```

**Verify SSL certificate:**

```bash
curl -vI https://net-backend.andernet.dev/api/health
```

Cloudflare automatically provisions SSL certificates - wait a few minutes after DNS setup.

### CORS Errors

**Verify ALLOWED_ORIGINS includes tunnel URL:**

```bash
docker exec netinsight-backend env | grep ALLOWED_ORIGINS
```

**Update and restart:**

```bash
# Update docker-compose file or .env
# Then restart
docker-compose -f docker-compose.backend-with-tunnel.yml restart backend
```

## Security Considerations

1. **Credentials**: Keep `~/.cloudflared` directory secure (600 permissions)

   ```bash
   chmod 600 ~/.cloudflared/*.json
   chmod 600 ~/.cloudflared/cert.pem
   ```

2. **Read-Only Mount**: The compose file uses `:ro` flag for read-only access

3. **Network Isolation**: Services communicate only via Docker network

4. **Backend Security**: Ensure backend has authentication enabled

## Maintenance

### View Tunnel Status

```bash
# List tunnels
docker exec netinsight-cloudflared cloudflared tunnel list

# Get tunnel info
docker exec netinsight-cloudflared cloudflared tunnel info netinsight-backend
```

### Update Configuration

1. Edit `~/.cloudflared/config.yml` on host
2. Validate: `cloudflared tunnel validate`
3. Restart: `docker-compose -f docker-compose.backend-with-tunnel.yml restart cloudflared`

### Update Cloudflared Image

```bash
docker-compose -f docker-compose.backend-with-tunnel.yml pull cloudflared
docker-compose -f docker-compose.backend-with-tunnel.yml up -d cloudflared
```

### Logs

```bash
# Cloudflared logs
docker logs -f netinsight-cloudflared

# Backend logs
docker logs -f netinsight-backend

# Both services
docker-compose -f docker-compose.backend-with-tunnel.yml logs -f
```

## Comparison: Docker vs Host Installation

| Aspect     | Docker (Recommended) | Host Installation  |
| ---------- | -------------------- | ------------------ |
| Isolation  | ✅ Better isolation  | Shared environment |
| Management | ✅ Docker Compose    | Systemd service    |
| Updates    | ✅ Easy (pull image) | Manual update      |
| Debugging  | Docker logs          | System logs        |
| Config     | Docker volumes       | Host filesystem    |

## Quick Reference

**Files:**

- Compose file: `docker-compose.backend-with-tunnel.yml`
- Config example: `backend/.cloudflared-config.example.yml`
- Host config: `~/.cloudflared/config.yml`

**Commands:**

```bash
# Start services
docker-compose -f docker-compose.backend-with-tunnel.yml up -d

# Stop services
docker-compose -f docker-compose.backend-with-tunnel.yml down

# View logs
docker-compose -f docker-compose.backend-with-tunnel.yml logs -f

# Restart tunnel
docker-compose -f docker-compose.backend-with-tunnel.yml restart cloudflared
```

## Next Steps

1. ✅ Configure tunnel and test connection
2. ✅ Update frontend `VITE_API_BASE_URL` to tunnel URL
3. ✅ Verify end-to-end connection
4. ✅ Set up monitoring/alerting
5. ✅ Document tunnel URL for your team

For more details on Cloudflare Tunnel setup, see [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md)
