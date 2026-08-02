# NetInsight Raspberry Pi Scripts

This directory contains scripts for managing NetInsight on Raspberry Pi. The
backend runs natively via a Python venv + systemd (no containers) — see
[docs/DEPLOYMENT_RASPBERRY_PI.md](../docs/DEPLOYMENT_RASPBERRY_PI.md) for the
full install guide.

## Scripts

### `setup-backend-service.sh`

Installs and configures the backend as a systemd service (`netinsight-backend.service`).

**Usage:**

```bash
sudo ./scripts/setup-backend-service.sh
```

### `netinsight-backend.service`

Systemd unit template used by `setup-backend-service.sh`. Runs
`backend/venv/bin/python3 backend/main.py` directly — update `WorkingDirectory`
and paths if your installation location differs.

### `setup-cloudflared-config.sh` / `setup-cloudflared-service.sh`

Configure and install the native `cloudflared` systemd service that exposes the
backend at `net-backend.andernet.dev`. See
[docs/CLOUDFLARE_TUNNEL_SETUP.md](../docs/CLOUDFLARE_TUNNEL_SETUP.md).

### `ensure-env.sh` / `backend-setup.sh`

Create/populate the backend `.env` file with sane defaults if missing.

### `diagnose-backend.sh` / `diagnose-host-backend.sh` / `check-backend-logs.sh`

Diagnostic scripts for a backend running directly on the host — check the
systemd service status, port bindings, and logs.

### `verify-deployment.sh` / `.ps1`

Checks the `netinsight-backend` and `cloudflared` systemd services, backend
health endpoint, tunnel connectivity, DNS, and CORS configuration end-to-end.

### `verify-api-connection.sh` / `.ps1`

Checks connectivity between the Cloudflare Pages frontend and the backend API
(health, capture status, CORS, WebSocket).

### `test-tunnel.sh`

Quick check that the local backend and the public tunnel domain are both responding.

### `db-backup.sh`

Backs up the SQLite database.

### `optimize-pi5.sh`

Applies Raspberry Pi 5 performance tuning (GPU memory split, I/O scheduler,
CPU governor, network buffers, file descriptor limits).

## Troubleshooting

### Scripts not executable

```bash
chmod +x scripts/*.sh
```

### Backend service won't start

```bash
sudo systemctl status netinsight-backend
sudo journalctl -u netinsight-backend --tail 50
```

