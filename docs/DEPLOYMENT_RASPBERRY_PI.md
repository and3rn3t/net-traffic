# Raspberry Pi 5 Deployment Guide

Complete guide for running the NetInsight backend on a Raspberry Pi 5: pre-install setup, install, systemd, network configuration, and performance tuning.

> For architecture/topology background (why the backend lives on the Pi at all), see [ARCHITECTURE.md](./ARCHITECTURE.md) and [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md).

## Hardware & software requirements

- **Raspberry Pi 5** (4GB RAM minimum, 8GB recommended)
- **MicroSD Card** (32GB minimum, Class 10+; 64GB recommended)
- **Power Supply** (official 5V 5A USB-C)
- **Ethernet connection** to the port/interface you intend to capture from
- Adequate cooling (heatsink/fan) for 24/7 operation
- Raspberry Pi OS 64-bit (Bookworm or later)
- Python 3.10+

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

## 2. Install NetInsight

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

### Run as a systemd service

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

## 3. Network configuration

```bash
ip link show
# eth0: primary Ethernet, wlan0: WiFi, eth1: secondary/USB adapter
```

Capture options, in order of preference for a home setup:
1. **Port mirroring/SPAN** on a managed switch (doesn't work on UniFi UDM Pro — see warning above)
2. **Remote SSH capture** (`capture_mode=remote_ssh`) — pulls a tcpdump stream from the router over SSH; see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md)
3. **Gateway mode** — run the Pi inline with two NICs
4. **USB-to-Ethernet adapter** for passive monitoring

## 4. Performance tuning

### System-level (one-time, requires root)

```bash
sudo bash scripts/optimize-pi5.sh
```

Applies: 16MB GPU memory split (headless), `mq-deadline` I/O scheduler, `performance` CPU governor, larger network buffers for high packet rates, and file descriptor limit raised to 65536.

### Database (SQLite)

WAL mode + tuned pragmas are already the baseline in `backend/services/storage.py` (`synchronous=NORMAL`, ~32MB cache, `temp_store=MEMORY`, 256MB mmap). See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for schema/migration details and the storage-tables gotcha. Flow inserts are batched (50 rows or 5s, whichever first) rather than written one at a time — reduces SD card writes substantially under sustained capture.

## 5. Installation checklist

- [ ] `.env` created from `.env.example` (values reviewed, not just copied)
- [ ] Scripts executable (`chmod +x scripts/*.sh`)
- [ ] Backend venv created, deps installed, `setcap` applied for packet capture
- [ ] `curl http://localhost:8000/api/health` returns healthy
- [ ] Systemd service enabled for boot persistence (`sudo systemctl status netinsight-backend`)
- [ ] Firewall allows only the ports/IPs you intend (22, 8000)
- [ ] Default Pi password changed / SSH key auth configured
- [ ] `DATA_RETENTION_DAYS` reviewed for your Pi's RAM (see [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md))

## Troubleshooting

- **Backend won't start**: `sudo systemctl status netinsight-backend`, `sudo journalctl -u netinsight-backend --tail 50`.
- **Can't reach backend**: confirm the service is `active`, check `sudo netstat -tulpn | grep :8000`, check `sudo ufw status`.
- **OOM on a 4GB Pi**: confirm swap is configured (`swapon --show`) and check `DATA_RETENTION_DAYS`.
- For backend-specific issues (service crashes, CORS, etc.) see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
