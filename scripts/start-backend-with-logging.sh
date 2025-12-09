#!/bin/bash
# Start backend with proper logging to see errors

BACKEND_DIR="/home/pi/net-traffic/backend"
cd "$BACKEND_DIR"

echo "Starting backend with logging..."
echo "Logs will be written to: $BACKEND_DIR/backend.log"
echo ""

# Activate venv
source venv/bin/activate

# Start backend and capture output
python main.py 2>&1 | tee backend.log

