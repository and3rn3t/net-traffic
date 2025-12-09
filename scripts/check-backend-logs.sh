#!/bin/bash
# Check backend logs for errors

BACKEND_DIR="/home/pi/net-traffic/backend"
LOG_FILE="$BACKEND_DIR/backend.log"

echo "Checking backend logs..."
echo ""

if [ -f "$LOG_FILE" ]; then
    echo "=== Last 50 lines of backend.log ==="
    tail -50 "$LOG_FILE"
    echo ""
    echo "=== Errors/Warnings ==="
    grep -i "error\|warn\|exception\|traceback\|scapy\|capture" "$LOG_FILE" | tail -20
else
    echo "Log file not found: $LOG_FILE"
    echo ""
    echo "Checking for other log locations..."

    # Check if backend is running
    if pgrep -f "python.*main.py" > /dev/null; then
        PID=$(pgrep -f "python.*main.py" | head -1)
        echo "Backend is running (PID: $PID)"
        echo "Check stderr for errors"
    else
        echo "Backend is not running"
        echo ""
        echo "Try starting it manually to see errors:"
        echo "  cd $BACKEND_DIR"
        echo "  source venv/bin/activate"
        echo "  python main.py"
    fi
fi

echo ""

