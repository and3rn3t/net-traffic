# Raspberry Pi 5 Deployment Guide

Complete guide for running the NetInsight backend on a Raspberry Pi 5: pre-install setup, Docker (recommended) and manual installs, systemd, network configuration, and performance tuning.

> For architecture/topology background (why the backend lives on the Pi at all), see [ARCHITECTURE.md](./ARCHITECTURE.md) and [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md).

## Hardware & software requirements

- **Raspberry Pi 5** (4GB RAM minimum, 8GB recommended)
- **MicroSD Card** (32GB minimum, Class 10+; 64GB recommended)
- **Power Supply** (official 5V 5A USB-C)
- **Ethernet connection** to the port/interface you intend to capture from
- Adequate cooling (heatsink/fan) for 24/7 operation
- Raspberry Pi OS 64-bit (Bookworm or later)
- Python 3.10+ (only needed for the non-Docker install path)

## 1. Pre-installation setup

Run once, before installing NetInsight itself.

### Automated (recommended)

```bash
cd /path/to/net-traffic
bash scripts/pre-install-setup.sh
```

This updates packages, installs dependencies, configures promiscuous mode, sets up the firewall, configures swap if needed, tests port mirroring, and prints a system summary.

### Manual steps (if you don't use the script)

```bash
# System update
sudo apt update && sudo apt upgrade -y && sudo reboot

# Timezone + NTP
sudo timedatectl set-timezone America/New_York   # adjust to your timezone
sudo timedatectl set-ntp true

# Identify your capture interface
ip link show
```

**Promiscuous mode** (needed for packet capture on the chosen interface — replace `eth0`):

```bash
sudo ip link set eth0 promisc on
```

Make it permanent with a systemd unit:

```bash
sudo tee /etc/systemd/system/promiscuous-mode.service <<'EOF'
[Unit]
Description=Enable Promiscuous Mode on eth0
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/ip link set eth0 promisc on
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now promiscuous-mode.service
```

**Firewall** (UFW):

```bash
sudo apt install -y ufw
sudo ufw allow 22/tcp       # SSH — do this first!
sudo ufw allow 80/tcp       # Frontend (if serving locally)
sudo ufw allow 8000/tcp     # Backend API
sudo ufw enable
```

**Swap** (recommended if RAM ≤ 4GB):

```bash
free -h   # check current swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Verify port mirroring/capture is actually receiving traffic:**

```bash
sudo apt install -y tcpdump
sudo tcpdump -i eth0 -c 10 -v
```

> ⚠️ **Known issue on UniFi UDM Pro**: switch-based port mirroring does not work on this router (DSA tagging isn't applied to `tc`-injected frames from a non-DSA NIC — a driver/hardware limitation, not a config issue). If you're on the same hardware, skip local port-mirror capture entirely and use the `remote_ssh` capture mode instead — see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md).

## 2. Install NetInsight — Docker (recommended)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
newgrp docker

# Get the code
cd ~ && git clone <your-repo-url> net-traffic && cd net-traffic

# Make scripts executable
chmod +x scripts/raspberry-pi-start.sh scripts/raspberry-pi-update.sh

# Optional: custom config
cp .env.example .env && nano .env

# Start (builds ARM64 images, pulls latest bases, starts containers)
./scripts/raspberry-pi-start.sh
```

First build takes 5-10 minutes; subsequent starts take ~30 seconds. Once running:

- Frontend: `http://<pi-ip>` (port 80)
- Backend API: `http://<pi-ip>:8000`
- API docs (Swagger UI): `http://<pi-ip>:8000/docs`

Find the Pi's IP with `hostname -I`.

### Container management

```bash
docker compose ps
docker compose logs -f [backend|frontend]
docker compose down
docker compose restart
docker compose up -d --build
```

### Updating

```bash
./scripts/raspberry-pi-update.sh   # pulls latest code + rebuilds + restarts
```

For pulling pre-built images from a registry instead of building on the Pi, see [REGISTRY_DEPLOYMENT_GUIDE.md](./REGISTRY_DEPLOYMENT_GUIDE.md).

## 3. Install NetInsight — manual (non-Docker)

```bash
# System deps
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y libpcap-dev tcpdump wireshark-common
sudo apt install -y build-essential libssl-dev libffi-dev

# App directory + code
mkdir -p ~/netinsight-backend && cd ~/netinsight-backend
git clone <your-repo-url> .

# Virtual env
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt   # scapy compiles extensions — may take a few minutes

# Configure
cp .env.example .env
nano .env   # set NETWORK_INTERFACE, HOST, PORT, ALLOWED_ORIGINS, DB_PATH, etc.
```

