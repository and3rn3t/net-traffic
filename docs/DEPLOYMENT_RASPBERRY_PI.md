# Raspberry Pi 5 Deployment Guide

This guide walks you through setting up the NetInsight backend on a Raspberry Pi 5 to capture and analyze network traffic.

> **🚀 Quick Start**: For a faster setup, see the [Raspberry Pi 5 Quick Start Guide](./RASPBERRY_PI5_QUICK_START.md)
>
> **✅ Checklist**: Use the [Installation Checklist](./RASPBERRY_PI5_CHECKLIST.md) to verify all components are in place

## Prerequisites

### Hardware Requirements

- **Raspberry Pi 5** (recommended: 4GB RAM or more)
- **MicroSD Card** (32GB minimum, Class 10 or better)
- **Power Supply** (5V 5A USB-C)
- **Network Connection** (Ethernet cable recommended)
- **Optional**: USB-to-Ethernet adapter for passive monitoring

### Software Requirements

- Raspberry Pi OS (64-bit recommended) - [Download](https://www.raspberrypi.com/software/)
- Python 3.10 or higher
- Network interface with promiscuous mode support

## Initial Setup

### 1. Install Raspberry Pi OS

1. Flash Raspberry Pi OS to your microSD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Enable SSH during setup (or enable it manually later)
3. Boot your Raspberry Pi and connect via SSH

### 2. Update System

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 3. Install Python and Dependencies

```bash
# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Install system dependencies for packet capture
sudo apt install -y libpcap-dev tcpdump wireshark-common

# Install build dependencies
sudo apt install -y build-essential libssl-dev libffi-dev
```

### 4. Configure Network Interface for Packet Capture

To capture network traffic, your Raspberry Pi needs to either:

- **Option A**: Monitor mode (for wireless) - complex, requires specific wireless adapters
- **Option B**: Port mirroring/SPAN port on a managed switch (recommended)
- **Option C**: Run on a gateway/router device
- **Option D**: Use a USB-to-Ethernet adapter for passive monitoring

For most home networks, **Option B or C** is recommended.

#### Enable Promiscuous Mode

```bash
# Check available network interfaces
ip link show

# Enable promiscuous mode on your interface (replace eth0 with your interface)
sudo ip link set eth0 promisc on

# Make it permanent by adding to /etc/network/interfaces.d/
echo "auto eth0
iface eth0 inet dhcp
    up ip link set eth0 promisc on" | sudo tee /etc/network/interfaces.d/eth0-promisc
```

### 5. Set Up Application Directory

```bash
# Create application directory
mkdir -p ~/netinsight-backend
cd ~/netinsight-backend

# Clone or copy the backend code
# If using git:
git clone <your-repo-url> .

# Or copy files manually via SCP/SFTP
```

### 6. Create Virtual Environment

```bash
cd ~/netinsight-backend/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

**Note**: Scapy installation may take a few minutes as it compiles some extensions.

### 7. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

Update the following values:

```env
# Network Interface (check with: ip link show)
NETWORK_INTERFACE=eth0

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=false

# CORS Configuration - Update with your frontend URL
ALLOWED_ORIGINS=http://localhost:5173,http://your-frontend-domain.com

# Database
DATABASE_PATH=~/netinsight-backend/backend/netinsight.db
```

### 8. Set Permissions for Packet Capture

Packet capture requires elevated privileges. You have two options:

#### Option A: Run as Root (Not Recommended for Production)

```bash
# Only for testing
sudo ./venv/bin/python main.py
```

#### Option B: Grant Capabilities (Recommended)

```bash
# Install libcap2-bin
sudo apt install -y libcap2-bin

# Grant packet capture capability to Python
sudo setcap cap_net_raw,cap_net_admin=eip $(readlink -f venv/bin/python3)

# Verify
getcap venv/bin/python3
```

### 9. Test the Backend

```bash
# Activate virtual environment
source venv/bin/activate

# Start the backend
python main.py
```

You should see:

```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test the API:

```bash
curl http://localhost:8000/api/health
```

## Docker Deployment (Recommended)

### Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker pi
newgrp docker

# Install Docker Compose (if not included)
sudo apt install -y docker-compose-plugin
```

### Setup Docker Deployment

1. **Clone or copy the project to your Raspberry Pi:**

```bash
cd ~
git clone <your-repo-url> net-traffic
cd net-traffic
```

2. **Make startup scripts executable:**

```bash
chmod +x scripts/raspberry-pi-start.sh
chmod +x scripts/raspberry-pi-update.sh
```

3. **Configure environment variables (optional):**

Create a `.env` file in the project root:

```bash
nano .env
```

Add any custom configuration:

```env
NETWORK_INTERFACE=eth0
VITE_API_BASE_URL=http://localhost:8000
```

4. **Start the containers:**

```bash
./scripts/raspberry-pi-start.sh
```

This script will:

- Build optimized ARM64 images
- Pull latest base images
- Start all containers
- Configure automatic restarts

### Automatic Startup on Boot

To automatically start NetInsight on boot and pull latest images:

1. **Copy the systemd service file:**

```bash
sudo cp scripts/netinsight.service /etc/systemd/system/
```

2. **Update the service file with your actual paths:**

```bash
sudo nano /etc/systemd/system/netinsight.service
```

Update the `WorkingDirectory` and paths to match your installation location.

3. **Enable and start the service:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable netinsight

# Start the service
sudo systemctl start netinsight

# Check status
sudo systemctl status netinsight

# View logs
sudo journalctl -u netinsight -f
```

### Updating to Latest Images

The containers are configured to always pull the latest images. To manually update:

```bash
./scripts/raspberry-pi-update.sh
```

This will:

- Pull latest code (if using git)
- Rebuild images with latest base images
- Restart containers

### Container Management

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop containers
docker compose down

# Restart containers
docker compose restart

# Rebuild and restart
docker compose up -d --build
```

## Running as a Service (Non-Docker)

### Create Systemd Service

Create a service file for automatic startup:

```bash
sudo nano /etc/systemd/system/netinsight-backend.service
```

Add the following content (update paths as needed):

```ini
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
```

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable netinsight-backend

# Start the service
sudo systemctl start netinsight-backend

# Check status
sudo systemctl status netinsight-backend

# View logs
sudo journalctl -u netinsight-backend -f
```

## Network Configuration

### Finding Your Network Interface

```bash
# List all network interfaces
ip link show

# Common interfaces:
# - eth0: Primary Ethernet
# - wlan0: WiFi
# - eth1: Secondary Ethernet (if using USB adapter)
```

### Port Mirroring Setup (Recommended)

If you have a managed switch, configure port mirroring:

1. Connect your Raspberry Pi to a switch port
2. Configure the switch to mirror traffic from other ports to the Pi's port
3. The Pi will see all network traffic in promiscuous mode

### Gateway Mode Setup

If running the Pi as a gateway:

1. Configure the Pi with two network interfaces (e.g., eth0 and eth1)
2. eth0 connects to your router/ISP
3. eth1 connects to your internal network
4. Enable IP forwarding: `sudo sysctl -w net.ipv4.ip_forward=1`
5. Configure routing and iptables for NAT

## Frontend Integration

### Update Frontend Configuration

In your frontend project, create or update `.env.local`:

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://your-raspberry-pi-ip:8000
```

Replace `your-raspberry-pi-ip` with your Pi's IP address (find it with `hostname -I`).

### Update App.tsx to Use API

Replace mock data usage in `src/App.tsx`:

```typescript
// Replace the existing hooks with:
import { useApiData } from '@/hooks/useApiData';

function App() {
  const {
    devices,
    flows,
    threats,
    analyticsData,
    protocolStats,
    isCapturing,
    isLoading,
    isConnected,
    startCapture,
    stopCapture,
    dismissThreat,
  } = useApiData({
    pollingInterval: 5000, // Poll every 5 seconds
    useWebSocket: true, // Use WebSocket for real-time updates
  });

  // ... rest of your component
}
```

## Firewall Configuration

If you have a firewall enabled, allow the API port:

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 8000/tcp

# Or for specific IP
sudo ufw allow from YOUR_FRONTEND_IP to any port 8000
```

## Troubleshooting

### Backend Won't Start

```bash
# Check if port is in use
sudo lsof -i :8000

# Check Python version
python3 --version  # Should be 3.10+

# Check virtual environment
source venv/bin/activate
which python  # Should point to venv/bin/python
```

### No Packets Captured

```bash
# Check interface status
ip link show eth0

# Verify promiscuous mode
ip link show eth0 | grep PROMISC

# Test with tcpdump
sudo tcpdump -i eth0 -c 10

# Check permissions
getcap venv/bin/python3
```

### Database Errors

```bash
# Check database file permissions
ls -la netinsight.db

# Remove and recreate database
rm netinsight.db
python main.py  # Will recreate tables
```

### Performance Issues

- Monitor CPU usage: `htop`
- Monitor memory: `free -h`
- Reduce packet capture buffer if needed
- Limit historical data retention in the database

## Security Considerations

1. **Change Default Password**: Always change the default Pi user password
2. **Use SSH Keys**: Disable password authentication, use SSH keys only
3. **Firewall**: Configure firewall to restrict API access
4. **HTTPS**: For production, use a reverse proxy (nginx) with SSL/TLS
5. **VPN**: Consider accessing the Pi through a VPN for remote access

## Next Steps

1. Set up reverse proxy with nginx for HTTPS
2. Configure automatic backups of the database
3. Set up monitoring and alerting
4. Optimize packet capture performance
5. Add more sophisticated threat detection rules

## Support

For issues or questions:

- Check logs: `sudo journalctl -u netinsight-backend -n 100`
- Review backend logs in application directory
- Ensure all dependencies are installed correctly
