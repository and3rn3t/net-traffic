# Pre-Installation Configuration Guide

This guide covers all configurations you should set up **before** installing NetInsight on your Raspberry Pi 5.

## 📋 Pre-Installation Checklist

### 1. Hardware Preparation

- [ ] Raspberry Pi 5 (4GB RAM minimum, 8GB recommended)
- [ ] MicroSD Card (32GB+ Class 10 or better, 64GB+ recommended)
- [ ] Power Supply (Official 5V 5A USB-C recommended)
- [ ] Ethernet cable for Port 8 connection
- [ ] Adequate cooling (heatsink/fan recommended for 24/7 operation)

### 2. Raspberry Pi OS Setup

- [ ] Flash Raspberry Pi OS 64-bit (Bookworm or later)
- [ ] Enable SSH during initial setup
- [ ] Set hostname (e.g., `netinsight-pi`)
- [ ] Configure WiFi (if needed for management, separate from monitoring)
- [ ] Set timezone: `sudo timedatectl set-timezone America/New_York` (adjust as needed)
- [ ] Enable NTP sync: `sudo timedatectl set-ntp true`

### 3. System Updates

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 4. Network Configuration

#### Identify Network Interface

```bash
# List all network interfaces
ip link show

# Common interfaces:
# - eth0: Primary Ethernet (for port mirroring)
# - wlan0: WiFi (for management/SSH)
# - eth1: Secondary Ethernet (if using USB adapter)
```

**Important**: Note which interface is connected to Port 8 (monitoring port).

#### Configure Promiscuous Mode (Permanent)

**Option A: Using systemd-networkd (Recommended for Pi OS Bookworm+)**

```bash
# Create network configuration
sudo nano /etc/systemd/network/eth0.network
```

Add:

```ini
[Match]
Name=eth0

[Network]
DHCP=yes

[Link]
Promiscuous=yes
```

Then enable:

```bash
sudo systemctl enable systemd-networkd
sudo systemctl start systemd-networkd
```

**Option B: Using NetworkManager (if installed)**

```bash
# Create connection profile
sudo nmcli connection add type ethernet ifname eth0 con-name "eth0-monitoring" \
    ipv4.method auto ipv4.dhcp-client-id "" connection.autoconnect yes

# Enable promiscuous mode
sudo nmcli connection modify "eth0-monitoring" 802-3-ethernet.auto-negotiate no
sudo ip link set eth0 promisc on

# Make permanent with systemd service
sudo nano /etc/systemd/system/promiscuous-mode.service
```

Add:

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

Enable:

```bash
sudo systemctl enable promiscuous-mode.service
sudo systemctl start promiscuous-mode.service
```

**Option C: Using /etc/network/interfaces (Legacy)**

```bash
sudo nano /etc/network/interfaces.d/eth0
```

Add:

```
auto eth0
iface eth0 inet dhcp
    up ip link set eth0 promisc on
```

### 5. Firewall Configuration

```bash
# Install UFW if not present
sudo apt install -y ufw

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow NetInsight ports
sudo ufw allow 80/tcp    # Frontend
sudo ufw allow 8000/tcp  # Backend API

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Note**: If you're accessing from a specific IP, restrict access:

```bash
sudo ufw allow from YOUR_IP_ADDRESS to any port 22
sudo ufw allow from YOUR_IP_ADDRESS to any port 80
sudo ufw allow from YOUR_IP_ADDRESS to any port 8000
```

### 6. Swap Configuration (Optional but Recommended)

For systems with 4GB RAM or less, increase swap:

```bash
# Check current swap
free -h

# Disable current swap
sudo dphys-swapfile swapoff

# Edit swap file size (if using dphys-swapfile)
sudo nano /etc/dphys-swapfile
# Change: CONF_SWAPSIZE=100
# To: CONF_SWAPSIZE=2048  (2GB swap)

# Recreate swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Or create swap file manually
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 7. Disk Space Management

```bash
# Check disk space
df -h

# Set up log rotation (if not using Docker)
sudo nano /etc/logrotate.d/netinsight
```

Add:

```
/home/pi/net-traffic/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 pi pi
}
```

### 8. Time Synchronization

```bash
# Ensure NTP is enabled
sudo timedatectl set-ntp true

# Check status
timedatectl status

# If issues, install NTP
sudo apt install -y ntp
```

### 9. System Resource Limits

```bash
# Check current limits
ulimit -a

# Edit limits (if needed)
sudo nano /etc/security/limits.conf
```

Add (if needed for high packet rates):

```
pi soft nofile 65536
pi hard nofile 65536
```

### 10. Docker Installation (If Using Docker)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or:
newgrp docker

# Install Docker Compose (if not included)
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 11. Verify Port Mirroring

Before installing NetInsight, verify port mirroring works:

```bash
# Install tcpdump
sudo apt install -y tcpdump

# Test packet capture (should see traffic from Port 9)
sudo tcpdump -i eth0 -c 10 -v

# If you see packets, port mirroring is working! ✅
# If no packets, check UniFi Controller configuration
```

### 12. Network Interface Verification

```bash
# Check interface status
ip link show eth0

# Should show: <BROADCAST,MULTICAST,UP,LOWER_UP> ... promiscuity 1

# Check IP address (may not have one for port mirroring - this is OK)
ip addr show eth0

# Test connectivity (if interface has IP)
ping -c 3 8.8.8.8
```

### 13. System Information to Note

Before installation, note these values:

- **Network Interface**: `eth0` (or your interface name)
- **Pi IP Address**: `hostname -I` (for frontend access)
- **Interface Status**: `ip link show eth0`
- **Port Mirroring**: Verified with tcpdump
- **Disk Space**: `df -h` (ensure 10GB+ free)

## 🚀 Quick Pre-Installation Script

We've created a script to automate most of this. See `scripts/pre-install-setup.sh`.

## ⚠️ Important Notes

1. **SSH Access**: Ensure SSH is enabled and accessible before proceeding
2. **Backup**: Consider backing up your Pi's SD card before major changes
3. **Network Interface**: Port 8 (monitoring) may not get an IP address - this is normal
4. **Management Access**: Use WiFi or another interface for SSH/management
5. **Firewall**: Configure firewall rules before enabling UFW

## ✅ Verification Commands

After completing pre-installation, verify:

```bash
# Network interface
ip link show eth0 | grep PROMISC

# Promiscuous mode enabled
ip link show eth0 | grep -q promisc && echo "✅ Promiscuous mode enabled"

# Port mirroring working
sudo tcpdump -i eth0 -c 1 -n 2>&1 | grep -q "packets captured" && echo "✅ Port mirroring working"

# Docker (if using)
docker --version && echo "✅ Docker installed"

# Disk space
df -h / | awk 'NR==2 {if ($4+0 > 10) print "✅ Sufficient disk space: "$4" free"}'

# Firewall
sudo ufw status | grep -q "Status: active" && echo "✅ Firewall enabled"
```

## Next Steps

After completing pre-installation configuration:

1. Proceed to [Raspberry Pi 5 Quick Start Guide](./RASPBERRY_PI5_QUICK_START.md)
2. Or follow [Full Deployment Guide](./DEPLOYMENT_RASPBERRY_PI.md)