**Grant packet-capture permissions** (don't run as root in production):

```bash
sudo apt install -y libcap2-bin
sudo setcap cap_net_raw,cap_net_admin=eip "$(readlink -f venv/bin/python3)"
getcap venv/bin/python3
```

**Test it:**

```bash
source venv/bin/activate
python main.py
curl http://localhost:8000/api/health
```

### Run as a systemd service (non-Docker)

```bash
sudo tee /etc/systemd/system/netinsight-backend.service <<'EOF'
[Unit]
Description=NetInsight Backend API
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/netinsight-backend/backend
Environment="PATH=/home/pi/netinsight-backend/backend/venv/bin"
ExecStart=/home/pi/netinsight-backend/backend/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now netinsight-backend
sudo journalctl -u netinsight-backend -f
```

### Automatic startup on boot (Docker path)

```bash
sudo cp scripts/netinsight.service /etc/systemd/system/
sudo nano /etc/systemd/system/netinsight.service   # fix WorkingDirectory/paths
sudo systemctl daemon-reload
sudo systemctl enable --now netinsight
sudo journalctl -u netinsight -f
```

## 4. Network configuration

```bash
ip link show
# eth0: primary Ethernet, wlan0: WiFi, eth1: secondary/USB adapter
```

Capture options, in order of preference for a home setup:
1. **Port mirroring/SPAN** on a managed switch (doesn't work on UniFi UDM Pro — see warning above)
2. **Remote SSH capture** (`capture_mode=remote_ssh`) — pulls a tcpdump stream from the router over SSH; see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md)
3. **Gateway mode** — run the Pi inline with two NICs
4. **USB-to-Ethernet adapter** for passive monitoring

## 5. Performance tuning

### System-level (one-time, requires root)

```bash
sudo bash scripts/optimize-pi5.sh
```

Applies: 16MB GPU memory split (headless), `mq-deadline` I/O scheduler, `performance` CPU governor, larger network buffers for high packet rates, file descriptor limit raised to 65536, and Docker daemon concurrency tuning.

### Docker build/runtime

- **BuildKit cache mounts** for pip/npm/Vite cache cut rebuild time ~70-80% when only code changes (already wired into `Dockerfile`/`backend/Dockerfile`; enabled automatically by the startup scripts, or manually via `export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1`).
- **Resource limits** in `docker-compose.yml` (`deploy.resources`) — defaults assume a 4GB Pi 5 (backend 2.4GB/3 CPU, frontend 128MB/0.5 CPU); on an 8GB Pi you can raise backend to ~4.8GB/3.5 CPU.
- **tmpfs** for the backend's `/tmp` (256MB) reduces SD card wear and speeds up temp I/O.
- All images/builds target `linux/arm64` explicitly (both `Dockerfile`s and `docker-compose.yml`) to avoid cross-arch mismatches.

Approximate impact (Pi 5, 8GB, your mileage will vary):

| Scenario | Before | After |
|---|---|---|
| First build | 10-12 min | 8-10 min |
| Rebuild (code only) | 8-10 min | 2-3 min |
| Rebuild (deps changed) | 8-10 min | 4-5 min |
| Container startup | 40-50s | 30-40s |
| Idle memory | ~1.2GB | ~900MB |

### Database (SQLite)

WAL mode + tuned pragmas are already the baseline in `backend/services/storage.py` (`synchronous=NORMAL`, ~32MB cache, `temp_store=MEMORY`, 256MB mmap). See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for schema/migration details and the storage-tables gotcha. Flow inserts are batched (50 rows or 5s, whichever first) rather than written one at a time — reduces SD card writes substantially under sustained capture.

## 6. Installation checklist

- [ ] Docker installed & user in `docker` group (`docker --version`, `groups`)
- [ ] `.env` created from `.env.example` (values reviewed, not just copied)
- [ ] Scripts executable (`chmod +x scripts/*.sh`)
- [ ] `./scripts/raspberry-pi-start.sh` completes, `docker compose ps` shows both containers `Up`
- [ ] `curl http://localhost:8000/api/health` returns healthy
- [ ] Frontend loads at `http://<pi-ip>` with no console errors
- [ ] Systemd service enabled for boot persistence (`sudo systemctl status netinsight`)
- [ ] Firewall allows only the ports/IPs you intend (22, 80, 8000)
- [ ] Default Pi password changed / SSH key auth configured
- [ ] `DATA_RETENTION_DAYS` and resource limits reviewed for your Pi's RAM (see [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md))

## Troubleshooting

- **Containers won't start**: `sudo systemctl status docker`, `df -h`, `docker compose logs`.
- **Can't reach frontend/backend**: confirm containers are `Up`, check `sudo netstat -tulpn | grep -E ':(80|8000)'`, check `sudo ufw status`.
- **Images not updating**: `docker compose build --pull --no-cache && docker compose up -d`.
- **Permission denied on docker commands**: `sudo usermod -aG docker $USER && newgrp docker`.
- **OOM on a 4GB Pi**: lower `memory:` limits in `docker-compose.yml` and/or the tmpfs `size:`, and confirm swap is configured (`swapon --show`).
- For backend-specific issues (service crashes, CORS, etc.) see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
