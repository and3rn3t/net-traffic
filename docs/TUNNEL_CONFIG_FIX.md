# Fix: Tunnel Config File Not Found

## Problem

If you see this error in `docker logs netinsight-cloudflared`:

```
open /home/nonroot/.cloudflared/config.yml: no such file or directory
```

This means the config file doesn't exist on your Raspberry Pi host where Docker is trying to mount it.

## Solution

The config file must be created **on your Raspberry Pi host**, not inside Docker. The Docker container mounts `~/.cloudflared` from the host.

### Quick Fix (Automated)

Run the setup script on your Raspberry Pi:

```bash
./scripts/setup-cloudflared-config.sh
```

This script will guide you through creating the config file.

### Manual Fix

**Step 1: Create config directory on host**

```bash
# On Raspberry Pi host (not in Docker)
mkdir -p ~/.cloudflared
```

**Step 2: Get your tunnel UUID**

```bash
cloudflared tunnel list
```

Look for the UUID of your `netinsight-backend` tunnel. It will look like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Step 3: Create config file**

```bash
nano ~/.cloudflared/config.yml
```

Paste this (replace `<tunnel-uuid>` with your actual UUID):

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://backend:8000
  - service: http_status:404
```

**Step 4: Verify files exist**

```bash
# Check config file
ls -la ~/.cloudflared/config.yml

# Check credentials file (replace UUID)
ls -la ~/.cloudflared/<tunnel-uuid>.json

# Both should exist and be readable
```

**Step 5: Validate config**

```bash
cloudflared tunnel validate
```

**Step 6: Restart Docker containers**

```bash
docker-compose -f docker-compose.backend-with-tunnel.yml restart cloudflared
docker logs -f netinsight-cloudflared
```

## Understanding the Mount

The docker-compose file mounts the host directory:

```yaml
volumes:
  - ~/.cloudflared:/home/nonroot/.cloudflared:ro
```

This means:

- **Host path**: `~/.cloudflared` (expands to `/home/pi/.cloudflared`)
- **Container path**: `/home/nonroot/.cloudflared`
- The container reads from the host directory

## File Structure on Host

Your `~/.cloudflared` directory on the Raspberry Pi should contain:

```
/home/pi/.cloudflared/
├── cert.pem                    # Created by: cloudflared tunnel login
├── config.yml                  # You create this
└── <tunnel-uuid>.json         # Created by: cloudflared tunnel create
```

## Troubleshooting

### Config file not found after creation

1. **Check file exists:**

   ```bash
   ls -la ~/.cloudflared/config.yml
   ```

2. **Check permissions:**

   ```bash
   chmod 644 ~/.cloudflared/config.yml
   ```

3. **Verify path in docker-compose:**
   The `~` should expand to `/home/pi` (or your username)

4. **Check mount in container:**
   ```bash
   docker exec netinsight-cloudflared ls -la /home/nonroot/.cloudflared/
   ```

### Credentials file not found

If the credentials file is missing:

1. **List all files:**

   ```bash
   ls -la ~/.cloudflared/
   ```

2. **Verify tunnel UUID:**

   ```bash
   cloudflared tunnel list
   ```

3. **Check if file exists with different name:**
   ```bash
   find ~/.cloudflared -name "*.json"
   ```

### Still not working?

1. **Check Docker Compose volume mount:**

   ```bash
   docker inspect netinsight-cloudflared | grep -A 10 Mounts
   ```

2. **Test mount manually:**

   ```bash
   docker run --rm -v ~/.cloudflared:/test cloudflare/cloudflared:latest ls -la /test
   ```

3. **Use absolute path in docker-compose:**
   Change `~/.cloudflared` to `/home/pi/.cloudflared` in `docker-compose.backend-with-tunnel.yml`

## Verification

After fixing, verify the tunnel works:

```bash
# Check tunnel logs
docker logs netinsight-cloudflared

# Should see: "tunnel is now running" or "INF Your tunnel"

# Test tunnel endpoint
curl https://net-backend.andernet.dev/api/health
```
