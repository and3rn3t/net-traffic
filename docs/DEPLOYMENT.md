# Deployment

NetInsight deploys in two halves (see [ARCHITECTURE.md](./ARCHITECTURE.md) for why):

| Piece | Where | How it ships |
| --- | --- | --- |
| Frontend (React) | Cloudflare Pages project `net-traffic` → `net-traffic.andernet.dev` | GitHub Actions on push to `main` |
| Backend (FastAPI) | Raspberry Pi 5, systemd `netinsight-backend` | `git pull` + service restart on the Pi |
| Public API | Cloudflare Tunnel `netinsight-backend` → `net-backend.andernet.dev` | `cloudflared` systemd service on the Pi |

Pi install (OS prep, venv, systemd unit, capture permissions) is in
[DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md). This page covers the frontend, the
tunnel, and configuration.

## Frontend: Cloudflare Pages

### How CI deploys

`.github/workflows/ci-cd.yml` runs on every push and PR to `main`. On a **push to `main`**,
after unit tests pass, it:

1. Builds `dist/` in GitHub Actions (`npm run build`) with `VITE_API_BASE_URL` and
   `VITE_USE_REAL_API` from **GitHub repository secrets**.
2. Uploads the prebuilt `dist/` with `wrangler pages deploy dist --project-name=net-traffic`.

The Pages project is a **Direct Upload** project (no Git integration), so Cloudflare never
builds anything itself. Consequences:

- `VITE_*` values are baked in at CI build time. **Pages dashboard environment variables
  have no effect** — change the GitHub secrets and re-run the deploy instead.
- PRs don't get preview deployments; only `main` deploys.
- Pushes that only touch `docs/**` or `*.md` skip CI entirely.

### One-time setup

Already done for production; repeat only for a fresh account.

1. **API token** — Cloudflare dashboard → My Profile → API Tokens → Create Custom Token with
   *Account → Cloudflare Pages → Edit*.
2. **GitHub secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | token from step 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | dashboard → account overview sidebar |
   | `VITE_API_BASE_URL` | `https://net-backend.andernet.dev` |
   | `VITE_USE_REAL_API` | `true` |

3. **Create the project** — wrangler deploys to an existing project; it doesn't create one:
   `npx wrangler pages project create net-traffic --production-branch=main`
4. **Custom domain** — Pages → `net-traffic` → Custom domains, or
   `./scripts/setup-custom-domain.sh net-traffic.andernet.dev` with `CLOUDFLARE_ACCOUNT_ID` /
   `CLOUDFLARE_API_TOKEN` exported.

SPA routing comes from `public/_redirects` (copied into `dist/` by Vite).

### Manual deploy

```bash
npx wrangler login
VITE_USE_REAL_API=true VITE_API_BASE_URL=https://net-backend.andernet.dev npm run deploy:cloudflare
npm run verify:deployment   # latest deployment status via the Cloudflare API
```

### Pages troubleshooting

- **`Project not found` (404) from wrangler** — the project doesn't exist in that account
  (step 3), or `CLOUDFLARE_ACCOUNT_ID` is wrong, or the token lacks *Pages → Edit*.
- **Site loads but shows mock data / calls localhost** — the `VITE_*` GitHub secrets were
  missing at build time. Fix the secrets and re-run the workflow.
- **Deep links 404** — check `dist/_redirects` exists after `npm run build`.

## Backend tunnel: Cloudflare Tunnel

`cloudflared` makes an outbound-only connection from the Pi to Cloudflare, so no router ports
are opened, and HTTPS/WSS come for free.

### Setup

Run as the `pi` user — **not** with `sudo` (see troubleshooting below).

```bash
# Install (ARM64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared
sudo install -m 755 ~/cloudflared /usr/local/bin/cloudflared && rm ~/cloudflared

# Authenticate, create the tunnel and its DNS route
cloudflared tunnel login
cloudflared tunnel create netinsight-backend
cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev

# Write ~/.cloudflared/config.yml, then install the systemd service
./scripts/setup-cloudflared-config.sh
sudo ./scripts/setup-cloudflared-service.sh
```

The resulting `~/.cloudflared/config.yml`:

```yaml
tunnel: netinsight-backend
credentials-file: /home/pi/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: net-backend.andernet.dev
    service: http://localhost:8000
  - service: http_status:404
```

`tunnel route dns` creates the proxied CNAME (`→ <tunnel-id>.cfargotunnel.com`) and its
certificate — don't edit that record by hand.

Verify: `curl https://net-backend.andernet.dev/api/health`, or run
`./scripts/verify-deployment.sh` on the Pi. Manage with
`sudo systemctl {status,restart} cloudflared` and `sudo journalctl -u cloudflared -f`.

### Tunnel troubleshooting

- **`Unable to reach the origin service`** — the tunnel is up but the backend isn't:
  `sudo systemctl status netinsight-backend`, `curl http://localhost:8000/api/health`, and
  check `service:` in `config.yml`. Then `cloudflared tunnel validate` and restart.
- **`Cannot determine default origin certificate path`** — `login`/`create`/`route` were run
  with `sudo`, which points `~` at `/root`. Re-run them as `pi`, or use
  `sudo -u pi cloudflared …` / `TUNNEL_ORIGIN_CERT=/home/pi/.cloudflared/cert.pem`.
- **Hostname not resolving** — check for `net-backend-andernet.dev` (hyphen) typos;
  `dig net-backend.andernet.dev CNAME`.

## Configuration

### Frontend (`.env`, see `.env.example`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_USE_REAL_API` | `false` | `false` = built-in mock data (`src/lib/mockData.ts`). |
| `VITE_API_BASE_URL` | `http://localhost:8000` | WebSocket URL is derived from it (`https` → `wss`). |

Locally these come from `.env`; in production from GitHub secrets (above).
`npm run validate:env` checks them.

### Backend (`backend/.env`, see `backend/.env.example`)

Every setting has a default in `backend/utils/config.py`, so the backend starts without a
`.env` — but create one (`npm run ensure-env`) and set at least:

| Variable | Why |
| --- | --- |
| `NETWORK_INTERFACE` | Interface to capture on (default `eth0`; list with `ip link show`). |
| `ALLOWED_ORIGINS` | CORS allow-list, e.g. `https://net-traffic.andernet.dev,https://net-traffic.pages.dev,http://localhost:5001`. |
| `DB_PATH`, `DATA_RETENTION_DAYS` | SQLite location and retention (defaults `netinsight.db`, 30). |
| `DEFAULT_ADMIN_PASSWORD` | Optional. Password for the `admin` user created on first boot; if unset, a random one is generated and printed once in the service log (`journalctl -u netinsight-backend`). |

`backend/.env.example` documents most of the rest (DNS/DPI/fingerprinting toggles, rate
limit, logging, remote capture, slow-query thresholds); `backend/utils/config.py` is the
complete list, including `GEOIP_DB_PATH`, `OUI_DB_PATH`, `WEBHOOK_URL` and
`BANDWIDTH_ALERT_THRESHOLD_MB`. `net.andernet.dev` is a stale domain — drop it from
`ALLOWED_ORIGINS` if you see it.

### CORS / WebSocket problems

- **CORS errors in the browser** — the page's exact origin (scheme included) must be in
  `ALLOWED_ORIGINS`; restart the backend after editing.
- **WebSocket fails** — confirm `VITE_API_BASE_URL` is `https://…` (so the client uses
  `wss://`), and that the tunnel and backend are up. `./scripts/verify-api-connection.sh
  https://net-backend.andernet.dev` checks health, CORS and WebSocket from any machine.
