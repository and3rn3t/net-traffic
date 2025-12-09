#!/bin/bash
# Diagnose backend running directly on host (not Docker)

echo "========================================="
echo "Host Backend Diagnostic Script"
echo "========================================="
echo ""

# 1. Find the backend process
echo "1. Finding backend process..."
PROCESS_INFO=$(ps aux | grep "[p]ython.*8000\|[p]ython.*main.py\|uvicorn" | head -1)
if [ -n "$PROCESS_INFO" ]; then
    PID=$(echo "$PROCESS_INFO" | awk '{print $2}')
    echo "   Found process: PID $PID"
    echo "   $PROCESS_INFO"

    # Get working directory and command
    CWD=$(pwdx $PID 2>/dev/null || readlink -f /proc/$PID/cwd 2>/dev/null || echo "unknown")
    CMD=$(cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ' || echo "unknown")
    echo "   Working directory: $CWD"
    echo "   Command: $CMD"
else
    echo "   ✗ No backend process found"
    exit 1
fi

# 2. Check SCAPY availability in the process environment
echo ""
echo "2. Checking SCAPY availability..."
# Try to find Python executable used by the process
PYTHON_EXEC=$(readlink -f /proc/$PID/exe 2>/dev/null || echo "python3")
echo "   Using Python: $PYTHON_EXEC"

SCAPY_CHECK=$($PYTHON_EXEC -c "import scapy; print('SCAPY_OK')" 2>&1)
if echo "$SCAPY_CHECK" | grep -q "SCAPY_OK"; then
    echo "   ✓ SCAPY is installed"
    # Get SCAPY version
    SCAPY_VERSION=$($PYTHON_EXEC -c "import scapy; print(scapy.__version__)" 2>&1)
    echo "   SCAPY version: $SCAPY_VERSION"
else
    echo "   ✗ SCAPY is NOT available"
    echo "   Error: $SCAPY_CHECK"
    echo ""
    echo "   To install SCAPY:"
    echo "     $PYTHON_EXEC -m pip install scapy"
fi

# 3. Check if process has required capabilities/permissions
echo ""
echo "3. Checking process permissions..."
CAPABILITIES=$(getpcaps $PID 2>/dev/null)
if [ -n "$CAPABILITIES" ]; then
    echo "   Process capabilities:"
    echo "   $CAPABILITIES"
    if echo "$CAPABILITIES" | grep -q "cap_net_raw\|cap_net_admin"; then
        echo "   ✓ Has network capture capabilities"
    else
        echo "   ⚠️  Missing network capture capabilities (cap_net_raw, cap_net_admin)"
        echo "   Backend may need to run with sudo or have capabilities set"
    fi
else
    echo "   ⚠️  Cannot check capabilities (getpcaps not available or insufficient permissions)"
    echo "   Checking if running as root..."
    if [ "$(id -u)" -eq 0 ] || [ "$(ps -o user= -p $PID)" = "root" ]; then
        echo "   ✓ Running as root - should have permissions"
    else
        echo "   ⚠️  Not running as root - may need sudo for packet capture"
    fi
fi

# 4. Check backend logs
echo ""
echo "4. Checking for backend logs..."
# Common log locations
LOG_LOCATIONS=(
    "$CWD/backend/logs"
    "$CWD/logs"
    "/var/log/netinsight"
    "$HOME/.netinsight/logs"
)

LOG_FOUND=false
for LOG_DIR in "${LOG_LOCATIONS[@]}"; do
    if [ -d "$LOG_DIR" ]; then
        echo "   Found log directory: $LOG_DIR"
        LATEST_LOG=$(find "$LOG_DIR" -name "*.log" -type f -mtime -1 2>/dev/null | head -1)
        if [ -n "$LATEST_LOG" ]; then
            echo "   Latest log: $LATEST_LOG"
            echo "   Last 20 lines (SCAPY/capture related):"
            tail -20 "$LATEST_LOG" 2>/dev/null | grep -i "scapy\|capture\|error\|warn" || tail -20 "$LATEST_LOG"
            LOG_FOUND=true
        fi
    fi
done

if [ "$LOG_FOUND" = false ]; then
    echo "   ⚠️  No log directory found in common locations"
    echo "   Checking stdout/stderr redirection..."
    # Check if logs might be redirected
    STDERR=$(readlink -f /proc/$PID/fd/2 2>/dev/null || echo "unknown")
    STDOUT=$(readlink -f /proc/$PID/fd/1 2>/dev/null || echo "unknown")
    echo "   stdout: $STDOUT"
    echo "   stderr: $STDERR"
fi

# 5. Test SCAPY capture directly
echo ""
echo "5. Testing SCAPY capture capability..."
TEST_SCRIPT=$(mktemp /tmp/scapy_test_XXXXXX.py)
cat > "$TEST_SCRIPT" << 'EOF'
import sys
import os
try:
    from scapy.all import get_if_list
    interfaces = get_if_list()
    print(f"SCAPY_OK: Found {len(interfaces)} interfaces")
    if 'eth0' in interfaces:
        print("Interface eth0 found")
    else:
        print(f"Available interfaces: {interfaces}")
except ImportError as e:
    print(f"SCAPY_IMPORT_ERROR: {e}")
    sys.exit(1)
except Exception as e:
    print(f"SCAPY_ERROR: {e}")
    sys.exit(1)

# Test actual capture capability
try:
    from scapy.all import sniff
    print("SCAPY_CAPTURE_AVAILABLE")
except Exception as e:
    print(f"SCAPY_CAPTURE_ERROR: {e}")
EOF

TEST_RESULT=$($PYTHON_EXEC "$TEST_SCRIPT" 2>&1)
rm -f "$TEST_SCRIPT"
echo "$TEST_RESULT" | while IFS= read -r line; do
    echo "   $line"
done

# 6. Check network interface
echo ""
echo "6. Checking network interface eth0..."
if ip link show eth0 >/dev/null 2>&1; then
    echo "   ✓ Interface eth0 exists"
    # Check if interface is up
    if ip link show eth0 | grep -q "state UP"; then
        echo "   ✓ Interface eth0 is UP"
    else
        echo "   ⚠️  Interface eth0 is DOWN"
        echo "   Bring it up with: sudo ip link set eth0 up"
    fi
else
    echo "   ✗ Interface eth0 does NOT exist"
    echo "   Available interfaces:"
    ip link show | grep -E "^[0-9]+:" | awk -F': ' '{print "     - " $2}'
fi

# 7. Recommendations
echo ""
echo "========================================="
echo "Recommendations"
echo "========================================="

if echo "$SCAPY_CHECK" | grep -q "SCAPY_OK"; then
    echo "✓ SCAPY is installed"
else
    echo "✗ Install SCAPY:"
    echo "  $PYTHON_EXEC -m pip install scapy"
    echo ""
fi

if [ "$(ps -o user= -p $PID)" != "root" ]; then
    echo "⚠️  Backend is not running as root"
    echo "  Packet capture typically requires root or capabilities"
    echo "  Options:"
    echo "    1. Run backend with sudo: sudo $CMD"
    echo "    2. Set capabilities: sudo setcap cap_net_raw,cap_net_admin+eip $PYTHON_EXEC"
    echo ""
fi

echo "Check backend logs for detailed error messages"
echo ""

