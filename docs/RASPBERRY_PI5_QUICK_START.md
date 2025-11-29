# Raspberry Pi 5 Quick Start Guide

This guide will get you up and running with NetInsight on your Raspberry Pi 5 in under 15 minutes.

## 📋 Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Raspberry Pi 5 (4GB RAM or more recommended)
- [ ] MicroSD Card (32GB minimum, Class 10 or better)
- [ ] Power Supply (5V 5A USB-C)
- [ ] Network Connection (Ethernet cable recommended)
- [ ] Raspberry Pi OS 64-bit installed and booted
- [ ] SSH access to your Pi (or keyboard/monitor)

## 🚀 Quick Start (Docker - Recommended)

### Step 1: Initial Pi Setup (5 minutes)

1. **Update your Raspberry Pi:**

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

2. **Install Docker:**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

3. **Verify Docker installation:**

```bash
docker --version
docker compose version
```

### Step 2: Get the Code (2 minutes)

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your repo URL)
git clone <your-repo-url> net-traffic
cd net-traffic

# Or if you don't have git, download and extract the ZIP file
```

### Step 3: Configure (1 minute)

```bash
# Make scripts executable
chmod +x scripts/raspberry-pi-start.sh
chmod +x scripts/raspberry-pi-update.sh

# Optional: Create .env file for custom configuration
nano .env
```

Add to `.env` (if needed):

```env
NETWORK_INTERFACE=eth0
VITE_API_BASE_URL=http://localhost:8000
```

### Step 4: Start NetInsight (5-10 minutes)

```bash
# Start the containers (this will build images and pull latest base images)
./scripts/raspberry-pi-start.sh
```

**What happens:**

- Builds optimized ARM64 images for Raspberry Pi
- Pulls latest base images (node, python, nginx)
- Starts backend and frontend containers
- Sets up automatic restarts

**First build takes 5-10 minutes** (downloads base images and builds)
**Subsequent starts take ~30 seconds**

### Step 5: Access NetInsight

Once started, access:

- **Frontend Dashboard:** <http://your-pi-ip-address> (port 80)
- **Backend API:** <http://your-pi-ip-address:8000>
- **API Documentation:** <http://your-pi-ip-address:8000/docs>

Find your Pi's IP address:

```bash
hostname -I
```

### Step 6: Set Up Automatic Startup (Optional but Recommended)

To automatically start NetInsight on boot and pull latest images:

```bash
# Copy the systemd service file
sudo cp scripts/netinsight.service /etc/systemd/system/

# Edit the service file to match your installation path
sudo nano /etc/systemd/system/netinsight.service
```

Update these lines in the service file:

```ini
WorkingDirectory=/home/pi/net-traffic
ExecStart=/home/pi/net-traffic/scripts/raspberry-pi-start.sh
ExecStop=/usr/bin/docker compose -f /home/pi/net-traffic/docker-compose.yml down
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable netinsight
sudo systemctl start netinsight

# Check status
sudo systemctl status netinsight
```

## ✅ Verification

### Check Container Status

```bash
docker compose ps
```

You should see both `netinsight-backend` and `netinsight-frontend` running.

### Check Logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend
```

### Test the API

```bash
# Health check
curl http://localhost:8000/api/health

# Should return: {"status":"healthy"}
```

### Test the Frontend

Open in browser: `http://your-pi-ip-address`

## 🔄 Updating to Latest Version

To update to the latest code and images:

```bash
./scripts/raspberry-pi-update.sh
```

This will:

- Pull latest code (if using git)
- Rebuild images with latest base images
- Restart containers

## 🛠️ Alternative: Non-Docker Installation

If you prefer not to use Docker, see the [Full Deployment Guide](./DEPLOYMENT_RASPBERRY_PI.md) for Python virtual environment setup.

## 🔧 Common Commands

### Container Management

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f

# Stop containers
docker compose down

# Restart containers
docker compose restart

# Rebuild and restart
docker compose up -d --build
```

### Service Management (if using systemd)

```bash
# Check status
sudo systemctl status netinsight

# View logs
sudo journalctl -u netinsight -f

# Restart service
sudo systemctl restart netinsight

# Stop service
sudo systemctl stop netinsight
```

## 🐛 Troubleshooting

### Containers won't start

```bash
# Check Docker is running
sudo systemctl status docker

# Check disk space
df -h

# Check logs for errors
docker compose logs
```

### Can't access frontend/backend

```bash
# Check containers are running
docker compose ps

# Check ports are not in use
sudo netstat -tulpn | grep -E ':(80|8000)'

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 8000/tcp
```

### Images not updating

```bash
# Force rebuild with latest base images
docker compose build --pull --no-cache
docker compose up -d
```

### Permission denied errors

```bash
# Add user to docker group (if not already)
sudo usermod -aG docker $USER
newgrp docker
```

## 📊 Network Configuration

### Finding Your Network Interface

```bash
# List all network interfaces
ip link show

# Common interfaces:
# - eth0: Primary Ethernet
# - wlan0: WiFi
# - eth1: Secondary Ethernet (if using USB adapter)
```

### Setting Up Packet Capture

For packet capture to work, you need to configure your network interface. See the [Full Deployment Guide](./DEPLOYMENT_RASPBERRY_PI.md) for detailed network setup options.

## 📚 Next Steps

1. **Configure Network Interface** - Set up packet capture (see full guide)
2. **Set Up Monitoring** - Configure alerts and monitoring
3. **Enable HTTPS** - Set up reverse proxy with SSL
4. **Backup Database** - Configure automatic backups
5. **Customize Settings** - Adjust retention, rate limits, etc.

## 📖 Additional Documentation

- **[Full Deployment Guide](./DEPLOYMENT_RASPBERRY_PI.md)** - Comprehensive setup guide
- **[Optimization Guide](./RASPBERRY_PI_OPTIMIZATION.md)** - Container optimization details
- **[User Guide](./USER_GUIDE.md)** - Using the NetInsight dashboard
- **[Scripts README](../scripts/README.md)** - Script usage documentation

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker compose logs`
2. Review the [Troubleshooting section](./DEPLOYMENT_RASPBERRY_PI.md#troubleshooting)
3. Check system resources: `htop`, `free -h`, `df -h`
4. Verify network connectivity: `ping 8.8.8.8`

## ✨ What's Optimized

- ✅ ARM64 native images (no emulation)
- ✅ Automatic latest image pulling on boot
- ✅ Multi-stage builds for smaller images
- ✅ Health checks for reliability
- ✅ Automatic restart on failure
- ✅ Optimized for Raspberry Pi 5 performance

---

**Congratulations!** You now have NetInsight running on your Raspberry Pi 5 with automatic updates configured! 🎉
