#!/bin/bash
# Pre-Installation Setup Script for NetInsight on Raspberry Pi 5
# Run this BEFORE installing NetInsight
# Usage: bash scripts/pre-install-setup.sh

set -e

echo "=========================================="
echo "NetInsight Pre-Installation Setup"
echo "=========================================="
echo ""
echo "This script will configure your Raspberry Pi 5 for NetInsight."
echo "Run this BEFORE installing NetInsight."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Detect network interface
echo ""
echo "🔍 Detecting network interfaces..."
INTERFACES=$(ip link show | grep -E "^[0-9]+:" | grep -v lo | awk -F': ' '{print $2}' | head -1)
if [ -z "$INTERFACES" ]; then
    echo "❌ No network interfaces found!"
    exit 1
fi

PRIMARY_INTERFACE=$(echo $INTERFACES | awk '{print $1}')
echo "Found primary interface: $PRIMARY_INTERFACE"
read -p "Is this the monitoring interface (connected to Port 8)? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter interface name (e.g., eth0): " PRIMARY_INTERFACE
fi

echo ""
echo "📋 Configuration Summary:"
echo "   Monitoring Interface: $PRIMARY_INTERFACE"
echo ""

# 1. System Updates
echo "1️⃣  Updating system packages..."
sudo apt update
sudo apt upgrade -y

# 2. Install Required Packages
echo ""
echo "2️⃣  Installing required packages..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    libpcap-dev \
    tcpdump \
    net-tools \
    iputils-ping \
    wget \
    curl \
    ufw \
    build-essential \
    libssl-dev \
    libffi-dev

# 3. Configure Timezone
echo ""
echo "3️⃣  Configuring timezone..."
echo "Current timezone: $(timedatectl | grep 'Time zone')"
read -p "Set timezone? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Available timezones:"
    timedatectl list-timezones | head -20
    read -p "Enter timezone (e.g., America/New_York): " TZ
    if [ ! -z "$TZ" ]; then
        sudo timedatectl set-timezone "$TZ"
    fi
fi
sudo timedatectl set-ntp true

# 4. Configure Promiscuous Mode
echo ""
echo "4️⃣  Configuring promiscuous mode on $PRIMARY_INTERFACE..."

# Check if already enabled
if ip link show $PRIMARY_INTERFACE | grep -q "promiscuity 1"; then
    echo "✅ Promiscuous mode already enabled"
else
    # Enable temporarily
    sudo ip link set $PRIMARY_INTERFACE promisc on
    echo "✅ Enabled promiscuous mode (temporary)"
    
    # Make permanent
    echo ""
    echo "Making promiscuous mode permanent..."
    
    # Try systemd-networkd first (Pi OS Bookworm+)
    if systemctl is-enabled systemd-networkd &>/dev/null || [ -d /etc/systemd/network ]; then
        echo "Using systemd-networkd..."
        sudo mkdir -p /etc/systemd/network
        sudo tee /etc/systemd/network/${PRIMARY_INTERFACE}.network > /dev/null <<EOF
[Match]
Name=$PRIMARY_INTERFACE

[Network]
DHCP=yes

[Link]
Promiscuous=yes
EOF
        sudo systemctl enable systemd-networkd
        sudo systemctl restart systemd-networkd
    else
        # Fallback: systemd service
        echo "Creating systemd service for promiscuous mode..."
        sudo tee /etc/systemd/system/promiscuous-mode.service > /dev/null <<EOF
[Unit]
Description=Enable Promiscuous Mode on $PRIMARY_INTERFACE
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/ip link set $PRIMARY_INTERFACE promisc on
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl enable promiscuous-mode.service
        sudo systemctl start promiscuous-mode.service
    fi
    echo "✅ Promiscuous mode configured permanently"
fi

# 5. Configure Firewall
echo ""
echo "5️⃣  Configuring firewall..."
if command -v ufw &> /dev/null; then
    # Check if already configured
    if sudo ufw status | grep -q "Status: active"; then
        echo "✅ Firewall already active"
    else
        echo "Setting up firewall rules..."
        sudo ufw --force reset
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        
        # Allow SSH (critical!)
        sudo ufw allow 22/tcp comment 'SSH'
        
        # Allow NetInsight ports
        sudo ufw allow 80/tcp comment 'NetInsight Frontend'
        sudo ufw allow 8000/tcp comment 'NetInsight Backend'
        
        # Enable firewall
        echo "y" | sudo ufw enable
        echo "✅ Firewall configured"
    fi
else
    echo "⚠️  UFW not installed, skipping firewall configuration"
fi

# 6. Configure Swap (if low memory)
echo ""
echo "6️⃣  Checking swap configuration..."
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 4096 ]; then
    echo "System has ${TOTAL_MEM}MB RAM (< 4GB), checking swap..."
    SWAP_SIZE=$(free -m | awk '/^Swap:/{print $2}')
    if [ "$SWAP_SIZE" -lt 2048 ]; then
        read -p "Increase swap to 2GB? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Configuring 2GB swap file..."
            sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
            sudo chmod 600 /swapfile
            sudo mkswap /swapfile
            sudo swapon /swapfile
            echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
            echo "✅ Swap configured"
        fi
    else
        echo "✅ Swap already configured (${SWAP_SIZE}MB)"
    fi
else
    echo "✅ Sufficient RAM (${TOTAL_MEM}MB), swap not needed"
fi

# 7. Test Port Mirroring
echo ""
echo "7️⃣  Testing port mirroring..."
echo "Capturing 5 packets from $PRIMARY_INTERFACE..."
echo "If you see packets, port mirroring is working!"
echo ""
timeout 5 sudo tcpdump -i $PRIMARY_INTERFACE -c 5 -n 2>&1 | head -20 || echo "⚠️  No packets captured - check port mirroring configuration"

# 8. System Information
echo ""
echo "8️⃣  System Information:"
echo "=========================================="
echo "Hostname: $(hostname)"
echo "IP Address: $(hostname -I | awk '{print $1}')"
echo "Interface: $PRIMARY_INTERFACE"
echo "Promiscuous Mode: $(ip link show $PRIMARY_INTERFACE | grep -q promisc && echo 'Enabled' || echo 'Disabled')"
echo "Disk Space: $(df -h / | awk 'NR==2 {print $4 " free"}')"
echo "Memory: $(free -h | awk '/^Mem:/{print $2 " total, " $7 " available"}')"
echo "=========================================="

# 9. Summary
echo ""
echo "✅ Pre-installation setup complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Verify port mirroring is working (see test above)"
echo "   2. Note your network interface: $PRIMARY_INTERFACE"
echo "   3. Proceed with NetInsight installation"
echo ""
echo "💡 To verify promiscuous mode after reboot:"
echo "   ip link show $PRIMARY_INTERFACE | grep PROMISC"
echo ""
echo "💡 To test port mirroring:"
echo "   sudo tcpdump -i $PRIMARY_INTERFACE -c 10 -v"
echo ""

