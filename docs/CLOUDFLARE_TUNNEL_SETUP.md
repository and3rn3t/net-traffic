# Cloudflare Tunnel Setup Guide

## Connecting Raspberry Pi Backend to Cloudflare Frontend

This guide walks you through setting up a Cloudflare Tunnel to securely expose your Raspberry Pi 5 backend API so your Cloudflare Pages frontend can connect to it.

> 💡 **Docker Users**: If you're using Docker, see [DOCKER_CLOUDFLARE_TUNNEL_SETUP.md](./DOCKER_CLOUDFLARE_TUNNEL_SETUP.md) for Docker-specific instructions.

## What is Cloudflare Tunnel?

Cloudflare Tunnel (formerly Argo Tunnel) creates a secure, outbound-only connection from your Raspberry Pi to Cloudflare. This means:

- ✅ No need to open ports on your router
- ✅ No need to expose your Pi's IP address
- ✅ Automatic HTTPS/SSL certificates
- ✅ Built-in DDoS protection
- ✅ Free with Cloudflare account

## Prerequisites

1. ✅ Cloudflare account (free tier works)
2. ✅ Domain added to Cloudflare (for custom subdomain)
3. ✅ Backend running on Raspberry Pi 5
4. ✅ Raspberry Pi connected to internet

## Step 1: Install Cloudflared on Raspberry Pi

SSH into your Raspberry Pi and install `cloudflared`:

```bash
# Download cloudflared for ARM64 (Raspberry Pi 5)
# Note: /usr/local/bin requires sudo, so download to home first
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared

# Move to /usr/local/bin with sudo
sudo mv ~/cloudflared /usr/local/bin/cloudflared

# Make it executable
sudo chmod +x /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

**Alternative (all in one command):**

```bash
# Download and install with sudo in one step
sudo curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared && cloudflared --version
```

## Step 2: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser or provides link)
cloudflared tunnel login
```

This will:

1. Open your browser or provide a URL
2. Log in to your Cloudflare account
3. Authorize cloudflared to manage tunnels
4. Save credentials to `~/.cloudflared/cert.pem`

## Step 3: Create a Tunnel

```bash
# Create a new tunnel named "netinsight-backend"
cloudflared tunnel create netinsight-backend
```

This creates a tunnel and saves its UUID. You'll see output like:

```
Tunnel credentials written to /home/pi/.cloudflared/<uuid>.json
```

## Step 4: Create DNS Route (Recommended)

For a custom subdomain (e.g., `net-backend.andernet.dev` or `api.andernet.dev`):

```bash
# Route DNS for your subdomain to the tunnel
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

**Or** if you want to use a Cloudflare-provided hostname instead:

```bash
# Get a random hostname (no DNS setup needed)
cloudflared tunnel route ip add netinsight-backend 127.0.0.1:8000
```

For a Cloudflare-provided hostname, skip to Step 6.

## Step 5: Configure Tunnel

Create configuration file:

```bash
# Create config directory
mkdir -p ~/.cloudflared

# Create/edit config file
nano ~/.cloudflared/config.yml
```

Add the following configuration:

```yaml
tunnel: <tunnel-id-or-name>
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  # Route traffic to your backend API
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  # Catch-all rule (must be last)
  - service: http_status:404
```

**Important Notes:**

- Replace `<tunnel-id-or-name>` with `netinsight-backend` (the tunnel name) or the UUID
- Replace `<tunnel-id>` in credentials-file path with the actual UUID from Step 3
- Replace `net-backend.andernet.dev` with your desired subdomain
- The catch-all rule (`http_status:404`) must be last

**Example with actual values:**

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  - service: http_status:404
```

## Step 6: Test the Tunnel

Run the tunnel manually to test:

```bash
# Run tunnel (foreground mode for testing)
cloudflared tunnel run netinsight-backend
```

You should see:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://<your-hostname>.trycloudflare.com                                                |
+--------------------------------------------------------------------------------------------+
```

Or if using custom domain:

```
2024-01-01T12:00:00Z INF Starting metrics server
2024-01-01T12:00:00Z INF +--------------------------------------------------------------------------------------------+
2024-01-01T12:00:00Z INF |  Your tunnel is now running! Visit it at:                         |
2024-01-01T12:00:00Z INF |  https://net-backend.andernet.dev                                     |
2024-01-01T12:00:00Z INF +--------------------------------------------------------------------------------------------+
```

**Test the connection:**

```bash
# From another machine, test the tunnel
curl https://net-backend.andernet.dev/api/health
# Or if using Cloudflare hostname:
curl https://<your-hostname>.trycloudflare.com/api/health
```

You should get a JSON response with health status.

## Step 7: Run Tunnel as a Service (Systemd)

Create a systemd service so the tunnel starts automatically:

```bash
# Install tunnel as a service
sudo cloudflared service install
```

This creates a service that uses the config file at `~/.cloudflared/config.yml`.

**Or create a custom service file:**

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

[Install]
WantedBy=multi-user.target
```

**Enable and start the service:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (starts on boot)
sudo systemctl enable cloudflared

