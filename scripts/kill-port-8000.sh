#!/bin/bash
# Kill all processes using port 8000

echo "Finding processes on port 8000..."

# Try lsof first
PIDS=$(lsof -ti:8000 2>/dev/null)

# If no PIDs, try netstat
if [ -z "$PIDS" ]; then
    PIDS=$(netstat -tulpn 2>/dev/null | grep ':8000 ' | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$')
fi

if [ -z "$PIDS" ]; then
    echo "✓ No processes found on port 8000"
    exit 0
fi

echo "Found processes: $PIDS"
for PID in $PIDS; do
    echo "  Killing PID: $PID"
    ps aux | grep "$PID" | grep -v grep
    kill "$PID" 2>/dev/null || sudo kill -9 "$PID" 2>/dev/null
done

sleep 2

# Verify
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port still in use, trying force kill..."
    sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null
    sleep 1
fi

if lsof -ti:8000 > /dev/null 2>&1; then
    echo "✗ Could not free port 8000"
    exit 1
else
    echo "✓ Port 8000 is now free"
fi

