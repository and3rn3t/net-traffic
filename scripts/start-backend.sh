#!/bin/bash
# Start backend with proper setup

BACKEND_DIR="/home/pi/net-traffic/backend"
cd "$BACKEND_DIR"

# Activate venv
source venv/bin/activate

echo "Starting NetInsight Backend..."
echo ""

# Check if port 8000 is free
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use. Killing existing process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Check SCAPY
echo "Verifying SCAPY..."
python -c "from scapy.all import get_if_list; print(f'✓ SCAPY OK - {len(get_if_list())} interfaces')" 2>&1 | grep -v "CryptographyDeprecationWarning" | head -1

echo ""
echo "Starting backend..."
echo "Logs: $BACKEND_DIR/backend.log"
echo "Press Ctrl+C to stop"
echo ""

# Start backend
python main.py 2>&1 | tee backend.log