# Start service
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

## Step 8: Update Backend CORS Configuration

Update your backend to allow requests from your frontend domains:

**In `docker-compose.backend-only.yml` or `.env`:**

```env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev,https://net-backend.andernet.dev
```

**Restart backend:**

```bash
docker-compose -f docker-compose.backend-only.yml restart backend
```

## Step 9: Update Frontend Configuration

Set environment variables in Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** > **Pages** > **Your Project**
2. Navigate to **Settings** > **Environment Variables**
3. Add:

**For Production:**

```
VITE_API_BASE_URL = https://net-backend.andernet.dev
VITE_USE_REAL_API = true
```

**Retry deployment** to apply changes.

## Step 10: Verify End-to-End Connection

### Test Backend via Tunnel

```bash
# Health check
curl https://net-backend.andernet.dev/api/health

# Capture status
curl https://net-backend.andernet.dev/api/capture/status
```

### Test from Frontend

1. Open your Cloudflare Pages site: `https://net.andernet.dev`
2. Open browser DevTools > Console
3. Run:

```javascript
fetch('https://net-backend.andernet.dev/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Should return health status without CORS errors.

## Troubleshooting

### Tunnel Won't Start

**Check tunnel status:**

```bash
sudo systemctl status cloudflared
```

**View logs:**

```bash
sudo journalctl -u cloudflared -n 50
```

**Verify config file:**

```bash
cloudflared tunnel validate
```

**Common issues:**

- Wrong tunnel ID in config
- Missing credentials file
- Backend not running on port 8000
- Config file syntax error

### Tunnel Starts But Connection Fails

**Verify backend is accessible locally:**

```bash
curl http://localhost:8000/api/health
```

**Check tunnel routing:**

```bash
# List all tunnels
cloudflared tunnel list

# Check route
cloudflared tunnel route dns list
```

**Verify DNS (for custom domain):**

```bash
dig net-backend.andernet.dev
nslookup net-backend.andernet.dev
```

Should point to Cloudflare IPs.

### CORS Errors

**Check ALLOWED_ORIGINS:**

```bash
docker exec netinsight-backend env | grep ALLOWED_ORIGINS
```

**Update if needed:**

```env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev,https://net-backend.andernet.dev
```

**Restart backend:**

```bash
docker-compose -f docker-compose.backend-only.yml restart backend
```

### SSL Certificate Issues

Cloudflare Tunnel automatically handles SSL certificates. If you see SSL errors:

1. Check DNS is pointing to Cloudflare (proxy enabled - orange cloud)
2. Wait a few minutes for certificate propagation
3. Verify SSL/TLS mode in Cloudflare Dashboard (Full or Full Strict)

## Security Considerations

1. **Access Control**: Consider using Cloudflare Access (Zero Trust) to add authentication
2. **Rate Limiting**: Cloudflare automatically provides DDoS protection
3. **Firewall**: No need to open ports on your router
4. **Credentials**: Keep `~/.cloudflared/cert.pem` and `*.json` files secure
5. **Backend Security**: Ensure your backend has authentication enabled

## Alternative: Quick Tunnel (Temporary)

For quick testing without DNS setup:

```bash
# Creates temporary tunnel (changes on restart)
cloudflared tunnel --url http://localhost:8000
```

This provides a URL like `https://random-words.trycloudflare.com` that you can use temporarily.

## Maintenance

### View Tunnel Info

```bash
# List all tunnels
cloudflared tunnel list

# Get tunnel details
cloudflared tunnel info netinsight-backend

# View tunnel routes
cloudflared tunnel route dns list
```

### Update Tunnel Configuration

1. Edit `~/.cloudflared/config.yml`
2. Validate: `cloudflared tunnel validate`
3. Restart: `sudo systemctl restart cloudflared`

### Delete Tunnel

```bash
# Delete DNS route first
cloudflared tunnel route dns delete net-backend.andernet.dev

# Delete tunnel
cloudflared tunnel delete netinsight-backend

# Stop and remove service
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared
sudo rm /etc/systemd/system/cloudflared.service
```

## Quick Reference

**Tunnel URL**: `https://net-backend.andernet.dev`  
**Backend Local**: `http://localhost:8000`  
**Config File**: `~/.cloudflared/config.yml`  
**Service**: `sudo systemctl status cloudflared`  
**Logs**: `sudo journalctl -u cloudflared -f`

## Next Steps

Once tunnel is working:

1. ✅ Update frontend `VITE_API_BASE_URL` to tunnel URL
2. ✅ Update backend `ALLOWED_ORIGINS` to include frontend domains
3. ✅ Test end-to-end connection
4. ✅ Monitor tunnel logs for issues
5. ✅ Set up monitoring/alerting for tunnel health

## Support

For Cloudflare Tunnel issues:

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Community](https://community.cloudflare.com/)

For NetInsight-specific issues:

- Check backend logs: `docker logs netinsight-backend`
- Check tunnel logs: `sudo journalctl -u cloudflared -f`
- Verify backend is running: `docker ps`
