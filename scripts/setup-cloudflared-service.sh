#!/bin/bash
# Setup Cloudflare Tunnel as a systemd service
# Run this on your Raspberry Pi

set -e

echo "========================================="
echo "Cloudflare Tunnel Systemd Service Setup"
echo "========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "   Run with: sudo ./scripts/setup-cloudflared-service.sh"
    exit 1
fi

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed"
    echo "   Install it first, then run this script again"
    exit 1
fi

echo "✓ cloudflared is installed"
echo ""

# Check if config exists
CONFIG_FILE="/home/pi/.cloudflared/config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "   Run ./scripts/setup-cloudflared-config.sh first"
    exit 1
fi

echo "✓ Config file found: $CONFIG_FILE"
echo ""

# Check if DNS route exists
echo "Checking DNS route..."
ROUTES=$(cloudflared tunnel route dns list 2>/dev/null || echo "")
if echo "$ROUTES" | grep -q "net-backend.andernet.dev"; then
    echo "✓ DNS route for net-backend.andernet.dev already exists"
else
    echo "⚠️  DNS route not found - creating it now..."
    cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
    echo "✓ DNS route created"
fi

echo ""

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/cloudflared.service"
echo "Creating systemd service file: $SERVICE_FILE"

cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/pi/.cloudflared/config.yml run netinsight-backend
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Service file created"
echo ""

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload
echo "✓ Systemd reloaded"
echo ""

# Enable service
echo "Enabling cloudflared service (starts on boot)..."
systemctl enable cloudflared
echo "✓ Service enabled"
echo ""

# Start service
echo "Starting cloudflared service..."
systemctl start cloudflared
echo "✓ Service started"
echo ""

# Check status
echo "Checking service status..."
sleep 2
systemctl status cloudflared --no-pager -l

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Service Management:"
echo "  Status:   sudo systemctl status cloudflared"
echo "  Start:    sudo systemctl start cloudflared"
echo "  Stop:     sudo systemctl stop cloudflared"
echo "  Restart:  sudo systemctl restart cloudflared"
echo "  Logs:     sudo journalctl -u cloudflared -f"
echo ""
echo "Verify tunnel is working:"
echo "  curl https://net-backend.andernet.dev/api/health"
echo ""

