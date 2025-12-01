# Configuration Summary

Quick reference for all configuration files and settings needed for NetInsight deployment.

## 📁 Configuration Files

### 1. Environment Configuration

- **Location**: `backend/.env` (auto-created if missing)
- **Script**: `scripts/ensure-env.sh` or `npm run ensure-env`
- **Key Settings**:
  - `NETWORK_INTERFACE=eth0` (REQUIRED - your monitoring interface)
  - `HOST=0.0.0.0`
  - `PORT=8000`
  - `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:80`
- **See**: [Environment File Requirements](./ENV_FILE_REQUIREMENTS.md)

### 2. Docker Configuration

- **Location**: `docker-compose.yml` (project root)
- **Key Settings**:
  - Network interface: `${NETWORK_INTERFACE:-eth0}`
  - Ports: `80` (frontend), `8000` (backend)
  - Capabilities: `NET_ADMIN`, `NET_RAW`
- **Note**: `.env` in project root is optional (uses docker-compose defaults)

### 3. Systemd Service (Optional)

- **Location**: `scripts/netinsight.service`
- **Install**: `sudo cp scripts/netinsight.service /etc/systemd/system/`
- **Update**: Edit paths in service file to match your installation
- **Enable**: `sudo systemctl enable netinsight`

### 4. Network Configuration

- **Promiscuous Mode**: Configured via systemd-networkd or systemd service
- **Location**: `/etc/systemd/network/eth0.network` or `/etc/systemd/system/promiscuous-mode.service`
- **Script**: `scripts/pre-install-setup.sh` handles this automatically

### 5. Firewall Configuration

- **Tool**: UFW (Uncomplicated Firewall)
- **Ports**: `22` (SSH), `80` (Frontend), `8000` (Backend)
- **Script**: `scripts/pre-install-setup.sh` configures automatically

## 🔧 Pre-Installation Configuration

### Automated Setup

```bash
# Run pre-installation script (recommended)
bash scripts/pre-install-setup.sh
# or
npm run pre-install
```

### Manual Setup

See [Pre-Installation Configuration Guide](./PRE_INSTALLATION_CONFIG.md) for detailed steps.

### Key Pre-Installation Steps

1. ✅ System updates
2. ✅ Install dependencies (Python, libpcap, tcpdump, etc.)
3. ✅ Configure promiscuous mode (permanent)
4. ✅ Configure firewall (UFW)
5. ✅ Set timezone and NTP
6. ✅ Configure swap (if < 4GB RAM)
7. ✅ Verify port mirroring
8. ✅ Note network interface name

## 📝 Configuration Checklist

### Before Installation

- [ ] Run `scripts/pre-install-setup.sh` or complete manual pre-installation
- [ ] Verify port mirroring: `sudo tcpdump -i eth0 -c 10`
- [ ] Note network interface name (usually `eth0`)
- [ ] Ensure promiscuous mode is enabled: `ip link show eth0 | grep PROMISC`
- [ ] Check firewall allows ports 22, 80, 8000

### During Installation

- [ ] `.env` file will be auto-created (or create manually)
- [ ] Review `NETWORK_INTERFACE` in `.env` (should match your interface)
- [ ] For Docker: `.env` optional (uses docker-compose defaults)
- [ ] For non-Docker: `.env` created automatically in `backend/`

### After Installation

- [ ] Verify backend health: `curl http://localhost:8000/api/health`
- [ ] Check packet capture status: `curl http://localhost:8000/api/capture/status`
- [ ] Verify packets being captured: `curl http://localhost:8000/api/health/capture`
- [ ] Access frontend: `http://<pi-ip-address>`

## 🔍 Verification Commands

```bash
# Network interface
ip link show eth0 | grep PROMISC

# Promiscuous mode
ip link show eth0 | grep -q promisc && echo "✅ Enabled"

# Port mirroring
sudo tcpdump -i eth0 -c 5 -n

# Firewall
sudo ufw status

# Backend health
curl http://localhost:8000/api/health

# Packet capture
curl http://localhost:8000/api/capture/status
```

## 📚 Related Documentation

- [Pre-Installation Configuration](./PRE_INSTALLATION_CONFIG.md) - Complete pre-installation guide
- [Environment File Requirements](./ENV_FILE_REQUIREMENTS.md) - `.env` file details
- [Raspberry Pi 5 Quick Start](./RASPBERRY_PI5_QUICK_START.md) - Quick deployment guide
- [Full Deployment Guide](./DEPLOYMENT_RASPBERRY_PI.md) - Comprehensive deployment
- [UniFi Port Mirroring Setup](./UNIFI_PORT_MIRRORING_SETUP.md) - Network setup

## 🎯 Quick Reference

| Configuration    | Location               | Auto-Created? | Required?    |
| ---------------- | ---------------------- | ------------- | ------------ |
| `.env`           | `backend/.env`         | Yes           | Recommended  |
| Promiscuous Mode | Systemd/Network        | Via script    | Yes          |
| Firewall         | UFW                    | Via script    | Recommended  |
| Docker Config    | `docker-compose.yml`   | No            | Yes (Docker) |
| Systemd Service  | `/etc/systemd/system/` | No            | Optional     |

## 💡 Tips

1. **Network Interface**: Most common is `eth0`, but verify with `ip link show`
2. **Port Mirroring**: Test with `tcpdump` before installing NetInsight
3. **Firewall**: Configure before enabling to avoid locking yourself out
4. **Swap**: Only needed if system has < 4GB RAM
5. **Timezone**: Set correctly for accurate timestamps in logs
