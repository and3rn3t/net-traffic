# Cloudflare Tunnel as Systemd Service

This guide shows how to run Cloudflare Tunnel as a systemd service on your Raspberry Pi (instead of using Docker).

## Quick Setup

```bash
# 1. Create config file (if not done)
./scripts/setup-cloudflared-config.sh

# 2. Install as systemd service
sudo ./scripts/setup-cloudflared-service.sh
```

## Manual Setup

### Step 1: Create DNS Route

```bash
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

### Step 2: Create Systemd Service

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

Add:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/pi/.cloudflared/config.yml run netinsight-backend
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Step 3: Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable (starts on boot)
sudo systemctl enable cloudflared

# Start now
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
```

## Service Management

```bash
# Check status
sudo systemctl status cloudflared

# Start service
sudo systemctl start cloudflared

# Stop service
sudo systemctl stop cloudflared

# Restart service
sudo systemctl restart cloudflared

# View logs
sudo journalctl -u cloudflared -f

# View last 50 lines
sudo journalctl -u cloudflared -n 50

# Disable auto-start
sudo systemctl disable cloudflared
```

## Verify It's Working

```bash
# Check service is running
sudo systemctl status cloudflared

# Check tunnel logs
sudo journalctl -u cloudflared -f

# Test tunnel endpoint
curl https://net-backend.andernet.dev/api/health
```

## Troubleshooting

### Service Won't Start

**Check logs:**

```bash
sudo journalctl -u cloudflared -n 50
```

**Common issues:**

- Config file not found: Check `/home/pi/.cloudflared/config.yml` exists
- Credentials file not found: Check UUID in config matches actual file
- Permission errors: Ensure user `pi` can read config files

**Check config:**

```bash
cloudflared tunnel validate
```

### Service Keeps Restarting

**Check why it's failing:**

```bash
sudo journalctl -u cloudflared -n 100 --no-pager
```

**Common causes:**

- Backend not running (if using `http://localhost:8000`)
- Config file syntax error
- Network connectivity issues

### Update Config

1. Edit config: `nano ~/.cloudflared/config.yml`
2. Validate: `cloudflared tunnel validate`
3. Restart: `sudo systemctl restart cloudflared`

## Docker vs Systemd Service

| Aspect         | Docker (docker-compose)   | Systemd Service      |
| -------------- | ------------------------- | -------------------- |
| **Isolation**  | ✅ Container isolation    | Shared environment   |
| **Management** | `docker-compose` commands | `systemctl` commands |
| **Logs**       | `docker logs`             | `journalctl`         |
| **Auto-start** | Docker restart policy     | systemd enabled      |
| **Config**     | Mounted from host         | Direct file access   |
| **Updates**    | Pull new image            | Update binary        |

**Recommendation**:

- Use **Docker** if you want containerization and easier management
- Use **Systemd** if you prefer native service management

## Integration with Docker Backend

If your backend runs in Docker but you want cloudflared as a systemd service:

**Config should use:**

```yaml
ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000 # Backend exposed on host port
```

Make sure backend port is exposed:

```yaml
# In docker-compose.backend-only.yml
ports:
  - '8000:8000' # Exposes backend to host
```

## Next Steps

Once the service is running:

1. ✅ Verify tunnel: `curl https://net-backend.andernet.dev/api/health`
2. ✅ Update frontend: Set `VITE_API_BASE_URL=https://net-backend.andernet.dev`
3. ✅ Test end-to-end connection
4. ✅ Monitor logs: `sudo journalctl -u cloudflared -f`
