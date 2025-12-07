#!/bin/bash
# Raspberry Pi 5 System Optimization Script for NetInsight
# This script optimizes the Raspberry Pi 5 system for better performance
# Usage: sudo bash scripts/optimize-pi5.sh

set -e

echo "=========================================="
echo "Raspberry Pi 5 System Optimization"
echo "=========================================="
echo ""
echo "This script will optimize your Raspberry Pi 5 for NetInsight."
echo "Some changes require root access."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Verify Pi 5
if [ ! -f /proc/device-tree/model ]; then
    echo "⚠️  Warning: Cannot detect Pi model. Continuing anyway..."
else
    PI_MODEL=$(tr -d '\0' < /proc/device-tree/model)
    echo "📱 Detected: $PI_MODEL"
    if ! echo "$PI_MODEL" | grep -qi "raspberry pi 5"; then
        echo "⚠️  Warning: This script is optimized for Raspberry Pi 5"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    echo ""
fi

# 1. Update system
echo "1️⃣  Updating system packages..."
apt update && apt upgrade -y

# 2. Install useful utilities
echo ""
echo "2️⃣  Installing optimization utilities..."
apt install -y \
    htop \
    iotop \
    vim \
    curl \
    wget

# 3. Configure GPU memory split (Pi 5 specific)
echo ""
echo "3️⃣  Configuring GPU memory split..."
# Pi 5 doesn't need as much GPU memory for headless operation
if ! grep -q "gpu_mem=" /boot/firmware/config.txt 2>/dev/null && ! grep -q "gpu_mem=" /boot/config.txt 2>/dev/null; then
    CONFIG_FILE="/boot/firmware/config.txt"
    if [ ! -f "$CONFIG_FILE" ]; then
        CONFIG_FILE="/boot/config.txt"
    fi

    if [ -f "$CONFIG_FILE" ]; then
        echo "Setting gpu_mem=16 (minimal for headless Pi 5)..."
        echo "gpu_mem=16" >> "$CONFIG_FILE"
        echo "✅ GPU memory split configured (requires reboot)"
    fi
else
    echo "✅ GPU memory already configured"
fi

# 4. Optimize I/O scheduler for SD card/USB
echo ""
echo "4️⃣  Optimizing I/O scheduler..."
# Use mq-deadline scheduler for better SD card performance
SCHEDULER_FILE="/etc/udev/rules.d/60-io-schedulers.rules"
cat > "$SCHEDULER_FILE" << 'EOF'
# Optimize I/O scheduler for Raspberry Pi 5
# Use mq-deadline for MMC/SD cards (better for random I/O)
ACTION=="add|change", KERNEL=="mmcblk[0-9]*", ATTR{queue/scheduler}="mq-deadline"
# Use none for NVMe (if using NVMe hat)
ACTION=="add|change", KERNEL=="nvme*", ATTR{queue/scheduler}="none"
EOF
echo "✅ I/O scheduler rules created"

# 5. Optimize CPU governor (for better performance)
echo ""
echo "5️⃣  Configuring CPU governor..."
# Install cpufrequtils if not present
if ! command -v cpufreq-set &> /dev/null; then
    apt install -y cpufrequtils
fi

# Set to performance mode (Pi 5 can handle it)
if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
    for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
        if [ -f "$cpu" ]; then
            echo "performance" > "$cpu" 2>/dev/null || true
        fi
    done
    echo "✅ CPU governor set to performance mode"

    # Make it persistent
    GOVERNOR_FILE="/etc/default/cpufrequtils"
    if [ ! -f "$GOVERNOR_FILE" ]; then
        echo "GOVERNOR=performance" > "$GOVERNOR_FILE"
        echo "✅ CPU governor persistence configured"
    fi
else
    echo "⚠️  CPU scaling not available (may need to enable in config.txt)"
fi

# 6. Optimize network settings for packet capture
echo ""
echo "6️⃣  Optimizing network settings for packet capture..."
SYSCTL_FILE="/etc/sysctl.d/99-netinsight-pi5.conf"
cat > "$SYSCTL_FILE" << 'EOF'
# NetInsight Pi 5 Network Optimizations

