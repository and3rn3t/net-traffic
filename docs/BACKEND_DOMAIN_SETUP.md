# Backend Domain Setup: net-backend.andernet.dev

This guide explains how to set up the custom domain `net-backend.andernet.dev` for your NetInsight backend API via Cloudflare Tunnel.

## Domain Configuration

Your backend will be accessible at: **`https://net-backend.andernet.dev`**

This domain is configured via Cloudflare Tunnel, not direct DNS records. The tunnel automatically handles DNS routing.

## Quick Setup Steps

### 1. Create Cloudflare Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create netinsight-backend

# Create DNS route (this creates the DNS record automatically)
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

The `cloudflared tunnel route dns` command automatically:
- ✅ Creates a CNAME record in Cloudflare DNS
- ✅ Points `net-backend.andernet.dev` to the tunnel
- ✅ Enables proxy (orange cloud)
- ✅ Sets up SSL/TLS certificate

### 2. Configure Tunnel

Edit `~/.cloudflared/config.yml`:

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000  # Or http://backend:8000 for Docker
  - service: http_status:404
```

### 3. Verify DNS Record

After creating the tunnel route, verify the DNS record exists:

```bash
# Check DNS record
dig net-backend.andernet.dev CNAME

# Should show something like:
# net-backend.andernet.dev. 300 IN CNAME <tunnel-id>.cfargotunnel.com
```

**In Cloudflare Dashboard:**
- Go to **DNS** > **Records**
- You should see a CNAME record:
  - **Name**: `net-backend`
  - **Target**: `<tunnel-id>.cfargotunnel.com`
  - **Proxy status**: Proxied (orange cloud) ✅

### 4. Test Domain

```bash
# Test health endpoint
curl https://net-backend.andernet.dev/api/health

# Should return JSON with backend status
```

## DNS Record Details

The tunnel route command creates:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `net-backend` | `<tunnel-id>.cfargotunnel.com` | ✅ Proxied |

**Important Notes:**
- The record is automatically managed by Cloudflare Tunnel
- Don't manually create or delete this DNS record
- To remove: `cloudflared tunnel route dns delete net-backend.andernet.dev`

## SSL/TLS Certificate

Cloudflare automatically provisions SSL certificates:
- ✅ Automatic HTTPS
- ✅ Valid certificate (usually ready in 1-5 minutes)
- ✅ Auto-renewal
- ✅ No manual certificate management needed

Check SSL:
```bash
curl -vI https://net-backend.andernet.dev/api/health
```

## Complete Configuration Summary

### Backend Configuration

**CORS (`docker-compose.yml` or `.env`):**
```env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev,https://net-backend.andernet.dev,http://localhost,http://localhost:80,http://localhost:3000
```

### Frontend Configuration

**Cloudflare Pages Environment Variables:**
```
VITE_API_BASE_URL=https://net-backend.andernet.dev
VITE_USE_REAL_API=true
```

### Tunnel Configuration

**`~/.cloudflared/config.yml`:**
```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000  # Adjust for your setup
  - service: http_status:404
```

## Troubleshooting

### DNS Not Resolving

**Check DNS record exists:**
```bash
dig net-backend.andernet.dev CNAME
cloudflared tunnel route dns list
```

**Recreate route:**
```bash
# Delete existing route
cloudflared tunnel route dns delete net-backend.andernet.dev

# Create again
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
```

### SSL Certificate Not Ready

Wait 1-5 minutes after creating the DNS route. Cloudflare needs time to provision the certificate.

Check certificate:
```bash
openssl s_client -connect net-backend.andernet.dev:443 -servername net-backend.andernet.dev < /dev/null
```

### CORS Errors

Ensure `ALLOWED_ORIGINS` includes all domains:
- Frontend: `https://net.andernet.dev`
- Pages: `https://net-traffic.pages.dev`
- Backend: `https://net-backend.andernet.dev`

## Domain Architecture

```
net.andernet.dev (Frontend - Cloudflare Pages)
     │
     └───> net-backend.andernet.dev (Backend - Cloudflare Tunnel)
                     │
                     └───> Raspberry Pi:8000 (Backend API)
```

## Related Documentation

- [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) - Complete tunnel setup
- [DOCKER_CLOUDFLARE_TUNNEL_SETUP.md](./DOCKER_CLOUDFLARE_TUNNEL_SETUP.md) - Docker-specific setup
- [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md) - Frontend domain setup

