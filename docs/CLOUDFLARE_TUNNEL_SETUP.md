# Cloudflare Tunnel Setup Guide

Securely expose the Raspberry Pi backend to the internet (so the Cloudflare Pages frontend, or you remotely, can reach it) without opening any router ports. Cloudflare Tunnel creates an outbound-only connection from the Pi to Cloudflare, with automatic HTTPS and DDoS protection, free on the Cloudflare free tier.

> **Production values for this project**: tunnel name `netinsight-backend`, hostname `net-backend.andernet.dev`, backend on `http://localhost:8000` (systemd) or `http://backend:8000` (Docker).

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

## Docker variant

Two deployment shapes:

- **Backend only** (`docker-compose.backend-only.yml`) — no tunnel, run cloudflared on the host.
- **Backend + tunnel** (`docker-compose.backend-with-tunnel.yml`) — cloudflared runs as its own container.

### Option A: cloudflared in Docker (recommended for a fully-Dockerized Pi)

```bash
# On the Pi HOST (not inside a container) — auth + tunnel creation need ~/.cloudflared/cert.pem
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared
sudo mv ~/cloudflared /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared
cloudflared tunnel login                      # as `pi`, not sudo
cloudflared tunnel create netinsight-backend  # as `pi`, not sudo
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev

mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Config (note `backend:8000`, the Docker **service name**, not `localhost`):

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://backend:8000
  - service: http_status:404
```

```bash
docker-compose -f docker-compose.backend-with-tunnel.yml up -d
docker-compose -f docker-compose.backend-with-tunnel.yml logs -f cloudflared
curl https://net-backend.andernet.dev/api/health
```

Or use the helper script that automates steps above: `./scripts/setup-cloudflared-config.sh`.

### Option B: cloudflared on host, backend in Docker

```bash
docker-compose -f docker-compose.backend-only.yml up -d
```

Same setup as Option A, but use `service: http://localhost:8000` in the config, then run cloudflared as a systemd service (below) instead of a container.

## Run as a service (systemd, non-Docker cloudflared)

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

Service management: `sudo systemctl {status,start,stop,restart,disable} cloudflared`, logs via `sudo journalctl -u cloudflared -f` (or `-n 50` for recent only). If cloudflared runs in Docker instead, none of this systemd unit is needed — Compose manages its lifecycle.

## Domain / DNS details

`cloudflared tunnel route dns <tunnel> <hostname>` automatically creates a proxied CNAME (`<hostname> → <tunnel-id>.cfargotunnel.com`) and provisions SSL — no manual DNS record or certificate management needed. Verify with:

```bash
dig net-backend.andernet.dev CNAME
curl -vI https://net-backend.andernet.dev/api/health
```

Don't manually create/edit this CNAME; to remove it: `cloudflared tunnel route dns delete net-backend.andernet.dev`.

> **Frontend custom domain note**: the production frontend domain is `net-traffic.andernet.dev` (Cloudflare Pages custom domain). `net.andernet.dev` was an earlier/stale domain — if you see it referenced anywhere (old `ALLOWED_ORIGINS` entries, older docs), it no longer matches production and can be removed. To add/change the Pages custom domain: **Cloudflare Dashboard > Pages > your project > Custom Domains**, or `./scripts/setup-custom-domain.sh <domain>` with `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` exported.

## Configuration after setup

**Backend CORS** (`.env` or `docker-compose.yml`):

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

1. Confirm the backend is actually up: `docker ps | grep netinsight-backend` (or check the systemd service) and `curl http://localhost:8000/api/health`.
2. Check the `service:` value in `~/.cloudflared/config.yml` matches how cloudflared is running:
   - systemd (host) cloudflared → `http://localhost:8000`
   - Docker cloudflared container → `http://backend:8000` (Docker service name; `localhost` won't resolve to another container)
3. If backend runs in Docker, confirm port 8000 is actually published: `ports: ["8000:8000"]` in the compose file.
4. `cloudflared tunnel validate` then `sudo systemctl restart cloudflared` (or `docker compose restart cloudflared`).

### `open .../.cloudflared/config.yml: no such file or directory` (Docker)

The config must exist **on the Pi host** — the container only mounts `~/.cloudflared` (host) → `/home/nonroot/.cloudflared` (container) read-only. Create it on the host (`mkdir -p ~/.cloudflared && nano ~/.cloudflared/config.yml`, see Option A above), verify both `config.yml` and `<uuid>.json` exist and are readable, then restart the `cloudflared` container. Or run `./scripts/setup-cloudflared-config.sh` to do this interactively.

### `Cannot determine default origin certificate path. No file cert.pem in [~/.cloudflared ...]`

Caused by running `cloudflared tunnel login`/`create`/`route` with `sudo` — that changes `~` from `/home/pi` to `/root`, so cloudflared looks in the wrong place. Fix: run these commands as the `pi` user, **without** sudo. If you must run from a root script, use `sudo -u pi cloudflared ...` or set `TUNNEL_ORIGIN_CERT=/home/pi/.cloudflared/cert.pem` explicitly. Always use the same user for `login`/`create`/`route` as the one that will run the service.

### Domain typo'd or not resolving

Double-check `net-backend.andernet.dev` (dot) vs a mistaken `net-backend-andernet.dev` (hyphen). For general DNS propagation issues: `dig <hostname> CNAME`, `nslookup <hostname>` — Cloudflare changes are usually live in under 5 minutes, rarely up to 24h.