# Increase buffer sizes for high packet rates
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 262144
net.core.wmem_default = 262144

# Optimize TCP for packet capture
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864

# Increase connection tracking table
net.netfilter.nf_conntrack_max = 262144

# Optimize socket receive buffer
net.core.netdev_max_backlog = 5000
EOF
sysctl -p "$SYSCTL_FILE"
echo "✅ Network optimizations applied"

# 7. Increase file descriptor limits
echo ""
echo "7️⃣  Increasing file descriptor limits..."
LIMITS_FILE="/etc/security/limits.d/99-netinsight-pi5.conf"
cat > "$LIMITS_FILE" << 'EOF'
# NetInsight Pi 5 File Descriptor Limits
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF
echo "✅ File descriptor limits increased (takes effect on next login)"

# 8. Optimize Docker daemon for Pi 5
echo ""
echo "8️⃣  Optimizing Docker daemon configuration..."
DOCKER_DAEMON_FILE="/etc/docker/daemon.json"
mkdir -p /etc/docker

# Read existing config or create new
if [ -f "$DOCKER_DAEMON_FILE" ]; then
    # Backup existing config
    cp "$DOCKER_DAEMON_FILE" "${DOCKER_DAEMON_FILE}.bak"
    # Merge JSON (simple approach - just append if not exists)
    if ! grep -q "max-concurrent-downloads" "$DOCKER_DAEMON_FILE"; then
        # Use a more robust approach with jq if available, otherwise simple append
        if command -v jq &> /dev/null; then
            jq '. + {"max-concurrent-downloads": 3, "max-concurrent-uploads": 2, "log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}}' "$DOCKER_DAEMON_FILE" > "${DOCKER_DAEMON_FILE}.tmp" && mv "${DOCKER_DAEMON_FILE}.tmp" "$DOCKER_DAEMON_FILE"
        else
            cat >> "$DOCKER_DAEMON_FILE" << 'DOCKEREOF'
,
"max-concurrent-downloads": 3,
"max-concurrent-uploads": 2,
"log-driver": "json-file",
"log-opts": {
  "max-size": "10m",
  "max-file": "3"
}
DOCKEREOF
        fi
    fi
else
    cat > "$DOCKER_DAEMON_FILE" << 'EOF'
{
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 2,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
fi

# Restart Docker if running
if systemctl is-active --quiet docker; then
    systemctl restart docker
    echo "✅ Docker daemon optimized and restarted"
else
    echo "✅ Docker daemon configuration updated (will apply on next start)"
fi

# 9. Disable unnecessary services (optional, conservative)
echo ""
echo "9️⃣  Checking for unnecessary services..."
# Only disable if explicitly headless
if [ -z "$DISPLAY" ] && ! systemctl is-active --quiet graphical.target; then
    systemctl disable bluetooth 2>/dev/null || true
    systemctl stop bluetooth 2>/dev/null || true
    echo "✅ Disabled Bluetooth (headless mode)"
else
    echo "ℹ️  Skipping service optimization (GUI detected or interactive)"
fi

# 10. Summary
echo ""
echo "=========================================="
echo "✅ Optimization Complete!"
echo "=========================================="
echo ""
echo "📋 Summary of changes:"
echo "   ✅ System updated"
echo "   ✅ GPU memory optimized (16MB for headless)"
echo "   ✅ I/O scheduler optimized (mq-deadline for SD)"
echo "   ✅ CPU governor set to performance"
echo "   ✅ Network buffers increased for packet capture"
echo "   ✅ File descriptor limits increased"
echo "   ✅ Docker daemon optimized"
echo ""
echo "🔄 Some changes require a reboot to take full effect:"
echo "   - GPU memory split"
echo "   - I/O scheduler"
echo "   - CPU governor persistence"
echo ""
read -p "Reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Rebooting in 5 seconds..."
    sleep 5
    reboot
else
    echo "Please reboot when convenient: sudo reboot"
fi
echo ""

