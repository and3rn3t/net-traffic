#!/bin/bash
# Restart backend with fixes applied

BACKEND_DIR="/home/pi/net-traffic/backend"

echo "Restarting backend with fixes..."

# Kill port 8000
chmod +x scripts/kill-port-8000.sh
./scripts/kill-port-8000.sh

cd "$BACKEND_DIR"
source venv/bin/activate

echo ""
echo "Starting backend in background..."
nohup python main.py > backend.log 2>&1 &
BACKEND_PID=$!

echo "Backend started (PID: $BACKEND_PID)"
echo ""
echo "Waiting 5 seconds for startup..."
sleep 5

echo ""
echo "Checking status..."
curl -s http://localhost:8000/api/capture/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/api/capture/status

echo ""
echo "Checking health..."
curl -s http://localhost:8000/api/health | python3 -m json.tool 2>/dev/null | grep -A 5 "capture" || curl -s http://localhost:8000/api/health | grep -o '"capture":{[^}]*}'

echo ""
echo "To view logs: tail -f $BACKEND_DIR/backend.log"
echo ""

