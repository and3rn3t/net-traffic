# Scripts

Helper scripts for local development and for running the backend on the Raspberry Pi.
The backend runs natively (Python venv + systemd, no containers) — see
[docs/DEPLOYMENT_RASPBERRY_PI.md](../docs/DEPLOYMENT_RASPBERRY_PI.md) for the full install
and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for Pages + tunnel.

Run from the repo root. If a shell script isn't executable: `chmod +x scripts/*.sh`.

## Raspberry Pi: install & setup

| Script | npm | What it does |
| --- | --- | --- |
| `pre-install-setup.sh` | `pre-install` | One-time OS prep before installing NetInsight (packages, Python, capture prerequisites). |
| `optimize-pi5.sh` | — | Pi 5 tuning: GPU memory split, I/O scheduler, CPU governor, network buffers, fd limits. |
| `backend-setup.sh` | `backend:setup` | Creates `backend/venv`, installs requirements, creates `backend/.env` if missing. |
| `ensure-env.sh` | `ensure-env` | Creates `backend/.env` with defaults if it doesn't exist. Review `NETWORK_INTERFACE` afterwards. |
| `setup-backend-service.sh` | — | `sudo` — installs `netinsight-backend.service` (systemd unit template in this folder). |
| `setup-cloudflared-config.sh` | — | Writes `~/.cloudflared/config.yml` for the `netinsight-backend` tunnel. |
| `setup-cloudflared-service.sh` | — | `sudo` — installs the `cloudflared` systemd service and the DNS route if missing. |
| `update-geoip-db.sh` | — | Refreshes the GeoIP City database (MaxMind GeoLite2 if `MAXMIND_LICENSE_KEY` is set, else DB-IP Lite). Re-run monthly. |
| `update-oui-db.sh` | — | Refreshes Wireshark's `manuf` MAC-vendor database for offline device vendor lookup. Re-run occasionally. |

`netinsight-backend.service` runs `backend/venv/bin/python3 backend/main.py` as `pi` with
`CAP_NET_RAW`/`CAP_NET_ADMIN` ambient capabilities — edit paths if your checkout isn't at
`/home/pi/net-traffic`.

## Raspberry Pi: operate & diagnose

| Script | npm | What it does |
| --- | --- | --- |
| `diagnose-backend.sh` | — | 12-step check: venv, deps, `.env`, systemd status, port 8000, interface, capture permissions, manual start. |
| `verify-deployment.sh` | — | On the Pi: `netinsight-backend` + `cloudflared` services, local health, tunnel, DNS, CORS. |
| `db-backup.sh` | `db:backup` | Backs up the SQLite database. |

Logs: `sudo journalctl -u netinsight-backend -f` (the service logs to journald, not a file).

## Cloudflare / remote checks

| Script | npm | What it does |
| --- | --- | --- |
| `verify-api-connection.sh [backend-url]` | — | From anywhere: health, capture status, main endpoints, CORS and WebSocket against the public backend. |
| `verify-cloudflare-deployment.sh` | `verify:deployment` | Queries the Cloudflare API for the latest `net-traffic` Pages deployment status. |
| `setup-custom-domain.sh <domain>` | `setup:custom-domain` | Attaches a custom domain to the Pages project (needs `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`). |

The Pages deploy itself is `npm run deploy:cloudflare` (build + `wrangler pages deploy`); CI
does the same on every push to `main`.

## Local development (Node)

| Script | npm | What it does |
| --- | --- | --- |
| `validate-env.js` | `validate:env` | Checks frontend `.env` values (`VITE_USE_REAL_API`, `VITE_API_BASE_URL`). |
| `health-check.js` | `health-check` | Checks the frontend dev server and the backend (`VITE_API_BASE_URL`, default `http://localhost:8000`). |
| `check-deps.js` | `check-deps`, `check-deps:python` | Reports outdated npm (or Python) dependencies. |
| `analyze-bundle.js` | `analyze-bundle` | Summarises `dist/` chunk sizes after `npm run build`. |
| `clean.js` | `clean`, `clean:all` | Removes build/test output (`--all` also removes `node_modules` and Python caches). |
| `pre-commit.js` | `pre-commit` | Runs type-check, lint and format check — the same gate as `npm run validate`. |
