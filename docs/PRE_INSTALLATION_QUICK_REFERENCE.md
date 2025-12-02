# Pre-Installation Quick Reference - Raspberry Pi 5

**Before installing NetInsight, complete these steps!**

## 🚀 Quick Option: Automated Script

Run the automated pre-installation script:

```bash
cd /path/to/net-traffic
bash scripts/pre-install-setup.sh
```

This script will:
- ✅ Update system packages
- ✅ Install required dependencies
- ✅ Configure promiscuous mode
- ✅ Set up firewall
- ✅ Configure swap (if needed)
- ✅ Test port mirroring
- ✅ Display system information

## 📋 Manual Checklist

If you prefer manual setup, complete these in order:

### 1. Hardware ✓
- [ ] Raspberry Pi 5 (4GB+ RAM)
- [ ] MicroSD Card (32GB+)
- [ ] Power Supply (5V 5A USB-C)
- [ ] Ethernet cable connected to UniFi Switch Port 8
- [ ] Cooling solution (heatsink/fan)

### 2. OS Setup ✓
- [ ] Raspberry Pi OS 64-bit installed
- [ ] SSH enabled
- [ ] Hostname set (e.g., `netinsight-pi`)

### 3. System Updates ✓
```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 4. Time Synchronization ✓
```bash
sudo timedatectl set-timezone America/New_York  # Adjust to your timezone
sudo timedatectl set-ntp true
```

### 5. Network Interface Setup ✓
```bash
# Identify interface
ip link show

# Enable promiscuous mode (replace eth0 with your interface)
sudo ip link set eth0 promisc on

# Make permanent (using systemd)
sudo nano /etc/systemd/system/promiscuous-mode.service
```

Add this content:
```ini
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
```

Then enable:
```bash
sudo systemctl enable promiscuous-mode.service
sudo systemctl start promiscuous-mode.service
```

### 6. Firewall Configuration ✓
```bash
sudo apt install -y ufw

# IMPORTANT: Allow SSH first!
sudo ufw allow 22/tcp

# Allow NetInsight ports
sudo ufw allow 80/tcp    # Frontend
sudo ufw allow 8000/tcp  # Backend

# Enable firewall
echo "y" | sudo ufw enable
```

### 7. Verify Port Mirroring ✓
```bash
# Install tcpdump
sudo apt install -y tcpdump

# Test packet capture (should see packets from Port 9)
sudo tcpdump -i eth0 -c 10 -v
```

If you see packets → ✅ Port mirroring is working!
If no packets → ⚠️ Check UniFi Controller port mirroring configuration

### 8. Docker Installation (If Using Docker) ✓
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

### 9. Swap Configuration (If < 4GB RAM) ✓
```bash
# Check memory
free -h

# If < 4GB RAM, increase swap to 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## ✅ Final Verification

Run these commands to verify everything is ready:

```bash
# Promiscuous mode enabled
ip link show eth0 | grep PROMISC

# Port mirroring working
sudo tcpdump -i eth0 -c 1 -n 2>&1 | grep -q "packets captured" && echo "✅ Port mirroring working"

# Docker installed (if using Docker)
docker --version && echo "✅ Docker installed"

# Disk space (need 10GB+ free)
df -h / | awk 'NR==2 {if ($4+0 > 10) print "✅ Sufficient disk space: "$4" free"}'

# Firewall enabled
sudo ufw status | grep -q "Status: active" && echo "✅ Firewall enabled"
```

## 🎯 Critical Items Summary

**MUST DO before installation:**

1. ✅ **System updated** (`sudo apt update && sudo apt upgrade -y`)
2. ✅ **Promiscuous mode enabled** (required for packet capture)
3. ✅ **Port mirroring verified** (test with tcpdump)
4. ✅ **Firewall configured** (allow SSH first!)
5. ✅ **Network interface identified** (usually `eth0`)
6. ✅ **Docker installed** (if using Docker deployment)

## 📝 Note These Values

Before installation, note:
- **Network Interface**: `eth0` (or your interface name)
- **Pi IP Address**: `hostname -I`
- **Port Mirroring Status**: Working / Not Working

## 🚦 Ready to Install?

After completing all checklist items:

1. ✅ Run the verification commands above
2. ✅ Proceed to [Raspberry Pi 5 Quick Start Guide](./RASPBERRY_PI5_QUICK_START.md)
3. ✅ Or use the startup script: `./scripts/raspberry-pi-start.sh`

## 📚 Full Documentation

- **Detailed Guide**: [PRE_INSTALLATION_CONFIG.md](./PRE_INSTALLATION_CONFIG.md)
- **Quick Start**: [RASPBERRY_PI5_QUICK_START.md](./RASPBERRY_PI5_QUICK_START.md)
- **Checklist**: [RASPBERRY_PI5_CHECKLIST.md](./RASPBERRY_PI5_CHECKLIST.md)

---

**⚠️ Important Reminders:**
- Always allow SSH (port 22) in firewall BEFORE enabling it
- Port 8 may not get an IP address (this is normal for port mirroring)
- Use WiFi or another interface for SSH/management if needed
- Back up your SD card before major changes

