#!/bin/bash
# Setup script for NetInsight Backend systemd service
# This script installs and configures the backend to run as a systemd service
# Usage: ./scripts/setup-backend-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_FILE="$SCRIPT_DIR/netinsight-backend.service"
SYSTEMD_DIR="/etc/systemd/system"
SERVICE_NAME="netinsight-backend.service"

echo "=========================================="
echo "NetInsight Backend Service Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "This script must be run as root (use sudo)"
    exit 1
fi

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Error: Service file not found at $SERVICE_FILE"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
if [ "$ACTUAL_USER" = "root" ]; then
    echo "Warning: Could not determine actual user. Using 'pi' as default."
    ACTUAL_USER="pi"
fi

# Get the actual home directory
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)
BACKEND_DIR="$PROJECT_DIR/backend"

echo "Configuration:"
echo "  User: $ACTUAL_USER"
echo "  Home: $ACTUAL_HOME"
echo "  Backend Directory: $BACKEND_DIR"
echo ""

# Verify backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Error: Backend directory not found at $BACKEND_DIR"
    exit 1
fi

# Verify virtual environment exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Warning: Virtual environment not found at $BACKEND_DIR/venv"
    echo "Creating virtual environment..."
    sudo -u $ACTUAL_USER bash -c "cd $BACKEND_DIR && python3 -m venv venv"
    echo "Installing dependencies..."
    sudo -u $ACTUAL_USER bash -c "cd $BACKEND_DIR && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"
fi

# Verify main.py exists
if [ ! -f "$BACKEND_DIR/main.py" ]; then
    echo "Error: main.py not found at $BACKEND_DIR/main.py"
    exit 1
fi

# Create a temporary service file with updated paths
TEMP_SERVICE=$(mktemp)
sed "s|/home/pi/net-traffic|$PROJECT_DIR|g" "$SERVICE_FILE" | \
sed "s|User=pi|User=$ACTUAL_USER|g" | \
sed "s|Group=pi|Group=$ACTUAL_USER|g" > "$TEMP_SERVICE"

# Copy service file to systemd directory
echo "Installing service file..."
cp "$TEMP_SERVICE" "$SYSTEMD_DIR/$SERVICE_NAME"
rm "$TEMP_SERVICE"

# Set proper permissions
chmod 644 "$SYSTEMD_DIR/$SERVICE_NAME"

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Check if service is already enabled
if systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
    echo "Service is already enabled. Restarting..."
    systemctl restart "$SERVICE_NAME"
else
    echo "Enabling service to start on boot..."
    systemctl enable "$SERVICE_NAME"
    
    echo "Starting service..."
    systemctl start "$SERVICE_NAME"
fi

# Wait a moment for service to start
sleep 2

# Check service status
echo ""
echo "Service status:"
systemctl status "$SERVICE_NAME" --no-pager -l || true

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  Check status:  sudo systemctl status $SERVICE_NAME"
echo "  View logs:     sudo journalctl -u $SERVICE_NAME -f"
echo "  Restart:       sudo systemctl restart $SERVICE_NAME"
echo "  Stop:          sudo systemctl stop $SERVICE_NAME"
echo "  Start:         sudo systemctl start $SERVICE_NAME"
echo "  Disable:       sudo systemctl disable $SERVICE_NAME"
echo ""
echo "Backend should be running at: http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo ""

