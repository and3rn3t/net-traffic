# Deployment Readiness Checklist

This checklist verifies that NetInsight is ready for deployment to Raspberry Pi 5 and packet capture.

## ✅ Pre-Deployment Checklist

### 1. Code Readiness

- [x] All backend services implemented
- [x] Packet capture service with optimizations
- [x] Enhanced identification features
- [x] Database migrations system
- [x] Error handling and logging
- [x] Health check endpoints
- [x] WebSocket support for real-time updates

### 2. Configuration Files

- [ ] `.env.example` file exists in `backend/` directory
- [ ] Environment variables documented
- [ ] Network interface configuration
- [ ] Database path configuration
- [ ] CORS origins configured

### 3. Deployment Scripts

- [x] `scripts/raspberry-pi-start.sh` - Docker startup script
- [x] `scripts/raspberry-pi-update.sh` - Update script
- [x] `scripts/netinsight.service` - Systemd service file
- [x] `scripts/backend-setup.sh` - Python environment setup
- [x] `scripts/db-backup.sh` - Database backup script

### 4. Docker Configuration

- [x] `docker-compose.yml` configured for ARM64
- [x] Backend Dockerfile with Scapy dependencies
- [x] Frontend Dockerfile
- [x] Network configuration
- [x] Volume mounts for data persistence
- [x] Health checks configured

### 5. Documentation

- [x] `DEPLOYMENT_RASPBERRY_PI.md` - Full deployment guide
- [x] `RASPBERRY_PI5_QUICK_START.md` - Quick start guide
- [x] `UNIFI_PORT_MIRRORING_SETUP.md` - Port mirroring setup
- [x] `NETWORK_TOPOLOGY_AND_PLACEMENT.md` - Network topology guide
- [x] `ADVANCED_IDENTIFICATION_CONFIG.md` - Advanced features
- [x] `SCRIPTS_REFERENCE.md` - Scripts documentation

### 6. Packet Capture Readiness

- [x] Scapy integration
- [x] BPF filtering support
- [x] Packet sampling
- [x] IPv6 support
- [x] Enhanced identification (DNS, SNI, DPI)
- [x] Memory limits for Raspberry Pi
- [x] Batch processing for database writes
- [x] Performance optimizations

### 7. Network Configuration

- [x] Network interface detection
- [x] Promiscuous mode support
- [x] Port mirroring documentation
- [x] UniFi setup guide
- [x] Interface validation

### 8. Security

- [x] Capabilities-based permissions (NET_RAW, NET_ADMIN)
- [x] Rate limiting
- [x] CORS configuration
- [x] Input validation
- [x] Error handling without exposing internals

### 9. Performance Optimizations

- [x] SQLite WAL mode
- [x] Database query optimization
- [x] Batch writes
- [x] Memory limits
- [x] Packet processing queue
- [x] Caching strategies

## 🚀 Deployment Steps

### Step 1: Prepare Raspberry Pi 5

1. Install Raspberry Pi OS 64-bit
2. Update system: `sudo apt update && sudo apt upgrade -y`
3. Install Docker (if using Docker deployment)
4. Install Python 3.10+ and dependencies (if using non-Docker)

### Step 2: Network Setup

1. Connect Raspberry Pi to UniFi Switch Port 8
2. Enable promiscuous mode: `sudo ip link set eth0 promisc on`
3. Verify port mirroring in UniFi Controller (Port 9 → Port 8)
4. Test with tcpdump: `sudo tcpdump -i eth0 -c 10`

### Step 3: Deploy Code

1. Clone or copy project to Raspberry Pi
2. Create `.env` file from `.env.example`
3. Configure `NETWORK_INTERFACE=eth0`
4. Set other environment variables as needed

### Step 4: Start Services

**Docker Deployment (Recommended):**

```bash
chmod +x scripts/raspberry-pi-start.sh
./scripts/raspberry-pi-start.sh
```

**Non-Docker Deployment:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
sudo setcap cap_net_raw,cap_net_admin=eip $(readlink -f venv/bin/python3)
python main.py
```

### Step 5: Verify Deployment

1. Check backend health: `curl http://localhost:8000/api/health`
2. Check packet capture status: `curl http://localhost:8000/api/capture/status`
3. Start packet capture: `curl -X POST http://localhost:8000/api/capture/start`
4. Verify packets are being captured
5. Access frontend: `http://<pi-ip-address>`

## ⚠️ Critical Requirements

### Packet Capture Permissions

Packet capture requires elevated privileges. Choose one:

1. **Capabilities (Recommended):**

   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip $(readlink -f venv/bin/python3)
   ```

2. **Docker with capabilities:**

   ```yaml
   cap_add:
     - NET_ADMIN
     - NET_RAW
   ```

3. **Run as root (Not recommended for production):**
   ```bash
   sudo python main.py
   ```

### Network Interface

- Must be configured correctly in `.env`: `NETWORK_INTERFACE=eth0`
- Interface must support promiscuous mode
- Port mirroring must be configured on switch

### Database

- Database directory must be writable
- Sufficient disk space (monitor with `df -h`)
- WAL mode enabled (automatic)

## 🔍 Verification Commands

```bash
# Check backend is running
curl http://localhost:8000/api/health

# Check packet capture status
curl http://localhost:8000/api/capture/status

# Check individual services
curl http://localhost:8000/api/health/storage
curl http://localhost:8000/api/health/capture
curl http://localhost:8000/api/health/analytics

# View logs
docker compose logs -f backend  # Docker
sudo journalctl -u netinsight -f  # Systemd

# Test packet capture
sudo tcpdump -i eth0 -c 10
```

## 📋 Missing Items

### Required Before Deployment

1. **`.env.example` file** - Need to create template with all required variables
2. **Verify packet capture starts automatically** - Check if capture starts on service startup

### Optional Enhancements

1. Automatic promiscuous mode setup script
2. Network interface auto-detection
3. Pre-flight checks script
4. Deployment verification script

## ✅ Ready to Deploy?

If all items above are checked, you're ready to deploy! Follow the deployment steps in order.

## 🆘 Troubleshooting

If deployment fails:

1. Check logs: `docker compose logs` or `sudo journalctl -u netinsight`
2. Verify network interface: `ip link show`
3. Test packet capture permissions: `sudo tcpdump -i eth0 -c 1`
4. Check database permissions: `ls -la netinsight.db`
5. Review configuration: `cat backend/.env`
