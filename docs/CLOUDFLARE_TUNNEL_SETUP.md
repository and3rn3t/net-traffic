# Cloudflare Tunnel Setup Guide

Securely expose the Raspberry Pi backend to the internet (so the Cloudflare Pages frontend, or you remotely, can reach it) without opening any router ports. Cloudflare Tunnel creates an outbound-only connection from the Pi to Cloudflare, with automatic HTTPS and DDoS protection, free on the Cloudflare free tier.

> **Production values for this project**: tunnel name `netinsight-backend`, hostname `net-backend.andernet.dev`, backend on `http://localhost:8000` (systemd).

## Quick start (systemd, ~5 minutes)

```bash
# 1. Install cloudflared (ARM64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared
sudo mv ~/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
cloudflared --version

# 2. Authenticate (run as the `pi` user, NOT with sudo — see gotcha below)
cloudflared tunnel login

# 3. Create the tunnel + DNS route (also run as `pi`, not sudo)
cloudflared tunnel create netinsight-backend
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev

# 4. Configure
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<'EOF'
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  - service: http_status:404
EOF
# Replace <tunnel-uuid> with the UUID printed in step 3

# 5. Test
cloudflared tunnel run netinsight-backend
# In another shell/machine:
curl https://net-backend.andernet.dev/api/health

# 6. Install as a service (see "Run as a service" below), or use the helper script:
sudo ./scripts/setup-cloudflared-service.sh
```

Then update CORS/frontend config (see [Configuration](#configuration-after-setup) below).

## Run as a service (systemd)

```bash
sudo tee /etc/systemd/system/cloudflared.service <<'EOF'
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
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo journalctl -u cloudflared -f
```

Or run the automated equivalent: `sudo ./scripts/setup-cloudflared-service.sh` (also handles the DNS route if missing).

Service management: `sudo systemctl {status,start,stop,restart,disable} cloudflared`, logs via `sudo journalctl -u cloudflared -f` (or `-n 50` for recent only).

## Domain / DNS details

`cloudflared tunnel route dns <tunnel> <hostname>` automatically creates a proxied CNAME (`<hostname> → <tunnel-id>.cfargotunnel.com`) and provisions SSL — no manual DNS record or certificate management needed. Verify with:

```bash
dig net-backend.andernet.dev CNAME
curl -vI https://net-backend.andernet.dev/api/health
```

Don't manually create/edit this CNAME; to remove it: `cloudflared tunnel route dns delete net-backend.andernet.dev`.

> **Frontend custom domain note**: the production frontend domain is `net-traffic.andernet.dev` (Cloudflare Pages custom domain). `net.andernet.dev` was an earlier/stale domain — if you see it referenced anywhere (old `ALLOWED_ORIGINS` entries, older docs), it no longer matches production and can be removed. To add/change the Pages custom domain: **Cloudflare Dashboard > Pages > your project > Custom Domains**, or `./scripts/setup-custom-domain.sh <domain>` with `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` exported.

## Configuration after setup

**Backend CORS** (`.env`):

```env
ALLOWED_ORIGINS=https://net-traffic.andernet.dev,https://net-traffic.pages.dev,http://localhost,http://localhost:80,http://localhost:3000
```

**Frontend** (Cloudflare Dashboard > Pages > your project > Settings > Environment Variables):

```env
VITE_API_BASE_URL=https://net-backend.andernet.dev
VITE_USE_REAL_API=true
```

## Troubleshooting

### "Unable to reach the origin service" in tunnel logs

Tunnel is connected but can't reach the backend:

1. Confirm the backend is actually up: check the systemd service (`sudo systemctl status netinsight-backend`) and `curl http://localhost:8000/api/health`.
2. Check the `service:` value in `~/.cloudflared/config.yml` is `http://localhost:8000`.
3. `cloudflared tunnel validate` then `sudo systemctl restart cloudflared`.

### `Cannot determine default origin certificate path. No file cert.pem in [~/.cloudflared ...]`

Caused by running `cloudflared tunnel login`/`create`/`route` with `sudo` — that changes `~` from `/home/pi` to `/root`, so cloudflared looks in the wrong place. Fix: run these commands as the `pi` user, **without** sudo. If you must run from a root script, use `sudo -u pi cloudflared ...` or set `TUNNEL_ORIGIN_CERT=/home/pi/.cloudflared/cert.pem` explicitly. Always use the same user for `login`/`create`/`route` as the one that will run the service.

### Domain typo'd or not resolving

Double-check `net-backend.andernet.dev` (dot) vs a mistaken `net-backend-andernet.dev` (hyphen). For general DNS propagation issues: `dig <hostname> CNAME`, `nslookup <hostname>` — Cloudflare changes are usually live in under 5 minutes, rarely up to 24h.
